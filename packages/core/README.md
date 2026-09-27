# Core

The register, the scene contract and `<sg-scene>`. Plain ES modules, no dependencies beyond `../engine/index.js`. Importing `index.js` in a browser defines the element; in Node it only exports.

```html
<script type="module" src="susegad/scenes/kolam/index.js"></script>
<sg-scene name="kolam" seed="7">
  <h2>The door is open</h2>
  <p>Three rooms above the paddy.</p>
</sg-scene>
```

## The register (`register.js`)

| Export | What it does |
|---|---|
| `readRegister(el)` | The element's effective register: its own `register` or `data-register`, else the nearest ancestor's (through shadow roots), else `warm`. Save-Data and devices with 1 GB of memory or less step down one. |
| `effectiveMotion(el, { forScene = true })` | `'still'`, `'state'`, `'ambient'` or `'full'`. Reduced motion gives `'still'`. Quiet gives `'still'` for scenes and `'state'` for components (only the transitions state needs, under 200ms). Warm gives `'ambient'`, playful `'full'`. |
| `registerState(el)` | Everything at once: `{ register, declared, motion, reducedMotion, saveData, theme }`. |
| `observeRegister(el, cb)` | Calls `cb(registerState(el))` when any of that changes: an ancestor's attribute, `data-theme`, reduced motion, colour scheme, Save-Data. One shared MutationObserver serves every subscriber. Returns an unsubscribe. |
| `resolveRegister({ own, ancestors, reducedMotion, saveData, lowPower })`, `resolveMotion(register, opts)`, `stepDown`, `normalizeRegister` | The pure rules, tested in Node. |

## Scenes (`define-scene.js`)

