# Stepper

`<sg-stepper>` walks a long form one step at a time, and falls back to the whole form, in order, without JavaScript.

## Usage

```html
<link rel="stylesheet" href="susegad/components/stepper/stepper.css">
<script type="module" src="susegad/components/stepper/stepper.js"></script>

<form action="/book" method="post">
  <sg-stepper>
    <fieldset><legend>Your dates</legend> … </fieldset>
    <fieldset><legend>Who is coming</legend> … </fieldset>
    <fieldset><legend>Your details</legend> … </fieldset>
    <button type="submit">Send the request</button>
  </sg-stepper>
</form>
```

Each step is a `<fieldset>` with a `<legend>`, a direct child of the element. The one submit button goes last. Use the form's own validation (`required`, `min`, `type=email`): the stepper uses it at every step.

## Attributes, properties, methods and events

| Name | What it does |
|---|---|
| `seed` | Changes the map in warm and playful. The same seed always draws the same map. |
| `register` | `quiet`, `warm` or `playful`; overrides the page's register. |
| `index` (property) | The step showing, from 0. |
| `next()` | Checks the current step and moves on if it is complete. Returns `true` if it moved. |
| `go(i)` | Shows step `i` without checking, for example to jump back to a step from a summary. |
| `sg-step` (event) | Fires on every change, with `detail: { index, from }`. |

## Registers

- **Quiet:** numbered stations joined by a hairline. Nothing moves.
- **Warm:** a small survey map of the walk. The road you have walked is inked; moving on inks the next leg and stepping back lifts it.
- **Playful:** the map in the accent colour, with footprints along the road.
- **Reduced motion:** the walk is drawn at once.

## Accessibility

