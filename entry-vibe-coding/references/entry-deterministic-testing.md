# Entry Deterministic Testing

Use this reference when timing, game logic, or animation must be repeatable.

## Command

```powershell
node .\scripts\entry_determinism_check.js --project .\project.json --python .\main.py --speed 60 --run-ms 1000 --trials 3 --out .\determinism.json
```

## What It Checks

The script reloads the same prepared project for each trial, sets a fixed speed, runs for the same duration, and compares object snapshots:

- object id and name
- scene
- x/y
- direction and rotation
- visibility
- selected picture

Use a small tolerance for coordinates. Timing-dependent animations may need a higher tolerance or an event-based assertion instead of a wall-clock assertion.

## Pass Criteria

Accept the project when:

- each trial starts from the same state
- each trial ends in the same state within tolerance
- browser parser sync succeeds
- no engine state remains running after the test

