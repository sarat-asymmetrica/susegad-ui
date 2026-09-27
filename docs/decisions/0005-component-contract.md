# 0005: the component contract, as code

*Sutradhar, 24 September 2026, before Wave 1. Status: accepted. The first Wave 1 builder (Progress) implements `core/component.js`; everyone else builds against this page. If it turns out wrong, the Progress builder says so and we write 0006.*

## Enhance a native element

A component is a light-DOM custom element that **wraps and enhances a native element**. The native element carries the semantics, keyboard behaviour and form participation; the skin adds a decorative layer that is `aria-hidden`.

```html
<sg-progress label="Uploading photos">
  <progress value="0.4" max="1">40%</progress>
</sg-progress>
```

- Without JavaScript, the native element still works and is styled by `<name>.css` (the quiet look). That is the progressive-enhancement path.
- When the component needs content the native element can't hold (a toast's message, an empty state's action), it uses light-DOM children, never shadow DOM for content. Shadow DOM is not used by components; they must be styleable by the builder who owns the copied source.
- Where no native element fits (a toast region, a badge), use the right ARIA: `role="status"`/`aria-live="polite"` for toasts and saving states, `role="alert"` only for errors that need attention now.

## Files (from the charter)

```
packages/components/<name>/
  <name>.js          behaviour + custom element; imports ../../core/component.js
  skins/quiet.js     each skin: { mount(el, ctx) => { update(state), destroy() } } — may be tiny
  skins/warm.js
  skins/playful.js
  <name>.css         layout and the three registers via [data-register] / :is() selectors, token-based
  <name>.prompt.md   the prompt and the words-to-code map
  <name>.test.js     pure-core tests (node:test)
  <name>.docs.md     usage, attributes, events, accessibility notes, examples
  registry.json      { name: "<name>", type: "component", files, dependencies, registers, budget }
```

- Pure logic (state machines, formatting, timing, geometry of ornaments) lives in `<name>.js` exports or a `<name>.core.js`, testable in Node.
- Skins are loaded lazily by register: `import(`./skins/${register}.js`)`, so a quiet page never downloads the playful skin.
- A skin draws with SVG (animated by WAAPI so `getAnimations()` can pause it) or a small canvas via the engine. Paint once and cache; pause off screen.

## `core/component.js`

```js
import { SgElement, defineComponent } from '../../core/component.js';

class SgProgress extends SgElement {
  static observedAttributes = ['label', 'value', 'max', 'register'];
  static skins = { quiet: () => import('./skins/quiet.js'), warm: …, playful: … };
  state() { /* plain data derived from the native element + attributes */ }
}
defineComponent('sg-progress', SgProgress);
```

`SgElement` gives every component:
- `this.register`, `this.motion` (`still | state | ambient | full` from `effectiveMotion(el, { forScene: false })`), updated through `observeRegister`; a register change swaps the skin.
- `this.native`: the first native child it enhances (`static native = 'progress'`).
- `this.skin`: the mounted skin; `this.update()` recomputes `state()` and calls `skin.update(state)` in a microtask (batched).
- Off-screen pause via one shared IntersectionObserver (`this.visible`), and `connectedMoveCallback` so a move doesn't restart it.
- Reduced motion: skins get `ctx.motion === 'still'` and must render the finished state.
- `this.emit(name, detail)` for bubbling `sg-*` events.

Budget: `core/component.js` ≤ 6 KB of source. It's a separate registry item, `core-component`, depending on `core`.

## Registers for components

| | quiet | warm | playful |
|---|---|---|---|
| Look | the native element styled with hairline pencil rules, tokens only | hand-drawn detail visible up close | motifs, colour, delight |
| Motion | `state`: only what state requires, under 200 ms | slow and ambient, one living thing per screen | spring and overshoot allowed |
| Sound | none except confirmations (Wave 4) | soft | full |

Quiet must pass a conservative auditor with no flourish. Every register passes axe with zero violations, light and dark.

## Honesty

A determinate indicator moves only when its value changes. An indeterminate one says what is happening in text (`aria-valuetext` or the label). No fake progress, no timers pretending to be work.

## Budgets

12 KB of source for behaviour (`<name>.js` + core), 8 KB per skin. Animated skins hold 16.7 ms per frame and stay within 10% of the Paus baseline in the same perf run.

## Verification per component

The tools take `--url`: each component ships a `demo.html` beside it (not copied by the CLI) that shows every state, used by the matrix, axe and perf. `tools/matrix.mjs --url /packages/components/<name>/demo.html`.

Each `demo.html` starts with `<script src="/tools/harness/demo.js"></script>` in `<head>`: it applies `?register`, `?theme` and `?palette` (which the matrix, axe and perf tools pass), links the fonts and tokens, and sets `window.__ready` once the page's `sg-*` elements are upgraded. A demo has one `<h1>`, a `lang`, and shows every state of the component.

*Addendum (Wave 2):* each `demo.html` also links `/packages/tokens/fonts.css` and `/packages/tokens/tokens.css` statically right after the `demo.js` script, so the page is styled with JavaScript off (`tools/matrix.mjs --no-js`). `demo.js` skips links that are already there.
