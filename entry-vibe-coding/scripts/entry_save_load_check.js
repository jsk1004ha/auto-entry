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

function comparable(summary) {
    return {
        speed: summary.speed,
        scenes: summary.scenes,
        objects: summary.objects,
        variables: summary.variables,
        messages: summary.messages,
        functions: summary.functions,
        tables: summary.tables,
        firstObjectName: summary.firstObject?.name || null,
        firstObjectType: summary.firstObject?.objectType || null,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    args.mode = args.mode || 'block';
    const inputProject = args.project ? readJson(args.project) : null;
    const serverMode = args.server || 'auto';

    const report = await withEntryPage(args, async (page) => {
        if (inputProject) {
            await page.evaluate(`Entry.clearProject(); Entry.loadProject(${JSON.stringify(inputProject)});`);
        }

        const firstExport = await page.evaluate(`Entry.exportProject()`, { timeout: 20000 });
        const firstSummary = summarizeProject(firstExport);

        const roundTrip = await page.evaluate(
            `(() => {
                const first = Entry.exportProject();
                Entry.clearProject();
                Entry.loadProject(first);
                const second = Entry.exportProject();
                return { first, second };
            })()`,
            { timeout: 30000 }
        );
        const secondSummary = summarizeProject(roundTrip.second);

        if (args.export) {
            writeFileSync(args.export, `${JSON.stringify(roundTrip.second, null, 2)}\n`, 'utf8');
        }

        const auth = await page.evaluate(
            `(() => {
                const text = document.body.innerText || '';
                const hasLoginText = /로그인|회원가입|Login|Sign up/i.test(text);
                const userButtons = Array.from(document.querySelectorAll('button, a')).map((el) =>
                    (el.innerText || el.textContent || '').trim()
                );
                return {
                    likelyLoggedIn: !hasLoginText,
                    hasLoginText,
                    userTextSample: userButtons.filter(Boolean).slice(0, 30)
                };
            })()`
        );

        let server = {
            requested: serverMode,
            attempted: false,
            status: 'skipped',
            reason: 'server mode off',
        };

        if (serverMode !== 'off') {
            if (!auth.likelyLoggedIn) {
                server = {
                    requested: serverMode,
                    attempted: false,
                    status: 'skipped',
                    reason: 'browser session is not logged in',
                };
            } else {
                server = await page.evaluate(
                    `(async () => {
                        const before = Entry.exportProject();
                        let saveEventDispatched = false;
                        try {
                            Entry.dispatchEvent('saveWorkspace');
                            saveEventDispatched = true;
                        } catch (error) {
                            return {
                                requested: ${JSON.stringify(serverMode)},
                                attempted: true,
                                status: 'failed',
                                reason: String(error)
                            };
                        }
                        await new Promise((resolve) => setTimeout(resolve, 1500));
                        const after = Entry.exportProject();
                        return {
                            requested: ${JSON.stringify(serverMode)},
                            attempted: true,
                            status: 'preflighted',
                            saveEventDispatched,
                            beforeSpeed: before.speed,
                            afterSpeed: after.speed,
                            note: 'Server confirmation is UI/account dependent; verify project list when persistence matters.'
                        };
                    })()`,
                    { timeout: 10000 }
                );
            }
        }

        return {
            ok: JSON.stringify(comparable(firstSummary)) === JSON.stringify(comparable(secondSummary)),
            local: {
                firstSummary,
                secondSummary,
                comparableFirst: comparable(firstSummary),
                comparableSecond: comparable(secondSummary),
                export: args.export || null,
            },
            auth,
            server,
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
