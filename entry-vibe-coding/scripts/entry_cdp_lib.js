'use strict';

const { spawn } = require('node:child_process');
const { existsSync, mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const DEFAULT_BLOCK_URL = 'https://playentry.org/ws/new?type=normal&mode=block&lang=ko';
const DEFAULT_PYTHON_URL = 'https://playentry.org/ws/new?type=normal&mode=python&lang=ko';
const SPEEDS = [1, 15, 30, 45, 60];

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const item = argv[i];
        if (!item.startsWith('--')) {
            continue;
        }
        const key = item.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith('--')) {
            args[key] = true;
        } else {
            args[key] = next;
            i++;
        }
    }
    return args;
}

function modeToUrl(mode) {
    return mode === 'block' ? DEFAULT_BLOCK_URL : DEFAULT_PYTHON_URL;
}

function boolArg(value, defaultValue = true) {
    if (value === undefined) {
        return defaultValue;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return !['0', 'false', 'no', 'off'].includes(String(value).toLowerCase());
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function findChrome(explicitPath) {
    const candidates = [
        explicitPath,
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ].filter(Boolean);

    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
        throw new Error('Chrome executable not found. Pass --chrome <path> or set CHROME_PATH.');
    }
    return found;
}

function randomPort() {
    return 9300 + Math.floor(Math.random() * 500);
}

async function getJson(url, attempts = 80, init = {}) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
        try {
            const response = await fetch(url, init);
            if (response.ok) {
                return await response.json();
            }
            lastError = new Error(`HTTP ${response.status} for ${url}`);
        } catch (error) {
            lastError = error;
        }
        await sleep(250);
    }
    throw lastError;
}

class EntryCdpPage {
    constructor(options = {}) {
        this.options = options;
        this.port = Number(options.port) || randomPort();
        this.pending = new Map();
        this.nextId = 1;
        this.events = [];
        this.userDataDir = options.userDataDir || mkdtempSync(join(tmpdir(), 'entry-cdp-'));
        this.ownsUserDataDir = !options.userDataDir;
    }

