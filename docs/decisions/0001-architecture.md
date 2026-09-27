# 0001: repo layout and the contracts every agent builds to

*Sutradhar, 24 September 2026, Wave 0. Status: accepted. Change it with a new decision, not by editing this one silently.*

## Layout

```
packages/
  tokens/     tokens.css (every custom property), tokens.js (JS mirror), palettes/, tools/palette-from-photo.mjs
  engine/     index.js re-exports src/*.js; pure helpers tested in Node
  core/       index.js, register.js, define-scene.js, scene-element.js (<sg-scene>)
  scenes/<n>/ model.js, render.js, meta.js, index.js, <n>.prompt.md, <n>.test.js, registry.json
  components/<n>/  the charter's component contract (from Wave 1)
  cli/        bin/susegad.mjs
registry/     registry.json (the index), schema.json
tools/        serve.mjs, shot.mjs, matrix.mjs, axe.mjs, perf.mjs, diff.mjs, harness/
apps/docs/    the documentation site
```

**Why relative imports, and why the CLI keeps the tree:** components are copied into a builder's project, shadcn-style. The CLI copies `packages/<x>/…` to `<target>/susegad/<x>/…`, preserving the tree, so a relative import like `../../engine/index.js` from `scenes/paus/render.js` still resolves after copying. No bundler, no bare specifiers, no import maps in library code.

## Runtime rules

- Plain ES modules, no dependencies, no build step for library code. JSDoc types.
- Tests use `node:test` and `node:assert/strict`, one `*.test.js` beside the code. `npm test` runs them all.
- Nothing in a pure module touches `window`, `document` or canvas. Side effects live in `render.js`, `*-element.js` and `engine/src/stage.js`-style edge modules.
- The dev server is `node tools/serve.mjs [port]`, serving the repo root. Pages import `/packages/...` by absolute path only in tools and apps, never in library code.

## Theme and register

- `data-theme="light|dark"` on `:root` (or absent, meaning follow `prefers-color-scheme`). Tokens are defined for both.
- `data-register="quiet|warm|playful"` on `:root` or any element. Default `warm`. The nearest ancestor wins; a `register` attribute on an element beats its ancestors.
- `core/register.js` exports `readRegister(el)`, `observeRegister(el, cb)` (fires when the element's effective register changes, including an ancestor's attribute) and `effectiveMotion(el)` returning `'still' | 'ambient' | 'full'`: reduced motion gives `'still'`; `quiet` gives `'still'` for scenes; `warm` gives `'ambient'`; `playful` gives `'full'`. Save-Data (`navigator.connection.saveData`) steps down one register.

## The scene contract, as code

A scene module's default export is the result of `defineScene(def)` from `core/define-scene.js`:

```js
defineScene({
  name: 'kolam',
  meta,        // { title, word, gloss, caption, W, H, techniques, prompt, map, credit, tier, stillTime }
  params: {    // attribute name = kebab-case of the key; values are coerced by type
    progress: { type: 'number', default: 0, min: 0, max: 1 },
    grid:     { type: 'int',    default: 5, min: 3, max: 9 },
  },
  model,          // pure: ({ time, seed, register, params, W, H }) => plain data, deterministic for a seed
  createRenderer, // (host, { W, H, register, motion, seed, governor }) => Renderer
  kind: 'canvas2d' | 'svg' | 'webgl',
});

// Renderer
{
  render(data, frame),   // frame = { time, dt, calm: [{ x, y, w, h }], pointer, quality }
  setRegister?(register, motion),
  resize?(),
  destroy(),
}
```

- `model` must run in Node. Heavy static geometry may be built once from `{ seed, params }` (a builder like `buildKolam(seed)`) and memoised; the per-frame part is still a pure function of time.
- `calm` rectangles are the slotted content's boxes in the scene's logical units. Renderers quieten motion inside and near them.
- `frame.quality` is the governor's level in `[0.25, 1]`.

## `<sg-scene>`

```html
<sg-scene name="paus" register="warm" seed="7" progress="0.4">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>
```

- Loads nothing by itself: the page imports `scenes/<name>/index.js`, which registers the definition. The element waits for its definition (like `customElements.whenDefined`).
- Observed attributes: `name`, `register`, `seed`, `paused`, `label`, plus every param's attribute. Changing an attribute calls `set()`. A server can swap an attribute (htmx) and the scene responds with no glue code.
- Methods: `play()`, `pause()`, `replay()`, `reseed(seed?)`, `set(params)`, `still()` (renders the finished still and stops), `destroy()`. Property `playing`.
- Pauses when off screen (IntersectionObserver) and when the tab is hidden. Runs the engine's governor.
- Reduced motion always shows the still; the scene still plays if the viewer presses play.
- Slotted content sits in a reading layer over the drawing with an automatic contrast scrim (token `--sg-scrim`) and reports its boxes as `calm` rects.
- The drawing is decorative for assistive technology (`role="img"` with `aria-label` from `label` or `meta.caption`); every state it shows (for example `progress`) is also exposed as text.
- Emits `sg-ready` once the first frame is drawn. For tools, the page sets `window.__ready = true` after `sg-ready`.

## Tool conventions

- The harness page is `tools/harness/scene.html?name=<n>&register=<r>&theme=<t>&seed=<s>&<param>=<v>`. It imports core and the scene, mounts one `<sg-scene>` in `#box`, exposes it as `window.__piece`, and sets `window.__ready`.
- Screenshots and reports go to `.shots/` (git-ignored) unless `--out` says otherwise. Curated screenshots that the review needs are copied into `docs/shots/wave-N/` and committed.

## Budgets (initial)

| Piece | JS bytes (unminified source, own files) | Frame |
|---|---|---|
| engine (all) | 52 KB (see 0002) | n/a |
| core | 28 KB (see 0004) | n/a |
| a scene | 40 KB | within 10% of the Paus baseline measured in the same run |
| a component | 12 KB behaviour + 8 KB per skin | 16.7 ms when animated |
