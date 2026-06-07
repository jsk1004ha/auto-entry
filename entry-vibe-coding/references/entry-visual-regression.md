# Entry Visual Regression

Use this reference when a generated Entry project needs screenshot-based QA.

## Capture Baseline

```powershell
node .\scripts\entry_apply.js --project .\project.json --python .\main.py --run-ms 1000 --screenshot .\baseline.png --out .\apply.json
```

## Compare

```powershell
node .\scripts\entry_visual_compare.js --baseline .\baseline.png --actual .\candidate.png --threshold 0.01 --pixel-threshold 16 --out .\visual-report.json
```

The script reports:

- dimensions
- mismatched pixel ratio
- mean absolute channel difference
- threshold pass/fail

## Live Candidate Capture

If `--actual` is omitted, the script can open PlayEntry, load a project, run it, capture a temporary screenshot, and compare:

```powershell
node .\scripts\entry_visual_compare.js --baseline .\baseline.png --project .\project.json --python .\main.py --run-ms 1000 --out .\visual-report.json
```

## Triage

- Dimension mismatch usually means viewport or device scale changed.
- High mismatch with correct dimensions usually means object positions, assets, or scene state changed.
- Low mismatch can be anti-aliasing, font rendering, or animation timing; rerun deterministic checks before accepting.

