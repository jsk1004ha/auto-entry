# Entry Asset Pipeline

Use this reference when adding local shapes or sounds to generated Entry projects.

## Command

```powershell
node .\scripts\entry_asset_pack.js --project .\project.json --object Player --image .\player.svg --sound .\jump.mp3 --out .\project-with-assets.json
```

## Strategy

The script stores local assets as data URLs inside project JSON. This is best for Codex automation because `Entry.loadProject(project)` can receive the whole project without relying on local filesystem URLs or PlayEntry uploads.

Use UI upload only when the user explicitly needs server-hosted assets.

## Constraints

- Object shape upload: `jpg`, `jpeg`, `png`, `bmp`, `svg`, `eo`; keep under 5 MB for object-level compatibility.
- Shape tab upload: `jpg`, `jpeg`, `png`, `bmp`, `svg`; keep under 10 MB.
- Sound upload: prefer `mp3`; keep under 10 MB.
- SVG and PNG dimensions are detected automatically. Other formats use a conservative default dimension.

## Verification

After packing:

1. Run `entry_static_check.js`.
2. Load with `entry_apply.js`.
3. Capture a screenshot.
4. Compare against a baseline if the visual appearance matters.

