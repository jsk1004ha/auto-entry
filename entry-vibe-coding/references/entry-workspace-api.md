# Entry Workspace API

Use this reference when controlling a live PlayEntry editor tab.

## Runtime Facts

- Default block URL: `https://playentry.org/ws/new?type=normal&mode=block&lang=ko`
- Entry Python URL: `https://playentry.org/ws/new?type=normal&mode=python&lang=ko`
- The live page exposes `window.Entry` after loading.
- Core APIs verified on the live workspace:
  - `Entry.loadProject(project)`
  - `Entry.exportProject()`
  - `Entry.clearProject()`
  - `Entry.captureInterfaceState()`
  - `Entry.loadInterfaceState(interfaceState)`
  - `Entry.addEventListener(name, callback)`
  - `Entry.dispatchEvent(name, ...args)`
- `Entry.exportProject()` returns keys such as `objects`, `scenes`, `variables`, `messages`, `functions`, `tables`, `speed`, `interface`, `expansionBlocks`, `aiUtilizeBlocks`, and `hardwareLiteBlocks`.

Sources: `https://docs.playentry.org/entryjs/api/2024-02-29-api.html`, `https://docs.playentry.org/entryjs/typedef/2024-03-15-project-data.html`

## Mode Detection

Use this in the browser:

```js
const ws = Entry.getMainWS();
const mode = ws && ws.getMode();
```

Known modes from EntryJS source:

- `Entry.Workspace.MODE_BOARD === 0`
- `Entry.Workspace.MODE_VIMBOARD === 1`
- `Entry.Workspace.MODE_OVERLAYBOARD === 2`

Entry Python is `MODE_VIMBOARD` with:

```js
Entry.getMainWS().setMode(
  {
    boardType: Entry.Workspace.MODE_VIMBOARD,
    textType: Entry.Vim.TEXT_TYPE_PY,
    runType: Entry.Vim.WORKSPACE_MODE,
  },
  undefined,
  true
);
```

Re-check that `Entry.getMainWS().getMode() === 1` and a CodeMirror instance exists before editing text.

Source: `https://github.com/entrylabs/entryjs/blob/develop/src/playground/workspace.js`

## Running and Stopping

Use the engine API:

```js
Entry.engine.toggleRun();
await new Promise((resolve) => setTimeout(resolve, 1000));
await Entry.engine.toggleStop();
```

Useful checks:

```js
Entry.engine.state;              // "stop", "run", "pause", or "stopping"
Entry.container.getAllObjects(); // object entities and scripts
Entry.exportProject();           // durable project snapshot
```

If the project is already running, `Entry.engine.run()` toggles to stop; use explicit `toggleRun` / `toggleStop` in scripts.

## Speed Control

EntryJS source defines:

```js
Entry.engine.speeds; // [1, 15, 30, 45, 60]
Entry.engine.setSpeedMeter(30);
Entry.FPS;           // 30
Entry.tickTime;      // Math.floor(1000 / Entry.FPS)
```

The user docs describe the UI as a 1-5 level speed button. The underlying project field stores FPS as `project.speed`.

Sources: `https://docs.playentry.org/user/screen.html`, `https://github.com/entrylabs/entryjs/blob/develop/src/class/engine.js`

## Browser Automation Preference

Prefer `scripts/entry_*` from this skill. They use:

- a temporary Chrome profile
- a local remote debugging port
- native Node `fetch` and `WebSocket`
- CDP `Runtime.evaluate`, `Page.navigate`, and `Page.captureScreenshot`

Do not attach automation to the user's everyday Chrome profile unless explicitly requested.