    async start() {
        const chrome = findChrome(this.options.chrome);
        const headless = boolArg(this.options.headless, true);
        const chromeArgs = [
            headless ? '--headless=new' : '',
            '--disable-gpu',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-dev-shm-usage',
            `--remote-debugging-port=${this.port}`,
            `--user-data-dir=${this.userDataDir}`,
            'about:blank',
        ].filter(Boolean);

        this.process = spawn(chrome, chromeArgs, {
            stdio: ['ignore', 'ignore', this.options.verbose ? 'pipe' : 'ignore'],
        });

        await getJson(`http://127.0.0.1:${this.port}/json/version`);
        const target = await getJson(`http://127.0.0.1:${this.port}/json/new?about:blank`, 10, {
            method: 'PUT',
        });
        this.ws = new WebSocket(target.webSocketDebuggerUrl);
        this.ws.addEventListener('message', (event) => this._handleMessage(event));
        await new Promise((resolve, reject) => {
            this.ws.addEventListener('open', resolve, { once: true });
            this.ws.addEventListener('error', reject, { once: true });
        });

        await this.send('Runtime.enable');
        await this.send('Page.enable');
        await this.send('Log.enable').catch(() => {});

        const width = Number(this.options.width) || 1440;
        const height = Number(this.options.height) || 1000;
        await this.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: false,
        }).catch(() => {});
    }

    _handleMessage(event) {
        const message = JSON.parse(event.data);
        if (message.id && this.pending.has(message.id)) {
            const { resolve, reject } = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) {
                reject(new Error(JSON.stringify(message.error)));
            } else {
                resolve(message.result);
            }
            return;
        }
        if (message.method) {
            this.events.push({
                method: message.method,
                params: message.params,
            });
        }
    }

    send(method, params = {}) {
        const id = this.nextId++;
        this.ws.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
        });
    }

    async navigate(url, waitMs = 25000) {
        await this.send('Page.navigate', { url });
        await sleep(waitMs);
    }

    async evaluate(expression, options = {}) {
        const result = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
            timeout: options.timeout || 15000,
        });
        if (result.exceptionDetails) {
            const detail = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
            throw new Error(detail || JSON.stringify(result.exceptionDetails));
        }
        return result.result ? result.result.value : undefined;
    }

    async waitForExpression(expression, timeoutMs = 30000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const ok = await this.evaluate(`Boolean(${expression})`).catch(() => false);
            if (ok) {
                return true;
            }
            await sleep(500);
        }
        throw new Error(`Timed out waiting for expression: ${expression}`);
    }

    async waitForEntry(timeoutMs = 45000) {
        return this.waitForExpression(
            'window.Entry && typeof Entry.exportProject === "function" && typeof Entry.loadProject === "function"',
            timeoutMs
        );
    }

    async ensureMode(mode) {
        if (!mode || mode === 'none') {
            return this.getModeSummary();
        }
        const target = mode === 'block' ? 0 : 1;
        await this.evaluate(
            `(() => {
                const ws = Entry.getMainWS && Entry.getMainWS();
                if (!ws) return { ok: false, reason: 'main workspace missing' };
                if (${target} === 1 && ws.getMode && ws.getMode() !== 1) {
                    ws.setMode({
                        boardType: Entry.Workspace.MODE_VIMBOARD,
                        textType: Entry.Vim.TEXT_TYPE_PY,
                        runType: Entry.Vim.WORKSPACE_MODE
                    }, undefined, true);
                } else if (${target} === 0 && ws.getMode && ws.getMode() !== 0) {
                    ws.setMode({ boardType: Entry.Workspace.MODE_BOARD, textType: -1 }, undefined, true);
                }
                return true;
            })()`
        );
        await sleep(2500);
        return this.getModeSummary();
    }

    async getModeSummary() {
        return this.evaluate(
            `(() => {
                const ws = Entry.getMainWS && Entry.getMainWS();
                const cm = document.querySelector('.CodeMirror')?.CodeMirror ||
                    ws?.vimBoard?.codeMirror || null;
                return {
                    mode: ws?.getMode?.(),
                    isPython: ws?.getMode?.() === 1,
                    hasCodeMirror: Boolean(cm),
                    fps: Entry.FPS,
                    tickTime: Entry.tickTime,
                    engineSpeeds: Entry.engine?.speeds || null,
                    engineState: Entry.engine?.state || null
                };
            })()`
        );
    }

    async captureScreenshot(filePath) {
        const result = await this.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false,
        });
        writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    }

    async close() {
        try {
            if (this.ws) {
                this.ws.close();
            }
        } catch {}
        try {
            if (this.process) {
                this.process.kill();
            }
        } catch {}
        await sleep(500);
        if (this.ownsUserDataDir && !boolArg(this.options.keepProfile, false)) {
            try {
                rmSync(this.userDataDir, { recursive: true, force: true });
            } catch {}
        }
    }
}

async function withEntryPage(args, callback) {
    const page = new EntryCdpPage(args);
    try {
        await page.start();
        const url = args.url || modeToUrl(args.mode || 'python');
        await page.navigate(url, Number(args['wait-ms']) || 25000);
        await page.waitForEntry(Number(args['entry-timeout-ms']) || 45000);
        if (args.mode) {
            await page.ensureMode(args.mode);
        }
        return await callback(page);
    } finally {
        await page.close();
    }
}

function summarizeProject(project) {
    const firstObject = project?.objects?.[0];
    return {
        keys: project ? Object.keys(project) : [],
        speed: project?.speed,
        scenes: project?.scenes?.length || 0,
        objects: project?.objects?.length || 0,
        variables: project?.variables?.length || 0,
        messages: project?.messages?.length || 0,
        functions: project?.functions?.length || 0,
        tables: project?.tables?.length || 0,
        firstObject: firstObject
            ? {
                  id: firstObject.id,
                  name: firstObject.name,
                  objectType: firstObject.objectType,
                  scene: firstObject.scene,
                  pictures: firstObject.sprite?.pictures?.length || 0,
                  sounds: firstObject.sprite?.sounds?.length || 0,
                  x: firstObject.entity?.x,
                  y: firstObject.entity?.y,
              }
            : null,
    };
}

function printOrWriteJson(data, outPath) {
    const text = `${JSON.stringify(data, null, 2)}\n`;
    if (outPath) {
        writeFileSync(outPath, text, 'utf8');
    } else {
        process.stdout.write(text);
    }
}

module.exports = {
    DEFAULT_BLOCK_URL,
    DEFAULT_PYTHON_URL,
    SPEEDS,
    EntryCdpPage,
    parseArgs,
    printOrWriteJson,
    sleep,
    summarizeProject,
    withEntryPage,
};
