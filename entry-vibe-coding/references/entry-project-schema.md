# Entry Project Schema

Use this reference when generating, reviewing, or patching project JSON.

## Project Root

`Entry.exportProject()` produces a JSON object containing the whole workspace:

```js
{
  speed: 60,
  objects: [],
  variables: [],
  messages: [],
  functions: [],
  scenes: [],
  interface: {},
  tables: [],
  expansionBlocks: [],
  aiUtilizeBlocks: [],
  hardwareLiteBlocks: []
}
```

`speed` is the execution FPS. Use one of `[1,15,30,45,60]` unless a specific imported project already uses another value.

Source: `https://docs.playentry.org/entryjs/typedef/2024-03-15-project-data.html`

## Scenes

Scenes group objects and code:

```js
{ id: "scene1", name: "Scene 1" }
```

User docs describe a project as scenes containing objects. Use multiple scenes when the request has distinct levels, screens, pages, or narrative stages.

Source: `https://docs.playentry.org/user/what-is-project.html`

## Objects

Minimal sprite object shape:

```js
{
  id: "obj1",
  name: "Player",
  objectType: "sprite",
  scene: "scene1",
  lock: false,
  rotateMethod: "free",
  selectedPictureId: "pic1",
  script: "[]",
  sprite: {
    pictures: [],
    sounds: []
  },
  entity: {
    x: 0,
    y: 0,
    regX: 50,
    regY: 50,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    direction: 90,
    width: 100,
    height: 100,
    visible: true
  }
}
```

Important object fields:

- `objectType`: `"sprite"` or `"textBox"`
- `rotateMethod`: `"free"`, `"vertical"`, or `"none"`
- `entity.x/y`: stage coordinates; x range is usually `-240..240`, y range `-135..135`
- `entity.rotation`: visual rotation
- `entity.direction`: movement direction
- `script`: block script data; live exports often store this as a JSON string

Source: `https://docs.playentry.org/entryjs/typedef/2024-03-15-object-data.html`

## Pictures and Shapes

Each object has at least one picture.

```js
{
  id: "pic1",
  name: "idle",
  fileurl: "https://...",
  thumbUrl: "https://...",
  imageType: "svg",
  dimension: { width: 144, height: 246 }
}
```

Supported upload formats in the UI:

- object shape upload: `jpg`, `png`, `bmp`, `svg`, `eo`, up to 5 MB
- shape tab upload: `jpg`, `png`, `bmp`, `svg`, up to 10 MB
- bitmap formats open in bitmap mode; SVG opens in vector mode

Sources: `https://docs.playentry.org/user/popup_object.html`, `https://docs.playentry.org/user/tab_shape.html`

## Sounds

Sound list entries:

```js
{
  id: "sound1",
  name: "beep",
  fileurl: "https://...",
  duration: 1.2,
  ext: ".mp3"
}
```

The UI supports MP3 uploads up to 10 MB. Sound blocks can play immediately, play for a duration, play and wait, control global volume, control playback rate, stop sounds, and play background music.

Sources: `https://docs.playentry.org/user/tab_sound.html`, `https://docs.playentry.org/user/block_sound.html`

## Attributes

Entry attributes are managed in `variables`, `messages`, and `functions`.

- Variables store one value and may be global, cloud, realtime, or object-local.
- Lists store ordered items and may be global, cloud, realtime, or object-local.
- Messages/signals coordinate timing between objects.
- Functions package repeated block behavior.

Source: `https://docs.playentry.org/user/tab_attribute.html`

## Stable Authoring Rule

For generated projects, first load a known-good default project with `Entry.getStartProject()` or export a live default project, then patch it. This avoids guessing internal block IDs, field shapes, and asset defaults.
