# Radio group

`<sg-radio-group>` wraps a `<fieldset>` of native radios. The fieldset, the legend and the radios do all the work, with or without JavaScript.

## Use

```html
<link rel="stylesheet" href="susegad/components/radio/radio.css">
<script type="module" src="susegad/components/radio/radio.js"></script>

<sg-radio-group>
  <fieldset>
    <legend>Arriving by</legend>
    <label><input type="radio" name="arrive" value="car" required> Car</label>
    <label><input type="radio" name="arrive" value="train" required> Train to Thivim</label>
    <label><input type="radio" name="arrive" value="boat" disabled> Boat (closed in the monsoon)</label>
  </fieldset>
</sg-radio-group>
```

Always give the group a `<legend>`: it is the question the radios answer, and what a screen reader says first.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `orientation` | `column`, `row` | `column` |
| `seed` | any string | the legend |
| `register` | `quiet`, `warm`, `playful` | inherited |
| `value` (property) | the chosen radio's value, or `''`; setting it chooses and fires `change` | |
| `radios` (property) | the native radios, in order | |

A server can swap the options (htmx); the drawings follow.

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | hairline circles, a crisp dot | the dot scales in under 200ms |
| warm | pencil circles whose ends cross; the choice gets an ink dot and is circled in ink, a leaning oval a quarter bigger that runs past its start, as a pen circles an answer | the ring is drawn in when the choice moves |
| playful | bold inked circles; the choice becomes a four-petalled kolam flower in place of its circle | the kolam blooms with a small turn |

Reduced motion: no movement. Forced colours: the system radios.

## Accessibility

- Keyboard: native. Tab to the chosen radio, arrows to move and choose, disabled radios skipped.
- Required: put `required` on the radios; the browser stops the form and says why.
- Contrast: circles, rings and dots are 3:1 or more on every surface (WCAG 1.4.11), tested for every palette and theme.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The drawn circles, rings and dots are `aria-hidden` and carry no meaning; the label text is the name: `packages/components/radio/radio.check.mjs`, "the drawings are hidden from assistive tech" in warm and playful. |
| 1.3.1 Info and relationships | Meets | A native `<fieldset>` with a `<legend>` and native radios in their `<label>`s. `radio.check.mjs`: "the group is announced by its legend, with its radios" (`group "Guests"`, `radio "6, the whole house" [checked]`) in each register, and with JavaScript off "the form submits one value per group". |
| 1.3.5 Identify input purpose | Not applicable | A choice among options holds no personal data of a kind the criterion's list names. |
| 1.4.1 Use of color | Meets | The chosen answer is a filled dot, a ring a quarter bigger or the kolam flower, never a colour change alone (`packages/components/radio/radio.check.mjs`: "exactly one mark per group, on the chosen radio"; warm "the chosen answer is circled in ink a quarter bigger"; playful "the chosen radio becomes the kolam flower in place of the circle"). |
| 1.4.3 Contrast (minimum) | Meets | Labels are `--sg-text` on the page surface: `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme. Axe: `tools/axe.mjs --url /packages/components/radio/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). `radio.check.mjs` also keeps the circle level with Marathi, Kannada and Konkani labels. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). A long label wraps beside its circle. |
| 1.4.11 Non-text contrast | Meets | `packages/components/radio/radio.test.js`: "1.4.11: <palette> <theme>: circles, rings and dots are 3:1 or more", for every palette in light and dark. The focus ring is tested 3:1 or more on every surface in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `radio.check.mjs`: Tab lands on the chosen radio (or the first when none is chosen); the arrow keys move and choose, wrap from the first to the last, and skip a disabled radio, in each register. |
| 2.1.2 No keyboard trap | Meets | `packages/components/radio/radio.js` listens to `change` only: it binds no `keydown` and sets no `tabindex`, and the native radios give Tab and the arrows as for any group. |
| 2.4.3 Focus order | Meets | `radio.check.mjs`: with nothing chosen Tab lands on the first radio; with one chosen it lands there; the group is one stop, as the platform does it. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the group in each register and requires a focus style; `radio.check.mjs` moves focus with the arrows and `packages/tokens/tokens.test.js` asserts the ring colour 3:1. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: `packages/components/radio/radio.css` uses no `position: fixed` or `sticky`, and a document scan of the demo found none. A sticky header or banner the page adds can cover a radio that is scrolled to. |
| 2.5.3 Label in name | Meets | The accessible name is the visible label text: `radio.check.mjs` reads `radio "6, the whole house"`. |
| 2.5.8 Target size (minimum) | Meets with author's part | Manual test, 2026-10-07, 390 px touch: the circle alone is 18.5 by 18.5 px, but the click target is the whole `<label>`, 25.7 px tall in all three registers and 35.9 px or more wide for the shortest label ("2"). Meets only while each radio stays inside its `<label>`. No check in the repository asserts target size for the radio yet. |
| 3.2.2 On input | Meets | `radio.js` listens to `change` only and draws the mark; it submits nothing and moves no focus (`radio.check.mjs`: arrows choose, the form is sent only by its own button). |
| 3.3.1 Error identification | Meets with author's part | A `required` group with nothing chosen is stopped by the browser (`radio.check.mjs`, "no JS: a required group with nothing chosen stops the form"), which then says why in its own words. A page that wants its own words puts an `sg-field-note` or message by the group. |
| 3.3.2 Labels or instructions | Meets with author's part | The `<legend>` is the question and each `<label>` an answer, both native (`packages/components/radio/radio.check.mjs`, "the group is announced by its legend, with its radios"). Their text is the author's. |
| 4.1.2 Name, role, value | Meets | Native radios in a named group; the checked state is the native one (`radio.check.mjs`, `radio ... [checked]`, "value writes and reads"). Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/radio/demo.html`, 0 violations across 6 runs, 2026-10-07. |

**The page author owns:**

- The legend (the question) and each label, in the language of the page, and `lang` on a label in another language (3.1.2).
- Keeping each radio inside its `<label>`, so the whole row is the target (2.5.8).
- The words of an error, if the browser's own are not enough (3.3.1).
- Sticky headers and banners that could cover a radio when it takes focus (2.4.11).
- The colours the page sets behind the group, if it overrides the tokens.

## Budget

Behaviour 5.8 KB of 12 KB (`radio.js` + `radio.core.js`); skins 0.3, 2.5 and 1.4 KB.
