# Entry Python Cookbook

Use this reference when authoring or modifying Entry Python.

## Verified Text Mode Shape

Open:

```text
https://playentry.org/ws/new?type=normal&mode=python&lang=ko
```

Verify:

```js
Entry.getMainWS().getMode() === 1
document.querySelector(".CodeMirror")?.CodeMirror
```

Default text mode code resembles this shape. Keep the first comment when generating new files because live parser sync has been more reliable with the default header present:

```python
# Entrybot object Python code

import Entry

def when_start():
    for i in range(10):
        Entry.move_to_direction(10)
```

## Editing CodeMirror

Use the live CodeMirror object:

```js
const cm =
  document.querySelector(".CodeMirror")?.CodeMirror ||
  Entry.getMainWS()?.vimBoard?.codeMirror;

cm.setValue(pythonSource);
cm.refresh();
const result = Entry.getMainWS().syncCode();
```

If `result` looks like `{ type: "syntax" }`, `{ type: "error" }`, or contains `title`, treat it as a failed parse and fix the Python before running.

Always export after sync:

```js
const project = Entry.exportProject();
```

Visible CodeMirror text is not proof that the block model changed.

## Safe Patterns

Start with event functions shown by the block palette:

```python
import Entry

def when_start():
    Entry.move_to_direction(10)

def when_press_key(key):
    Entry.move_to_direction(10)
```

Prefer block-palette snippets for exact function names. A robust workflow is:

1. Switch to Python mode.
2. Drag or inspect the block palette snippet in the live page.
3. Reuse that exact `Entry.*` function name.
4. Sync and export.

## Unsupported Blocks

EntryJS validates conversion to Python. It may remove or reject unsupported blocks, especially some extension, AI, hardware-lite, data table, or function-init blocks.

If Python conversion fails:

- keep the project in block mode and patch project JSON instead
- or simplify to supported blocks before switching to Python
- record the fallback in the final report

## Common Failure Modes

- URL `mode=python` can still finish in block mode during slow loads; explicitly check `getMode()`.
- `Entry.getMainWS().syncCode()` may fail due to Entry Python parser rules even when text resembles Python.
- Unknown `Entry.*` functions are not safe. Confirm function names from the palette or source.
- Running before syncing executes the previous block model.
