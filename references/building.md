# Building a new piece

*Reference file for [`SKILL.md`](../SKILL.md), split out in rung 7 of docs/requests/2026-09-28-open-the-door.md so the top file stays short. Content moved verbatim; nothing here is new.*

## 10. Build a new piece

Read `docs/CHARTER.md` and `docs/decisions/0001-architecture.md` first. In brief:

**A scene (contract v2)** lives in `packages/scenes/<name>/` as `model.js`, `render.js`, `meta.js`, `index.js`, `<name>.prompt.md`, `<name>.test.js` and `registry.json`.

- `model({ time, seed, register, params, W, H })` is pure: plain data out, deterministic for a seed, runs in Node, never touches `window`, `document` or a canvas. It may return `{ settled: true }` when nothing will change until an input does.
- `createRenderer(host, { W, H, register, motion, seed, governor, scene, invalidate, advance })` returns `{ render(data, frame), setRegister?, restyle?, activate?, ready?, destroy() }`. It owns every side effect. Draw with the engine's `stage(host, { W, H })`. Quieten motion in and near `frame.calm`, follow `frame.quality`, reset interaction when `frame.epoch` changes.
- `index.js` default-exports `defineScene({ name, meta, params, model, createRenderer, kind, interactive, status })`. Params are typed (`number`, `int`, `bool`, `string`, `enum`) and may default to `null` for "unset". `status(params, meta)` returns only the short part of what a screen reader hears, such as "40% done", or `''` when there is nothing to say. The element puts the label in front. Import `defineScene` from `../../core/index.js`, so loading the scene alone defines `<sg-scene>`.
- `meta` carries `title`, `word`, `gloss`, `caption`, `alt`, `keys` (if interactive), `W`, `H`, `stillTime`, `techniques`, `prompt`, `map`, `credit` and `tier`.
- Three registers, a finished still for reduced motion, a calm reading zone, and a byte budget in `registry.json` (40 KB by default, up to 64 KB with a one-line reason).

**A component** (decision 0005) is one folder in `packages/components/<name>/`: `<name>.js` (behaviour and the custom element), pure logic in `<name>.js` exports or `<name>.core.js`, `skins/quiet.js`, `skins/warm.js`, `skins/playful.js`, `<name>.css`, `<name>.prompt.md`, `<name>.test.js`, `<name>.docs.md`, a `demo.html` that shows every state, and `registry.json` (`type: "component"`, depending on `core-component`).

- Extend `SgElement` from `../../core/component.js` and register with `defineComponent(tag, Class)`. Light DOM only, never shadow DOM for content, so the builder who copies it can style everything.
- Enhance a native element (`static native = 'progress'`): it keeps the role, the keyboard, the form behaviour and the no-JavaScript look. Where none fits, use `role="status"` for news and `role="alert"` only for errors that need attention now.
- Skins are `{ mount(el, ctx) => { update(state), destroy() } }`, loaded lazily per register. They draw `aria-hidden` SVG (animated with the Web Animations API, so it can be paused) or a small engine canvas. `ctx.motion === 'still'` means show the finished state; `ctx.visible` false means pause.
- Keep every string people read in one `STRINGS` object, with quiet, warm and playful variants where the register changes the words.
- Budget: 12 KB of behaviour plus 8 KB per skin, and 16.7 ms a frame when animated. It is not done until it has been used in at least one recipe.

**The prompt and the map.** Every piece ships with one rich paragraph you could give an AI agent to make it, specific about technique and about feeling, and a table from phrases in that paragraph to the technique and one or two plain sentences on what the code does. Check every number in the map against the code.
