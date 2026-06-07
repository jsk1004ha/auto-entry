#!/usr/bin/env node
'use strict';

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const {
    EntryCdpPage,
    parseArgs,
    printOrWriteJson,
    sleep,
    withEntryPage,
} = require('./entry_cdp_lib');

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function pngDataUrl(path) {
    if (!existsSync(path)) {
        throw new Error(`Image not found: ${path}`);
    }
    return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

async function captureActual(args, path) {
    const project = args.project ? readJson(args.project) : null;
    const pythonSource = args.python ? readFileSync(args.python, 'utf8') : null;
    await withEntryPage(args, async (page) => {
        if (project) {
            await page.evaluate(`Entry.clearProject(); Entry.loadProject(${JSON.stringify(project)});`, { timeout: 30000 });
        }
        if (pythonSource !== null) {
            await page.ensureMode('python');
            const sync = await page.evaluate(
                `(() => {
                    const ws = Entry.getMainWS && Entry.getMainWS();
                    const cm = document.querySelector('.CodeMirror')?.CodeMirror || ws?.vimBoard?.codeMirror;
                    if (!cm) return { ok: false, reason: 'CodeMirror not found' };
                    cm.setValue(${JSON.stringify(pythonSource)});
                    cm.refresh();
                    const result = ws.syncCode && ws.syncCode();
                    return result && (result.type || result.title) ? { ok: false, parser: result } : { ok: true };
                })()`,
                { timeout: 20000 }
            );
            if (!sync.ok) {
                throw new Error(`Entry Python sync failed: ${JSON.stringify(sync)}`);
            }
        }
        if (args.speed !== undefined) {
            await page.evaluate(`Entry.engine.setSpeedMeter(${JSON.stringify(Number(args.speed))});`);
        }
        const runMs = Number(args['run-ms'] || 0);
        if (runMs > 0) {
            await page.evaluate(
                `(async () => {
                    Entry.engine.toggleRun();
                    await new Promise((resolve) => setTimeout(resolve, ${JSON.stringify(runMs)}));
                    if (Entry.engine.state !== 'stop') await Entry.engine.toggleStop();
                })()`,
                { timeout: runMs + 15000 }
            );
            await sleep(500);
        }
        await page.captureScreenshot(path);
    });
}

async function compareImages(args, baselinePath, actualPath) {
    const page = new EntryCdpPage(args);
    try {
        await page.start();
        await page.navigate('about:blank', 1000);
        const baselineUrl = pngDataUrl(baselinePath);
        const actualUrl = pngDataUrl(actualPath);
        const threshold = Number(args.threshold || 0.01);
        const pixelThreshold = Number(args['pixel-threshold'] || 16);
        return await page.evaluate(
            `(async () => {
                const load = (src) => new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = src;
                });
                const [baseline, actual] = await Promise.all([
                    load(${JSON.stringify(baselineUrl)}),
                    load(${JSON.stringify(actualUrl)})
                ]);
                if (baseline.width !== actual.width || baseline.height !== actual.height) {
                    return {
                        ok: false,
                        reason: 'dimension-mismatch',
                        baseline: { width: baseline.width, height: baseline.height },
                        actual: { width: actual.width, height: actual.height },
                        threshold: ${JSON.stringify(threshold)},
                        pixelThreshold: ${JSON.stringify(pixelThreshold)}
                    };
                }
                const canvas = document.createElement('canvas');
                canvas.width = baseline.width;
                canvas.height = baseline.height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                ctx.drawImage(baseline, 0, 0);
                const a = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(actual, 0, 0);
                const b = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                let mismatch = 0;
                let totalAbs = 0;
                const total = canvas.width * canvas.height;
                for (let i = 0; i < a.length; i += 4) {
                    const dr = Math.abs(a[i] - b[i]);
                    const dg = Math.abs(a[i + 1] - b[i + 1]);
                    const db = Math.abs(a[i + 2] - b[i + 2]);
                    const da = Math.abs(a[i + 3] - b[i + 3]);
                    const maxDiff = Math.max(dr, dg, db, da);
                    totalAbs += dr + dg + db + da;
                    if (maxDiff > ${JSON.stringify(pixelThreshold)}) {
                        mismatch++;
                    }
                }
                const mismatchRatio = mismatch / total;
                const meanAbsDiff = totalAbs / (total * 4);
                return {
                    ok: mismatchRatio <= ${JSON.stringify(threshold)},
                    baseline: { width: baseline.width, height: baseline.height },
                    actual: { width: actual.width, height: actual.height },
                    mismatchPixels: mismatch,
                    totalPixels: total,
                    mismatchRatio,
                    meanAbsDiff,
                    threshold: ${JSON.stringify(threshold)},
                    pixelThreshold: ${JSON.stringify(pixelThreshold)}
                };
            })()`,
            { timeout: 60000 }
        );
    } finally {
        await page.close();
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.baseline) {
        throw new Error('Pass --baseline <png>.');
    }
    let actualPath = args.actual;
    if (!actualPath) {
        actualPath = join(tmpdir(), `entry-actual-${Date.now()}.png`);
        await captureActual(args, actualPath);
    }
    const comparison = await compareImages(args, args.baseline, actualPath);
    const report = {
        ok: comparison.ok,
        baseline: args.baseline,
        actual: actualPath,
        comparison,
    };
    printOrWriteJson(report, args.out);
    if (!report.ok) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    printOrWriteJson({ ok: false, error: String(error.stack || error) });
    process.exitCode = 1;
});
