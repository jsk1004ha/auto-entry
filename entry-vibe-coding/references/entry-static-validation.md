# Entry Static Validation

Use this reference before opening PlayEntry or before reporting a generated project.

## Command

```powershell
node .\scripts\entry_static_check.js --project .\project.json --python .\main.py --strict-entry-api --out .\static-check.json
```

## Project Checks

The checker verifies:

- root JSON object exists
- `speed` is one of `[1, 15, 30, 45, 60]`
- `scenes`, `objects`, `variables`, `messages`, `functions`, and `tables` are arrays when present
- scene IDs and object IDs are unique
- every object references an existing scene
- sprite objects have pictures and a valid `selectedPictureId`
- entity coordinates and dimensions are numeric
- pictures have `id`, `name`, `fileurl`, and dimensions
- sounds have supported extensions and reasonable sizes when embedded as data URLs

## Python Checks

The checker:

- runs local Python syntax compilation when Python is available
- verifies `import Entry`
- warns when no `when_*` event function exists
- warns or fails on unknown `Entry.*` functions depending on `--strict-entry-api`
- reports strings that look like object or scene names but do not match project entities

## Failure Policy

Fix `errors` before browser execution. Treat `warnings` as risk notes unless the user asked for production-grade reliability; then resolve or explicitly justify them.

