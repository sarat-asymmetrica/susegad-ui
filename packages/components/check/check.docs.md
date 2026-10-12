# Checkbox

`<sg-check>` wraps one native `<input type="checkbox">` and its label. Everything a checkbox does, the input does, with or without JavaScript.

## Use

```html
<link rel="stylesheet" href="susegad/components/check/check.css">
<script type="module" src="susegad/components/check/check.js"></script>

<sg-check>
  <label><input type="checkbox" name="extras" value="breakfast" checked> Breakfast on the balcão</label>
</sg-check>
```

A label beside the input (`<input id="x"><label for="x">`) also works.

### Select all

```html
<sg-check controls="x-breakfast x-pickup x-late">
  <label><input type="checkbox" id="x-all"> All extras</label>
</sg-check>
<sg-check><label><input type="checkbox" id="x-breakfast" name="extras" value="breakfast"> Breakfast</label></sg-check>
...
```

Give the "select all" input no `name`, so it is not sent with the form. Without JavaScript it is an ordinary checkbox that does nothing, so for a page that must work without scripts, leave it out or render it only when scripts run.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `indeterminate` | boolean attribute | absent |
| `controls` | space-separated ids of child checkboxes | none |
| `seed` | any string, for the drawn marks | the label |
| `register` | `quiet`, `warm`, `playful` | inherited |
| `checked` (property) | boolean; setting it fires `change` | the input's |

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | hairline box, crisp tick, a bar for "some" | the tick scales in under 200ms |
| warm | a box sketched in four pencil strokes whose corners cross, a heavy pencil tick, a pencil dash | the tick is drawn in over 280 ms when ticked |
| playful | a rubber-stamp block (a heavy inked edge and a fine inner rule); a bold stamped tick, cut bigger than the box and printed through the Wave 1 stamp's ink texture, with ink spots | the stamp presses down past flat and settles |

Reduced motion: marks appear with no movement. Forced colours: the system checkbox.

## Accessibility

- Keyboard: Tab to it, Space to tick. Nothing added, nothing taken away.
- A screen reader hears the label and "checked", "not checked" or "mixed".
- Required: use `required` on the input. The browser stops the form and says why.
- Contrast: box edge, pencil and tick are 3:1 or more on every surface (WCAG 1.4.11), tested for every palette and theme.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The pencil box and tick in warm and playful are `aria-hidden` drawings over the native input, and the label is the name. `packages/components/check/check.check.mjs`: "the drawing is hidden from assistive tech" in warm and playful. |
| 1.3.1 Info and relationships | Meets | A native `<input type="checkbox">` inside its `<label>`, groups in a `<fieldset>` with a `<legend>`. `check.check.mjs`: "no JS: Space ticks it", and "some children on: All extras is mixed, and says so" reads the accessibility tree. |
| 1.3.5 Identify input purpose | Not applicable | A checkbox holds a choice, not personal data that has a WCAG input purpose (the 53 `autocomplete` tokens), so the criterion does not apply. |
| 1.4.1 Use of color | Meets | State is the tick, the dash for mixed, or the stamp, never colour alone: `packages/components/check/check.test.js`, "the pencil tick is deterministic, stays in its box" and "the stamp: a closed filled tick"; `check.check.mjs`: "Space ticks it and the drawing follows" in each register. |
| 1.4.3 Contrast (minimum) | Meets | The label is page text in `--sg-text`, tested at 4.5:1 on every surface in `packages/tokens/tokens.test.js`. axe `color-contrast` is clean: `tools/axe.mjs --url /packages/components/check/demo.html`: 0 violation(s) across 6 run(s) (three registers, light and dark, desktop), 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-06: the demo with the root font size at 200 percent in three registers (1280 px wide), no sideways scroll and no clipped label (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px, three registers, 2026-10-06: no sideways scroll and no clipped label (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.11 Non-text contrast | Meets | `packages/components/check/check.test.js`: "1.4.11: <palette> <theme>: the box edge and the tick are 3:1 or more" on every surface, every palette, light and dark. The focus ring is tested 3:1 or more in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-06: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text (throwaway Playwright script). `check.check.mjs` also keeps the box level with Marathi, Kannada and Konkani labels. |
| 2.1.1 Keyboard | Meets | `check.check.mjs`: "no JS: Space ticks it", "Space ticks it and the drawing follows" in each register, and ticking or clearing "All extras" with the keyboard. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/check/check.js` binds no `keydown` and sets no `tabindex`; the native input takes Tab and Shift+Tab as any checkbox does. |
| 2.4.3 Focus order | Meets | Manual test: the native input is the only tab stop and keeps its place in the page's order; the drawing takes no focus (`packages/components/check/check.js` sets no `tabindex`). |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the control in each register and requires a focus style; the rule is `input[type="checkbox"]:focus-visible` in `packages/components/check/check.css`. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/check/check.css` has no `position: fixed` or `sticky` and no overlay. A sticky header or banner the page adds can cover a box that is scrolled to. |
| 2.5.3 Label in name | Meets | The accessible name is the visible label text, because the label wraps the input and the component adds no `aria-label` (`check.check.mjs` reads the box by that label in the accessibility tree). |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-06: the click target is the whole `<label>`, not only the box. The box alone is 20.7 by 20.7 px at 1280 px and 18.5 by 18.5 px at 390 px, but the label is 28.8 px tall at 1280 px and 25.7 px tall at 390 px on one line, at least 90 px wide, in the demo (throwaway Playwright script). The label must stay around the input. |
| 3.2.2 On input | Meets | `check.check.mjs`: the form submits only when the page's own button is pressed, and a "select all" box changes the children it names and nothing else, which its label says ("All extras"). |
| 3.3.1 Error identification | Meets with author's part | `required` is the native attribute: `check.check.mjs`: "no JS: a required box left clear stops the form" and "no JS: the browser marks it invalid". The browser says why in its own words; a page that writes its own error message owns putting it in text next to the box. |
| 3.3.2 Labels or instructions | Meets with author's part | The native `<label>` is the name (`packages/components/check/check.check.mjs` reads each box by its label). The label text and any instruction are the author's. |
| 4.1.2 Name, role, value | Meets | `check.check.mjs`: a checkbox with its label, `mixed` for a select-all box with some children on, and `checked` as the native one; axe: 0 violation(s), `tools/axe.mjs --url /packages/components/check/demo.html`, 2026-10-07. |

**The page author owns:**

- The label text, in the language of the page, inside the `<label>` that wraps the input, and `lang` on a label in another language (3.1.2).
- A `<fieldset>` and `<legend>` for a group of boxes.
- Any error text the page writes for a `required` box, next to the box (3.3.1).
- Sticky headers and banners that could cover a box when it takes focus (2.4.11).
- The colours the page sets behind the box, if it overrides the tokens.

## Budget

Behaviour 8.6 KB of 12 KB (`check.js` + `check.core.js`); skins 0.3, 2.2 and 1.9 KB.
