#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const {
    parseArgs,
    printOrWriteJson,
    summarizeProject,
    withEntryPage,
} = require('./entry_cdp_lib');

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    args.mode = args.mode || (args.python ? 'python' : 'block');
    const runMs = Number(args['run-ms'] || 1000);
    const project = args.project ? readJson(args.project) : null;
    const pythonSource = args.python ? readFileSync(args.python, 'utf8') : null;
    const speed = args.speed === undefined ? null : Number(args.speed);

    const report = await withEntryPage(args, async (page) => {
        if (project) {
            await page.evaluate(`Entry.clearProject(); Entry.loadProject(${JSON.stringify(project)});`);
        }

        let textSync = null;
        if (pythonSource !== null) {
            await page.ensureMode('python');
            textSync = await page.evaluate(
                `(() => {
                    const ws = Entry.getMainWS && Entry.getMainWS();
                    const cm = document.querySelector('.CodeMirror')?.CodeMirror ||
                        ws?.vimBoard?.codeMirror;
                    if (!cm) return { ok: false, reason: 'CodeMirror not found' };
                    cm.setValue(${JSON.stringify(pythonSource)});
                    cm.refresh();
                    const syncResult = ws.syncCode && ws.syncCode();
                    if (syncResult && (syncResult.type || syncResult.title)) {
                        return { ok: false, parser: syncResult };
                    }
                    return { ok: true, mode: ws.getMode && ws.getMode(), chars: cm.getValue().length };
                })()`,
                { timeout: 20000 }
            );
            if (!textSync.ok) {
                throw new Error(`Entry Python sync failed: ${JSON.stringify(textSync)}`);
            }
        }

        if (speed !== null) {
            await page.evaluate(`Entry.engine.setSpeedMeter(${JSON.stringify(speed)});`);
        }

        const before = await page.evaluate(
            `(() => {
                const project = Entry.exportProject();
                const object = Entry.container.getAllObjects?.()[0];
                return {
                    project,
                    engineState: Entry.engine.state,
                    fps: Entry.FPS,
                    tickTime: Entry.tickTime,
                    firstObjectRuntime: object ? {
                        x: object.entity?.x,
                        y: object.entity?.y,
                        direction: object.entity?.direction,
                        visible: object.entity?.visible
                    } : null
                };
            })()`,
            { timeout: 20000 }
        );

        let during = null;
        if (runMs > 0) {
            during = await page.evaluate(
                `(async () => {
                    Entry.engine.toggleRun();
                    await new Promise((resolve) => setTimeout(resolve, ${JSON.stringify(runMs)}));
                    const object = Entry.container.getAllObjects?.()[0];
                    return {
                        engineState: Entry.engine.state,
                        fps: Entry.FPS,
                        tickTime: Entry.tickTime,
                        firstObjectRuntime: object ? {
                            x: object.entity?.x,
                            y: object.entity?.y,
                            direction: object.entity?.direction,
                            visible: object.entity?.visible
                        } : null
                    };
                })()`,
                { timeout: runMs + 15000 }
            );
        }

        if (args.screenshot) {
            await page.captureScreenshot(args.screenshot);
        }

        const after = await page.evaluate(
            `(async () => {
                if (Entry.engine.state !== 'stop') {
                    await Entry.engine.toggleStop();
                }
                const project = Entry.exportProject();
                return {
                    project,
                    engineState: Entry.engine.state,
                    fps: Entry.FPS,
                    tickTime: Entry.tickTime
                };
            })()`,
            { timeout: 20000 }
        );

        if (args.export) {
            writeFileSync(args.export, `${JSON.stringify(after.project, null, 2)}\n`, 'utf8');
        }

        return {
            ok: true,
            textSync,
            before: {
                engineState: before.engineState,
                fps: before.fps,
                tickTime: before.tickTime,
                firstObjectRuntime: before.firstObjectRuntime,
                projectSummary: summarizeProject(before.project),
            },
            during,
            after: {
                engineState: after.engineState,
                fps: after.fps,
                tickTime: after.tickTime,
                projectSummary: summarizeProject(after.project),
            },
            artifacts: {
                export: args.export || null,
                screenshot: args.screenshot || null,
            },
        };
    });

    printOrWriteJson(report, args.out);
}

main().catch((error) => {
    printOrWriteJson({ ok: false, error: String(error.stack || error) });
    process.exitCode = 1;
});
