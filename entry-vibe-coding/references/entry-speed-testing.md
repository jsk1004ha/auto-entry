# Entry Speed Testing

Use this reference when the user asks about execution speed or when timing matters.

## Findings

Official user docs expose a 1-5 level speed button on the execution screen. EntryJS source maps those levels to FPS:

```js
Entry.engine.speeds; // [1, 15, 30, 45, 60]
```

`setSpeedMeter(FPS)` updates:

```js
Entry.tickTime = Math.floor(1000 / FPS);
Entry.FPS = FPS;
```

Project JSON stores `speed` as a number representing FPS.

Sources:

- `https://docs.playentry.org/user/screen.html`
- `https://docs.playentry.org/entryjs/typedef/2024-03-15-project-data.html`
- `https://github.com/entrylabs/entryjs/blob/develop/src/class/engine.js`

## Test Matrix

Run:

```powershell
node .\scripts\entry_speed_matrix.js --mode block --run-ms 1200 --out .\speed-report.json
```

Expected assertions:

- each requested speed is accepted
- `Entry.FPS` equals the requested FPS
- `Entry.tickTime` equals `Math.floor(1000 / FPS)`
- exported `project.speed` follows the selected FPS
- a simple default project has greater movement at higher FPS over the same wall-clock time

Do not require exact movement deltas. Browser scheduling, project logic, and finite repeat loops can cap or vary movement.

## Manual UI Check

When visual confirmation is needed:

1. Click `.entrySpeedButtonWorkspace`.
2. Confirm `.entrySpeedBox` and `.progressCell` elements exist.
3. Click each progress cell.
4. Read `Entry.FPS` and `Entry.tickTime`.
5. Run a short project and observe block execution pace.

## Reporting

Report both:

- user-facing speed level, if relevant
- underlying FPS value

Example: "Speed level 5 corresponds to 60 FPS; speed level 1 corresponds to 1 FPS."
