#!/usr/bin/env node
'use strict';

const {
    SPEEDS,
    parseArgs,
    printOrWriteJson,
    withEntryPage,
} = require('./entry_cdp_lib');

async function main() {
    const args = parseArgs(process.argv.slice(2));
    args.mode = args.mode || 'block';
    const speeds = args.speeds
        ? String(args.speeds)
              .split(',')
              .map((value) => Number(value.trim()))
              .filter((value) => Number.isFinite(value))
        : SPEEDS;
    const runMs = Number(args['run-ms'] || 1200);

    const report = await withEntryPage(args, async (page) => {
        const rows = [];
        for (const speed of speeds) {
            const row = await page.evaluate(
                `(async () => {
                    if (Entry.engine.state !== 'stop') {
                        await Entry.engine.toggleStop();
                    }
                    Entry.engine.setSpeedMeter(${JSON.stringify(speed)});
                    const beforeObject = Entry.container.getAllObjects?.()[0];
                    const before = {
                        x: beforeObject?.entity?.x,
                        y: beforeObject?.entity?.y,
                        fps: Entry.FPS,
                        tickTime: Entry.tickTime,
                        exportedSpeed: Entry.exportProject().speed
                    };
                    Entry.engine.toggleRun();
                    await new Promise((resolve) => setTimeout(resolve, ${JSON.stringify(runMs)}));
                    const duringObject = Entry.container.getAllObjects?.()[0];
                    const during = {
                        x: duringObject?.entity?.x,
                        y: duringObject?.entity?.y,
                        state: Entry.engine.state,
                        fps: Entry.FPS,
                        tickTime: Entry.tickTime
                    };
                    await Entry.engine.toggleStop();
                    const after = {
                        state: Entry.engine.state,
                        fps: Entry.FPS,
                        tickTime: Entry.tickTime,
                        exportedSpeed: Entry.exportProject().speed
                    };
                    return {
                        requestedSpeed: ${JSON.stringify(speed)},
                        before,
                        during,
                        after,
                        deltaX: typeof before.x === 'number' && typeof during.x === 'number' ? during.x - before.x : null,
                        accepted: Entry.FPS === ${JSON.stringify(speed)} &&
                            Entry.tickTime === Math.floor(1000 / ${JSON.stringify(speed)})
                    };
                })()`,
                { timeout: runMs + 20000 }
            );
            rows.push(row);
        }
        return {
            ok: rows.every((row) => row.accepted),
            runMs,
            speeds,
            rows,
        };
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
