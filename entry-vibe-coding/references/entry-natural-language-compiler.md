# Entry Natural Language Compiler

Use this reference when converting a loose user request into concrete Entry artifacts.

## Goal

Create three artifacts before live browser work:

- project JSON with scenes, objects, shapes, sounds, attributes, and speed
- Entry Python source for behavior that maps to known safe Entry Python functions
- acceptance plan describing expected runtime and visual checks

Run:

```powershell
node .\scripts\entry_compile.js --prompt "dodging game with score and obstacles" --out-project .\project.json --out-python .\main.py --out-plan .\plan.json
```

## Compilation Stages

1. Classify the request: game, animation/story, quiz, simulation, or utility.
2. Extract required nouns into objects. If the request is vague, create a small starter set: Player, Goal, and optional Hazard/Score.
3. Extract scene words: intro, stage, level, question, result, ending. Use one scene unless the user implies screen changes.
4. Extract attributes: score, timer, lives, question index, state flags. Add them to the plan even when the exact Entry block representation needs live confirmation.
5. Generate only safe Entry Python by default. Prefer `Entry.move_to_direction` until live block-palette inspection confirms more functions.
6. Run static validation, browser sync, export, deterministic tests, and visual comparison.

## Refinement Rule

Treat compiler output as a starter, not final truth. After loading it into PlayEntry:

- inspect `Entry.exportProject()`
- keep generated IDs stable where possible
- patch object names, pictures, sounds, and scenes in JSON
- patch behavior in Entry Python only after parser sync succeeds

## Acceptance Plan Contents

Include:

- object list and scene list
- requested controls or interactions
- speed/FPS assumption
- expected object movement or visible state change
- screenshot requirement
- deterministic repeated-run requirement when physics/timing matters

