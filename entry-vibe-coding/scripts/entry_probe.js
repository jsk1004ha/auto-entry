#!/usr/bin/env node
'use strict';

const {
    parseArgs,
    printOrWriteJson,
    summarizeProject,
    withEntryPage,
} = require('./entry_cdp_lib');

async function main() {
    const args = parseArgs(process.argv.slice(2));
    args.mode = args.mode || 'python';

    const report = await withEntryPage(args, async (page) => {
        const modeSummary = await page.getModeSummary();
        const details = await page.evaluate(
            `(() => {
                const project = Entry.exportProject();
                const q = (selector) => Array.from(document.querySelectorAll(selector)).slice(0, 30).map((el) => ({
                    tag: el.tagName,
                    id: el.id || '',
                    className: String(el.className || '').slice(0, 180),
                    text: (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 180),
                    title: el.getAttribute('title') || '',
                    aria: el.getAttribute('aria-label') || ''
                }));
                return {
                    url: location.href,
                    title: document.title,
                    readyState: document.readyState,
                    hasEntry: Boolean(window.Entry),
                    textCodingEnable: Entry.textCodingEnable,
                    entryKeys: Object.keys(Entry).slice(0, 120),
                    project,
                    bodyText: document.body.innerText.slice(0, 3000),
                    buttons: q('button'),
                    textareas: q('textarea'),
                    codeMirror: q('.CodeMirror, .CodeMirror-code, [class*=CodeMirror]'),
                    speedElements: q('[class*=Speed], [class*=speed]'),
                    canvases: q('canvas')
                };
            })()`,
            { timeout: 20000 }
        );

        return {
            ok: true,
            url: details.url,
            title: details.title,
            readyState: details.readyState,
            mode: modeSummary,
            textCodingEnable: details.textCodingEnable,
            projectSummary: summarizeProject(details.project),
            selectors: {
                buttons: details.buttons,
                textareas: details.textareas,
                codeMirror: details.codeMirror,
                speedElements: details.speedElements,
                canvases: details.canvases,
            },
            bodyTextSample: details.bodyText,
            entryKeys: details.entryKeys,
        };
    });

    printOrWriteJson(report, args.out);
}

main().catch((error) => {
    printOrWriteJson({ ok: false, error: String(error.stack || error) });
    process.exitCode = 1;
});
