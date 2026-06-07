#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');
const { parseArgs, printOrWriteJson, withEntryPage } = require('./entry_cdp_lib');

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    args.mode = args.mode || (args.python ? 'python' : 'block');
    const project = args.project ? readJson(args.project) : null;
    const pythonSource = args.python ? readFileSync(args.python, 'utf8') : null;
    const trials = Number(args.trials || 3);
    const runMs = Number(args['run-ms'] || 1000);
    const speed = args.speed === undefined ? null : Number(args.speed);
    const tolerance = Number(args.tolerance || 0.001);

    const report = await withEntryPage(args, async (page) => {
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
        const prepared = await page.evaluate('Entry.exportProject()', { timeout: 20000 });
        return await page.evaluate(
            `(async () => {
                const prepared = ${JSON.stringify(prepared)};
                const trials = ${JSON.stringify(trials)};
                const runMs = ${JSON.stringify(runMs)};
                const speed = ${JSON.stringify(speed)};
                const tolerance = ${JSON.stringify(tolerance)};
                const snapshot = () => Entry.container.getAllObjects().map((object) => ({
                    id: object.id,
                    name: object.name,
                    scene: typeof object.scene === 'string' ? object.scene : object.scene?.id || null,
                    x: Number(object.entity?.x || 0),
                    y: Number(object.entity?.y || 0),
                    direction: Number(object.entity?.direction || 0),
                    rotation: Number(object.entity?.rotation || 0),
                    visible: Boolean(object.entity?.visible),
                    selectedPictureId: object.selectedPictureId || object.selectedPicture?.id || null
                })).sort((a, b) => String(a.id).localeCompare(String(b.id)));
                const rows = [];
                for (let i = 0; i < trials; i++) {
                    if (Entry.engine.state !== 'stop') await Entry.engine.toggleStop();
                    Entry.clearProject();
                    Entry.loadProject(prepared);
                    if (speed !== null) Entry.engine.setSpeedMeter(speed);
                    const before = snapshot();
                    Entry.engine.toggleRun();
                    await new Promise((resolve) => setTimeout(resolve, runMs));
                    const during = snapshot();
                    if (Entry.engine.state !== 'stop') await Entry.engine.toggleStop();
                    rows.push({
                        trial: i + 1,
                        before,
                        during,
                        engineState: Entry.engine.state,
                        fps: Entry.FPS,
                        tickTime: Entry.tickTime
                    });
                }
                const diffs = [];
                const base = rows[0];
                const compareNumber = (path, a, b) => {
                    if (Math.abs(a - b) > tolerance) {
                        diffs.push({ path, expected: a, actual: b });
                    }
                };
                for (const row of rows.slice(1)) {
                    if (JSON.stringify(base.before) !== JSON.stringify(row.before)) {
                        diffs.push({ trial: row.trial, path: 'before', expected: base.before, actual: row.before });
                    }
                    for (let i = 0; i < base.during.length; i++) {
                        const expected = base.during[i];
                        const actual = row.during[i];
                        if (!actual || expected.id !== actual.id) {
                            diffs.push({ trial: row.trial, path: 'during.objects', expected, actual });
                            continue;
                        }
                        for (const field of ['x', 'y', 'direction', 'rotation']) {
                            compareNumber(\`trial \${row.trial} object \${expected.id} \${field}\`, expected[field], actual[field]);
                        }
                        for (const field of ['visible', 'selectedPictureId', 'scene']) {
                            if (expected[field] !== actual[field]) {
                                diffs.push({ trial: row.trial, path: \`object \${expected.id} \${field}\`, expected: expected[field], actual: actual[field] });
                            }
                        }
                    }
                    if (row.engineState !== 'stop') {
                        diffs.push({ trial: row.trial, path: 'engineState', expected: 'stop', actual: row.engineState });
                    }
                }
                return {
                    ok: diffs.length === 0,
                    runMs,
                    trials,
                    speed,
                    tolerance,
                    rows,
                    diffs
                };
            })()`,
            { timeout: trials * (runMs + 10000) + 30000 }
        );
    });

    printOrWriteJson(report, args.out);
    if (!report.ok) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    printOrWriteJson({ ok: false, error: String(error.stack || error) });
    process.exitCode = 1;
});