- Without JavaScript, every step shows, numbered, and the form submits normally.
- One step shows at a time. The others are hidden, not removed, so nothing typed is lost and hidden steps still submit.
- Focus moves to each new step's legend, which is described by the "Step 2 of 3" line.
- Next checks the current step and focuses the first problem with the browser's own message. If you submit with a problem in another step, the stepper takes you there first.
- Enter in a one-line field moves to the next step instead of submitting early.
- The map is `aria-hidden`; everything it shows is in words.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The map and the station line are SVG set `aria-hidden="true"` (`packages/components/stepper/skins/map.js`, `skins/quiet.js`), and everything they show is also in words: `packages/components/stepper/stepper.check.mjs`, "<register>: one step at a time, with where you are in words" ("Step 1 of 3", "Next: Who is coming"). |
| 1.3.1 Info and relationships | Meets | Each step is a native `<fieldset>` with its `<legend>`, so a screen reader hears the group. Steps are hidden, not removed, so nothing typed is lost: `stepper.check.mjs`, "going back keeps what you typed" and "submit sends every step, hidden ones too". With JavaScript off every step shows, numbered, and the form submits natively ("no JS: every step shows, in order"). |
| 1.3.5 Identify input purpose | Meets with author's part | The stepper adds no fields: the inputs inside are the author's native controls (`packages/components/stepper/stepper.js` only moves between `<fieldset>`s), so each can carry its own `autocomplete`. |
| 1.4.1 Use of color | Meets | Where you are is in words ("Step 2 of 3") and the map's current and finished stations differ by stroke weight and fill as well as colour (`packages/components/stepper/stepper.css`, `.here` and `.done`); an invalid step is told by the browser's own message on the field. |
| 1.4.3 Contrast (minimum) | Meets | The step line and legend numbers are `--sg-text-soft` and `--sg-text`, text roles: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe: `tools/axe.mjs --url /packages/components/stepper/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07; color-contrast was left for review by hand and is covered by the ratios in this table. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). Sizes are in `rem` and tokens: `packages/components/stepper/stepper.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320, no sideways scroll (throwaway Playwright script). The map fits narrow and wide boxes (`packages/components/stepper/stepper.test.js`, "the map fits narrow and wide boxes") and the Back and Next row wraps (`stepper.css`, `.sg-stepper-nav { flex-wrap: wrap }`). |
| 1.4.11 Non-text contrast | Meets with author's part | The focus ring on a legend is `--sg-focus` and the control borders `--sg-rule-strong`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: focus ring and control borders are 3:1 or more on every surface"). The map is a drawing that repeats the words, so it needs no contrast of its own. Back and Next are native buttons that carry the page's own button styles, which are the author's. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `packages/components/stepper/stepper.check.mjs`: "Enter in a field moves to the next step, focus on its legend", "Next waits for this step to be complete", going back keeps what was typed, and the last step shows Back and the form's own submit. Back and Next are native buttons. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/stepper/stepper.js` binds one `keydown` on the element, for Enter in a one-line field, and leaves Tab, Shift+Tab and Escape alone; every step's fields and the Back, Next and submit buttons are reached in order. |
| 2.4.3 Focus order | Meets | Focus moves to each new step's legend, then runs through that step's fields to Back and Next, which follow the steps in the DOM: `stepper.check.mjs`, "Enter in a field moves to the next step, focus on its legend". A step that is not shown takes no focus because it is `hidden`. |
| 2.4.7 Focus visible | Meets with author's part | `packages/components/stepper/stepper.css` sets a `:focus-visible` outline on the legend that takes focus. Back and Next are native buttons; the stepper styles no focus ring for them, so they show the page's own button focus style or the browser's. Manual test, 2026-10-07: Tab to Next on the demo gives a solid 2 px outline (throwaway Playwright script, quiet), which is the demo page's style, not the component's. `tools/touch.check.mjs` Tabs onto the first focusable control in the component, in the quiet register, and requires an outline, ring or style change. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/stepper/stepper.css` uses no `position: fixed` or `sticky` and no overlay. A sticky header or banner the page adds can cover a field when focus moves to it. |
| 2.5.3 Label in name | Meets | Back and Next are named by their visible text: `stepper.check.mjs` reads `Next: Who is coming` and the step line "Step 2 of 3". |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: the Next button measures 203 by 44 px in all three registers (throwaway Playwright script on the demo, 1280 px), the date inputs 299 by 49 px. The button and input sizes come from the page's styles; the stepper only lays them out. No check in the repository asserts target size for the stepper yet. |
| 3.2.2 On input | Meets | Entering a value changes nothing but the field. A step changes only when the person presses Next or Back, or presses Enter in a one-line field, which moves on instead of submitting early: `stepper.check.mjs`, "Enter in a field moves to the next step". |
| 3.3.1 Error identification | Meets | Next checks only the step you are on and focuses the first problem with the browser's own message; submit takes you to the step that has the problem: `stepper.check.mjs`, "Next on step 1 waits for the arrival date" and "submit takes you to the step with the problem". With JavaScript off, native validation stops an incomplete form ("no JS: native validation stops an incomplete form"). The words of a custom message are the author's. |
| 3.3.2 Labels or instructions | Meets with author's part | Each step has a `<legend>` and a "Step n of N" line, linked with `aria-describedby` (`packages/components/stepper/stepper.js`). The labels, legends and hints of the fields are the author's. |
| 4.1.2 Name, role, value | Meets | Native fieldsets, legends and buttons; the step line is the legend's description; the map is hidden. `stepper.check.mjs` reads "Step n of 3" and the next button's name in every register. axe: `tools/axe.mjs --url /packages/components/stepper/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07; color-contrast was left for review by hand and is covered by the ratios in this table. |
| 4.1.3 Status messages | Not applicable | A change of step moves focus to the new step's legend, which is described by "Step 2 of 3", and a problem moves focus to the field with the browser's own message; no status goes unfocused. The step line is not a live region (`packages/components/stepper/stepper.js`). |

**The page author owns:**

- The legends, labels and hints, in the language of the page, and `lang` on any in another language (3.1.2). The built-in words ("Back", "Next: ...", "Step n of N") are English in `stepper.core.js`.
- `autocomplete` on fields that ask about the person (1.3.5), and the wording of any custom validation message (3.3.1).
- The look of the Back and Next buttons, their focus ring and contrast (1.4.11, 2.4.7), if the page restyles them.
- Sticky headers and banners that could cover a field when focus moves to it (2.4.11).

## What moves, and why

The map moves only when you change step, and only as far as you went.