`defineScene(def)` validates and registers a scene, and returns the frozen definition (a scene module's default export). `getScene(name)`, `whenSceneDefined(name)` and `sceneNames()` read the registry. The registry lives on `globalThis`, so two copies of core share it.

```js
defineScene({
  name: 'kolam',
  meta,                       // { title, alt, caption, keys?, W, H, seed?, stillTime?, prompt, map, credit, tier, ... }
  params: {
    progress: { type: 'number', default: null, min: 0, max: 1 },  // null default: "unset" means something
    grid:     { type: 'int', default: null, min: 3, max: 9 },
    palette:  { type: 'enum', default: 'auto', values: ['auto', 'flour', 'rangoli'] },
  },
  model,                      // ({ time, seed, register, params, W, H }) => plain data; may return { settled: true }
  createRenderer,             // (host, opts) => Renderer, see below
  kind: 'canvas2d',
  interactive: ['playful'],   // registers where the scene takes focus and pointer input
  status: p => p.progress === null ? '' : `${Math.round(p.progress * 100)}% done`,  // the short part only
});
```

Param types are `number`, `int`, `bool`, `string` and `enum`. Attribute names are the kebab-case of the keys. Values are coerced and clamped; unreadable values fall back to the default. A bare boolean attribute is true; `false`, `0`, `off` and `no` are false. The helpers are exported too: `coerceParam`, `paramsFromAttributes`, `mergeParams`, `defaultParams`, `coerceSeed`, `toKebab`, `toCamel`.

### The renderer

```js
createRenderer(host, { W, H, register, motion, seed, governor, scene, invalidate, advance }) => ({
  render(data, frame),        // frame: { time, dt, calm, pointer, quality, still, epoch, register, motion }
  setRegister?(register, motion),  // without it, the element makes a new renderer
  restyle?(),                 // the theme changed: re-read colours, repaint cached layers
  activate?(pointer),         // click, Enter or Space in an interactive register
  ready?,                     // a promise, for renderers that paint in time slices: sg-ready waits for it
  destroy(),
})
```

- `host` is the drawing layer inside the shadow root, already sized to `W / H` by `aspect-ratio`. Make the canvas with the engine's `stage(host, { W, H })`. The element puts the role on `host` itself: `img` normally, `application` (focusable) in an interactive register. Don't add focusable children or your own key listeners; the element turns keys into `frame.pointer` and calls `activate`.
- `invalidate()` asks for one redraw when the loop is not running (after a resize, for example).
- `advance(seconds)` moves the scene clock on. Kolam uses it so a pouring hand hurries the drawing while the model stays a pure function of time.
- `frame.calm` holds the slotted elements' boxes in logical units. Quieten motion inside and near them.
- `frame.pointer` is `{ x, y, inside, down, keyboard, travel }` in logical units. The arrow keys move it too (`keyboard: true`), so a renderer that answers the pointer answers the keys for free.
- `frame.epoch` goes up on `replay()` and `reseed()`: reset any interaction state when it changes.
- `frame.still` is true for the reduced-motion still.
- `readColors(el, { name: cssColor })` resolves tokens, `var()` fallbacks, `light-dark()` and OKLCH to hex for canvas code.

## `<sg-scene>` (`scene-element.js`)

Attributes: `name`, `register`, `seed`, `paused`, `label`, and every param. Changing any of them updates the scene with no glue code, so a server can swap them (htmx).

| Member | |
|---|---|
| `play()`, `pause()` | Start or stop motion. `play()` works under reduced motion too, when the viewer asks. |
| `replay()` | From the start, and play. |
| `reseed(seed?)` | A new drawing: the given seed, or the next one. |
| `set(params)` | Merge and coerce params. Calls made before the definition loads are kept and applied. |
| `still()` | Draw the finished still (`meta.stillTime`) and stop. |
| `destroy()` | Tear down for good. |
| `playing` | True while frames are running. Goes false off screen and in hidden tabs. |
| `wanted` | The viewer's intent: true after `play()`, false after `pause()` or `still()`, whatever the viewport. |
| `params`, `seed`, `meta` | Read-only. `meta.W` and `meta.H` are the logical units. |
| `lastPointer` | `{ x, y, inside, down, keyboard }` in logical units, the last pointer the renderer saw; `null` before any. The reading panel takes its own pointer events, so taps on the text don't reach it. |
| `sg-ready` event | After the first frame is drawn, and after `renderer.ready` settles when the renderer has one. Bubbles and is composed. |
| `sg-state` event | When `wanted` or the still changes. `detail: { wanted, still, playing }`. |

What it does for every scene:

- **Registers and motion.** Follows `registerState`. Quiet and reduced motion show the still. Moving into or out of quiet takes effect at once.
- **Pausing.** Off screen (IntersectionObserver), in a hidden tab, and when the model says `settled` (nothing will change until an input does). It wakes on `set()`, the pointer, keys or a register change.
- **Reading layer.** Slotted content sits over the drawing on a scrim. When the panel would cover more than 45% of the drawing's height (a phone, a wide scene), it moves below the drawing instead (the frame gets class `stacked`, and it goes back under 40%). Calm rects then only include text that still overlaps the drawing. The scrim is `--sg-scrim`, with text in `--sg-scrim-ink`, then `--sg-text`. Over the drawing the panel is placed with `--sg-reading-place` (default `end start`) and `--sg-reading-inset`. Style it through `::part(panel)`, `::part(reading)`, `::part(stage)` and `::part(toggle)`. The panel hides itself when nothing is slotted.
- **Calm rects.** A ResizeObserver measures the slotted elements and hands their boxes to the renderer.
- **Pause button.** A native `<button>` labelled "Pause animation" with `aria-pressed`, top right, in warm and playful whenever the scene can move (WCAG 2.2.2). Hidden in quiet and while settled.
- **Words.** The drawing is `role="img"` labelled by `label`, `meta.alt` or `meta.title`. State is spoken as the work, not the drawing: the scene's `status(params, meta)` returns only the short part (`"40% done"`, or `''` for nothing to say), and the element announces `${label}: ${status}` in a polite status region, where `label` is the `label` attribute or `meta.title`. So `<sg-scene name="kolam" progress="0.4" label="Upload progress">` says "Upload progress: 40% done". It writes at most once a second and only when the sentence changes, so nothing is repeated.
- **Keys.** In an interactive register the drawing is focusable (`role="application"`, described by `meta.keys`), with a two-tone focus ring. The arrow keys move the pointer (Shift for bigger steps); Enter and Space call `activate`.
- **A late name.** An `<sg-scene>` connected before it has a `name` mounts when the name arrives. Checked by `scene-element.check.mjs`.
- **Moves.** `moveBefore()` keeps it running (`connectedMoveCallback`). So does taking it out and putting it back in the same task, the `append()` fallback.
- **Quality.** The engine's governor sees every frame; `frame.quality` is its level in [0.25, 1].

## Components (`component.js`)

A separate registry item, `core-component` (decision 0005). Every `<sg-*>` component extends `SgElement` and is registered with `defineComponent(tag, Class)`.

```js
import { SgElement, defineComponent } from '../../core/component.js';

class SgProgress extends SgElement {
  static native = 'progress';                              // the native child it enhances: this.native
  static observedAttributes = ['register', 'label'];
  static skins = { quiet: () => import('./skins/quiet.js'), warm: …, playful: … };
  state() { return { /* plain data for the skin */ }; }
  connected() {}      // optional: after mount
  disconnected() {}   // optional: after teardown
}
defineComponent('sg-progress', SgProgress);
```

- A skin module exports `mount(el, ctx)`, which returns `{ update(state), destroy(), restyle?() }`. `ctx` is live: `host`, `native`, `register`, `motion` (`still`, `state`, `ambient` or `full`), `visible` and `emit`.
- `update()` batches into one microtask, then calls `skin.update(state())`. Any observed attribute change calls it.
- A register or motion change swaps the skin. A missing skin falls back to a quieter one, never a louder one. A theme change calls `restyle()`, or remounts when the skin has none.
- One shared IntersectionObserver sets `visible` and calls `update()`: animate only while `ctx.visible` is true. Reduced motion gives `motion === 'still'`.
- `moveBefore()` and a move within one task keep the skin running.
- `emit(name, detail)` dispatches a bubbling, composed event. After each skin mounts, the element fires `sg-skin` and sets `data-skin`. A skin that fails to load logs a warning, and the native element keeps working.
- **`hidden` always hides.** A component's own `display` rule would beat the browser's `[hidden]` rule, so `defineComponent` adds `tag[hidden] { display: none !important }` to one shared adopted stylesheet for every tag it defines. Components should also carry the rule in their own CSS, for pages without JavaScript. Checked by `component.check.mjs`.

## Where this differs from decision 0001

- `effectiveMotion` can also return `'state'`, for components in quiet.
- Params may default to `null`, meaning "unset". Kolam's `progress` needs it: when it is unset, time draws; when it is set, time stands still. 0001 showed `default: 0`.
- `createRenderer` also receives `scene`, `invalidate` and `advance`. Renderers may add `restyle` and `activate`. `frame` also carries `still`, `epoch`, `register` and `motion`. All of these are additions; the 0001 shapes still work.
- `defineScene` accepts `interactive` and `status`. Renderers may expose `ready`. The element adds `wanted`, `meta`, `lastPointer` and the `sg-state` event.
- `meta` may carry `alt`, `keys`, `seed` and `stillTime`.
- `readColors` and `registerState` are extra exports.
