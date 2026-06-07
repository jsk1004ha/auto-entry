# Entry UI Automation

Use this reference when the live API is insufficient and browser UI interaction is needed.

## Key Surfaces

Selectors observed in the live workspace:

- Stage canvas: `#entryCanvas`
- Object add button: `.entryAddButtonWorkspace_w`
- Run button: `.entryRunButtonWorkspace_w`
- Secondary run button: `.entryRunButtonWorkspace_w2`
- Stop button: `.entryStopButtonWorkspace_w`
- Speed button: `.entrySpeedButtonWorkspace`
- Coordinate grid button: `.entryCoordinateButtonWorkspace_w`
- Fullscreen button: `.entryMaximizeButtonWorkspace_w`
- Object list item: `.entryContainerListElementWorkspace`
- Selected object: `.selectedObject`
- Scene item: `.entrySceneElementWorkspace`
- Selected scene: `.selectedScene`
- Property tabs: `.propertyTabElement`, including object/helper/console surfaces
- CodeMirror in Python mode: `.CodeMirror`

These are implementation classes, not a formal public API. Re-probe before relying on them.

## Objects

Object list docs describe:

- click an object to select it
- edit name, X, Y, size, direction, and movement direction on selected object
- eye icon toggles visibility
- lock icon prevents deletion and property edits
- drag thumbnail to reorder
- right-click offers duplicate, delete, copy/paste, storage, and object export

Source: `https://docs.playentry.org/user/sub-space.html`

Prefer API/project JSON edits for:

- position
- size/scale
- visibility
- lock
- selected picture
- scene membership

Use UI only for workflows that must verify user-facing behavior.

## Shapes

Shape tab supports:

- shape list rename/delete/reorder
- duplicate and save to PC from context menu
- bitmap and vector paint modes
- shape upload
- new drawn shape

Use generated or user-provided SVG/PNG assets. Keep every object with at least one picture.

Source: `https://docs.playentry.org/user/tab_shape.html`

## Sounds

Sound tab supports:

- add sound
- rename/delete/reorder
- preview playback
- context menu duplicate/delete/save to PC
- trim mode
- adjustment mode for volume, speed, and pitch

Use MP3 assets up to 10 MB for upload workflows. Project JSON can reference hosted or existing file URLs, but local upload requires UI.

Source: `https://docs.playentry.org/user/tab_sound.html`

## Scenes

Scenes are represented in the top scene strip. Verify scene selection by `.selectedScene` and by exported object `scene` IDs.

Use multiple scenes for menus, levels, pages, or story beats. Confirm each scene has the expected object subset by inspecting `Entry.exportProject().objects`.

## Execution Screen

The stage coordinate system:

- center is `(0,0)`
- x is roughly `-240..240`
- y is roughly `-135..135`

Use screenshot checks after running the project:

1. Run project.
2. Wait for visible state change.
3. Capture `Page.captureScreenshot` or crop around `#entryCanvas`.
4. Stop project.
5. Export project and compare expected state.

Source: `https://docs.playentry.org/user/screen.html`
