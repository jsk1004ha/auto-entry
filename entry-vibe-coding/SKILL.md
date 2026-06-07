---
name: entry-vibe-coding
description: Build, inspect, automate, test, save, copy, and reload PlayEntry / EntryJS projects through the live PlayEntry workspace and Entry Python text coding mode. Use when Codex is asked to vibe-code Entry projects, compile natural-language requests into Entry project JSON and Entry Python, statically validate projects, manage objects/shapes/sounds/assets/attributes/scenes, work with .ent-like exports, test visual regressions or deterministic execution, control execution speed, or verify PlayEntry behavior in Chrome.
---

# Entry Vibe Coding

## Overview

Use this skill to turn a user request into a working PlayEntry project through the browser-accessible EntryJS runtime. Prefer live `Entry` APIs and project JSON for reliable automation, then use UI automation for save/load and visual checks that do not have a stable public API.

Primary sources:
- PlayEntry workspace: `https://playentry.org/ws/new?type=normal&mode=python&lang=ko`
- Entry user docs: `https://docs.playentry.org/user/`
- EntryJS docs: `https://docs.playentry.org/entryjs/`
- EntryJS source: `https://github.com/entrylabs/entryjs`

## Workflow

1. Clarify the project outcome only when the user request is genuinely ambiguous. Otherwise generate a small project plan with objects, scenes, variables/lists/signals/functions, sounds, and acceptance checks.
2. For broad requests, run `scripts/entry_compile.js` first to produce a starter project JSON, Entry Python source, and acceptance plan. Refine the generated artifacts instead of starting from an empty workspace.
3. Run `scripts/entry_static_check.js` before opening the browser. Fix structural errors, broken scene/object references, missing selected pictures, asset size violations, and risky Entry Python calls.
4. Open PlayEntry with `mode=python` and verify the runtime with `scripts/entry_probe.js`. If `Entry.getMainWS().getMode()` is not `1`, switch with the procedure in `references/entry-workspace-api.md`.
5. Prefer constructing or editing project JSON, then load it with `Entry.loadProject(project)`. Use Entry Python when the requested behavior maps cleanly to supported Entry Python blocks.
6. After any text edit, call `Entry.getMainWS().syncCode()` before running or exporting. Treat parser return objects with `type: "syntax"` or `type: "error"` as failures to fix.
7. Run the project with `Entry.engine.toggleRun()`, wait long enough to observe state changes, capture a screenshot if useful, then stop with `Entry.engine.toggleStop()`.
8. Export with `Entry.exportProject()` and save the resulting JSON as the durable local artifact. Exercise UI save/copy/load only when an authenticated PlayEntry session is already present.
9. For repeatable quality checks, run deterministic execution and visual regression scripts before reporting completion.

## Automation Scripts

Run scripts from this skill folder with Node 24+ or the bundled Codex Node runtime. They use Chrome DevTools Protocol directly and do not require Playwright.

- `scripts/entry_probe.js`: verify page load, runtime APIs, mode, project summary, CodeMirror, speed controls.
- `scripts/entry_compile.js`: compile natural-language project requests into starter project JSON, Entry Python, and an acceptance plan.
- `scripts/entry_static_check.js`: validate project structure, object/scene/asset references, and Entry Python syntax/API risk before browser execution.
- `scripts/entry_asset_pack.js`: inject local image and sound files into a project as self-contained data URLs.
- `scripts/entry_apply.js`: load project JSON and/or Entry Python, set speed, run/stop, export project JSON, capture screenshot.
- `scripts/entry_speed_matrix.js`: test speed levels `[1,15,30,45,60]` and report `Entry.FPS`, `Entry.tickTime`, export speed, and motion delta.
- `scripts/entry_save_load_check.js`: load/export/reload a project locally and optionally preflight authenticated server save/load capability.
- `scripts/entry_server_probe.js`: map login state, storage keys, relevant network resources, and save/load globals without requiring credentials.
- `scripts/entry_visual_compare.js`: compare screenshots by pixel mismatch ratio, or capture a live screenshot and compare it to a baseline.
- `scripts/entry_determinism_check.js`: run repeated trials at a fixed speed and compare object state snapshots.

Example:

```powershell
node .\scripts\entry_probe.js --mode python --out .\probe.json
node .\scripts\entry_compile.js --prompt "simple dodging game with score" --out-project .\project.json --out-python .\main.py --out-plan .\plan.json
node .\scripts\entry_static_check.js --project .\project.json --python .\main.py --out .\static-check.json
node .\scripts\entry_speed_matrix.js --mode block --run-ms 1200 --out .\speed-report.json
```

## References

Load only the reference needed for the current task:

- `references/entry-workspace-api.md`: live Entry globals, mode switching, run/stop, speed, screenshots.
- `references/entry-project-schema.md`: project JSON shape for scenes, objects, entity properties, pictures, sounds, attributes.
- `references/entry-python-cookbook.md`: Entry Python workflow, safe syntax, CodeMirror editing, parser errors.
- `references/entry-ui-automation.md`: UI selectors for objects, shapes, sounds, scenes, speed, console, and screenshots.
- `references/entry-save-load.md`: local JSON/.ent-style persistence, server save/copy/load constraints.
- `references/entry-speed-testing.md`: execution speed research, FPS mapping, and validation matrix.
- `references/entry-natural-language-compiler.md`: natural-language-to-project compilation strategy and refinement loop.
- `references/entry-static-validation.md`: structural and Python validation rules before live execution.
- `references/entry-asset-pipeline.md`: self-contained image/sound packing and asset constraints.
- `references/entry-server-api.md`: safe server API probing, save/copy/load boundaries, auth handling.
- `references/entry-visual-regression.md`: screenshot baseline capture, pixel comparison, and failure triage.
- `references/entry-deterministic-testing.md`: fixed-speed repeated-run checks and state comparison.

## Guardrails

- Do not ask for PlayEntry passwords or create accounts. Use server save/load only when the browser session is already logged in.
- Preserve copyright boundaries for uploaded shapes and sounds. User-provided or generated assets are safer than copying protected media.
- Keep project JSON as the source of truth. Use `.ent` UI export/import as a compatibility path, not the only saved artifact.
- After changing Entry Python, always sync and inspect `Entry.exportProject()`; text visible in CodeMirror is not enough.
- If Entry Python cannot represent a requested block, fall back to project JSON or block-mode APIs and document the fallback.
