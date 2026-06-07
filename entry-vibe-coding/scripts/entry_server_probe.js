#!/usr/bin/env node
'use strict';

const { parseArgs, printOrWriteJson, withEntryPage } = require('./entry_cdp_lib');

function probeExpression() {
    return `(() => {
        const text = document.body.innerText || '';
        const relevantResource = /(api|graphql|project|workspace|save|copy|load|entry)/i;
        const resources = performance.getEntriesByType('resource')
            .map((entry) => ({
                name: entry.name,
                initiatorType: entry.initiatorType,
                duration: Math.round(entry.duration),
                transferSize: entry.transferSize || 0
            }))
            .filter((entry) => relevantResource.test(entry.name))
            .slice(-120);
        const entryKeys = window.Entry ? Object.keys(window.Entry)
            .filter((key) => /save|load|copy|project|workspace/i.test(key))
            .sort() : [];
        const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'))
            .map((el) => (el.innerText || el.textContent || '').trim())
            .filter(Boolean)
            .slice(0, 80);
        const cookieNames = document.cookie.split(';')
            .map((item) => item.trim().split('=')[0])
            .filter(Boolean)
            .sort();
        const hasLoginText = /로그인|회원가입|login|sign in|sign up/i.test(text);
        return {
            url: location.href,
            title: document.title,
            auth: {
                likelyLoggedIn: !hasLoginText,
                hasLoginText
            },
            storage: {
                cookieNames,
                localStorageKeys: Object.keys(localStorage).sort(),
                sessionStorageKeys: Object.keys(sessionStorage).sort()
            },
            entryKeys,
            resources,
            uiTextSample: buttons
        };
    })()`;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    args.mode = args.mode || 'block';

    const report = await withEntryPage(args, async (page) => {
        const before = await page.evaluate(probeExpression(), { timeout: 20000 });
        let saveTrace = {
            attempted: false,
            status: 'skipped',
            reason: 'pass --trace-save to dispatch saveWorkspace in an authenticated session',
        };

        if (args['trace-save']) {
            if (!before.auth.likelyLoggedIn) {
                saveTrace = {
                    attempted: false,
                    status: 'skipped',
                    reason: 'browser session does not look logged in',
                };
            } else {
                const startCount = before.resources.length;
                saveTrace = await page.evaluate(
                    `(async () => {
                        try {
                            Entry.dispatchEvent('saveWorkspace');
                        } catch (error) {
                            return { attempted: true, status: 'failed', reason: String(error) };
                        }
                        await new Promise((resolve) => setTimeout(resolve, 2500));
                        return { attempted: true, status: 'dispatched' };
                    })()`,
                    { timeout: 10000 }
                );
                const after = await page.evaluate(probeExpression(), { timeout: 20000 });
                saveTrace.resourcesAfterDispatch = after.resources.slice(startCount);
            }
        }

        return {
            ok: true,
            before,
            saveTrace,
            note: 'Cookie values are intentionally omitted. Server persistence still requires authenticated UI verification.',
        };
    });

    printOrWriteJson(report, args.out);
}

main().catch((error) => {
    printOrWriteJson({ ok: false, error: String(error.stack || error) });
    process.exitCode = 1;
});

