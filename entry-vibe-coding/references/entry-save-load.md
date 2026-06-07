# Entry Save and Load

Use this reference for persistence workflows.

## Local Source of Truth

Always create a local JSON artifact from:

```js
const project = Entry.exportProject();
```

Reload it with:

```js
Entry.clearProject();
Entry.loadProject(project);
```

Then export again and compare:

- scene count
- object count
- variable/list/message/function count
- `speed`
- selected object names and first script

This is the most reliable automation path and does not require a PlayEntry account.

## UI Save Options

User docs describe header save options:

- save current project to "my projects" when logged in
- save as copy
- save to local computer as an Entry `.ent` file

Without login, only local computer save is available. Offline Entry has a different subset.

Source: `https://docs.playentry.org/user/header.html`

## Hybrid Strategy

Use this sequence:

1. Export JSON locally.
2. Run `scripts/entry_save_load_check.js` for load/export/reload verification.
3. Detect login state from the live page.
4. If not logged in, report server save/copy/load as skipped and keep the JSON artifact.
5. If logged in and the user requested server persistence, use UI automation to click save/copy/load and verify the loaded project by `Entry.exportProject()`.

Never request or handle a password. If login is needed, ask the user to log in manually in the browser and resume after that.

## Copy and Duplicate

There are two meanings:

- Project copy: header "save as copy" creates a separate server project when available.
- Object copy: object context menu can duplicate/copy/paste/export `.eo`.

For object duplication, prefer JSON-level duplication when the requested result is deterministic:

- generate new IDs
- copy sprite pictures/sounds
- copy script
- place in target scene
- offset position to avoid overlap

Then load/export and visually test.

## Import

For local JSON, use `Entry.loadProject(project)`.

For `.ent`, use the UI "offline project load" path only when the user specifically needs compatibility with the Entry file format. After import, immediately call `Entry.exportProject()` and save the JSON roundtrip artifact.
