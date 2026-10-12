# Toggle

`<sg-toggle>` wraps one native `<input type="checkbox" role="switch">` and its label. It submits and takes Space with or without JavaScript, and a screen reader calls it a switch.

## Use

```html
<link rel="stylesheet" href="susegad/components/toggle/toggle.css">
<script type="module" src="susegad/components/toggle/toggle.js"></script>

<sg-toggle>
  <label><input type="checkbox" role="switch" switch name="reminder" value="whatsapp" checked> A WhatsApp reminder the day before</label>
</sg-toggle>
```

When off, a switch sends nothing (like any checkbox). Read it on the server as "present means on".

## Attributes and properties

| | Values | Default |
|---|---|---|
| `seed` | any string, for the lamp's flicker | the label |
| `register` | `quiet`, `warm`, `playful` | inherited |
| `checked` (property) | boolean; setting it fires `input` and `change` | the input's |

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | a plain track and thumb; on fills the track with the accent | the thumb slides under 200ms |
| warm | a brass tower bolt; on, the bolt is in the keeper and the handle is down | the bolt slides on the register's spring |
| playful | a clay diya; on, a flame and a glow | the flame flickers while lit and on screen |

Reduced motion: no movement anywhere, the bolt already home, the flame still. Forced colours: the system control.

## Accessibility

- Keyboard: Tab to it, Space to switch.
- The state is always a shape (thumb side, bolt position, flame) outlined in the text colour, never colour alone.
- Contrast: track edge, filled track, thumb and outlines are 3:1 or more (WCAG 1.4.11), tested for every palette and theme.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The drawing (bolt, lamp) is `aria-hidden="true"` and the label is the name: `packages/components/toggle/toggle.check.mjs`, "the drawing is hidden from assistive tech" in warm and playful. |
| 1.3.1 Info and relationships | Meets | A native `<input type="checkbox" role="switch">` inside its `<label>`. `toggle.check.mjs` reads the accessibility tree with JavaScript off and on and finds `switch "Daily housekeeping, ..."`, named by its label. |
| 1.3.5 Identify input purpose | Not applicable | A switch holds no personal data. |
| 1.4.1 Use of color | Meets | State is the thumb side, the bolt position or the flame, never colour alone. `packages/components/toggle/toggle.test.js` asserts every state-carrying shape is stroked in the text colour; `toggle.check.mjs` asserts the drawing follows the state in each register. |
| 1.4.3 Contrast (minimum) | Meets | The label is page text in `--sg-text`. `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme; axe `color-contrast` is clean (`tools/axe.mjs --url /packages/components/toggle/demo.html`: 0 violations across 3 registers and 2 themes, desktop, phone and JavaScript off, 2026-10-06). |
| 1.4.4 Resize text | Meets | Manual test: demo with the root font size at 200 percent, three registers, nothing clipped, nothing wider than the screen (throwaway Playwright script, 2026-10-06). Sizes are in `em`, in `packages/components/toggle/toggle.css`. |
| 1.4.10 Reflow | Meets | Manual test: demo at 320 CSS px, three registers, no sideways scroll and no clipped label (throwaway Playwright script, 2026-10-06). The label column is `minmax(0, 1fr)` in `packages/components/toggle/toggle.css`, so a long label wraps. No check in the repository asserts it yet. |
| 1.4.11 Non-text contrast | Meets | `packages/components/toggle/toggle.test.js`: "1.4.11: <palette> <theme>" asserts the off track edge, on track, thumb and latch and lamp outlines are 3:1 or more on both grounds, for every palette in light and dark. The focus ring and control borders are tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em) injected on the demo, three registers, no clipping or overlap (throwaway Playwright script, 2026-10-06). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `packages/components/toggle/toggle.check.mjs`: Space turns it on and off with JavaScript off and in each register; disabled switches stay out of the form. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/toggle/toggle.js` and its skins bind no `keydown` and set no `tabindex`; the native input takes Tab and Shift+Tab as any checkbox does. |
| 2.2.2 Pause, stop, hide | Meets with author's part | The playful lamp's flame flickers while lit and on screen. It stops under `prefers-reduced-motion`, and pauses off screen (`toggle.check.mjs`: "playful, reduced motion: the flame stands still", "a lit flame pauses when it leaves the screen"). There is no on-page pause control, so a page that uses the playful register owns offering the quiet register or a motion switch. |
| 2.3.1 Three flashes or below threshold | Meets | The flicker is a transform only (rotate and scale, no colour or brightness change), within 12 percent and 6 degrees: `packages/components/toggle/toggle.test.js`, "the flicker is small, deterministic". |
| 2.3.3 Animation from interactions | Meets | AAA, informative. Under reduced motion no animation runs and the bolt is already home: `toggle.check.mjs`, "warm, reduced motion" and "playful, reduced motion". |
| 2.4.3 Focus order | Meets | Manual test: the native input is the only tab stop and keeps its place in the page's order; the drawing is `aria-hidden` and takes no focus (`packages/components/toggle/toggle.js` sets no `tabindex`). |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the control in each register and requires a focus style; `packages/components/toggle/toggle.test.js` asserts the `:focus-visible` rule. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/toggle/toggle.css` uses no `position: fixed` or `sticky` and no overlay. A sticky header or banner the page adds can cover a switch that is scrolled to. |
| 2.5.3 Label in name | Meets | The accessible name is the visible label text: `toggle.check.mjs` reads `switch "Daily housekeeping, between 11 am and 1 pm"` for that label. |
| 2.5.8 Target size (minimum) | Meets with author's part | Manual test, 2026-10-06: the click target is the whole label (25.7 px tall on one line, the width of the text and more, in all registers). The drawn switch alone is 36.9 by 20.9 px in quiet at 16 px type, under 24 px high, and the warm (44 by 24) and playful (34 by 34) drawings are larger. The label must stay inside the `<label>`. No check in the repository asserts target size for the toggle yet. |
| 3.2.2 On input | Meets | `packages/components/toggle/toggle.js` fires `input` and `change` and nothing else; `toggle.check.mjs` turns switches on and off and the page stays put until the Save button is pressed. |
| 3.3.1 Error identification | Not applicable | A switch has no invalid state: it is on or off, with no pattern, no range and no required value. |
| 3.3.2 Labels or instructions | Meets with author's part | The component keeps the native `<label>` as the name (`toggle.check.mjs`, `switch "Daily housekeeping, ..."`). The label and any instruction text are the author's. |
| 4.1.2 Name, role, value | Meets | `toggle.check.mjs`: still announced as a switch by its label in each register, with and without the `switch` attribute, with JavaScript off; checked state is the native one. axe: 0 violations (`tools/axe.mjs --url /packages/components/toggle/demo.html`, 2026-10-06). |

**The page author owns:**

- The label text: it says what the switch controls, in the language of the page, and stays inside the `<label>` that wraps the input.
- `lang` on a label in another language (3.1.2); the demo does it for Marathi, Kannada and Konkani.
- Sticky headers and banners that could cover a switch when it takes focus (2.4.11).
- A way to turn the playful lamp's flicker off, such as offering the quiet register (2.2.2).
- The colours the page sets behind the switch, if it overrides the tokens.

## Budget

Behaviour 5.3 KB of 12 KB (`toggle.js` + `toggle.core.js`); skins 0.3, 2.2 and 1.6 KB.

## Touch

The element adds the native `switch` attribute, so on an iPhone a real tap gives the system haptic; other engines ignore it. A press answers in every register (quiet settles 1 px, warm shades the brass, playful gives a little), turning it on plays the `confirm` sound and haptic behind the sound switch, and a held arrow key never animates. The rules are in `docs/contributing/touch-contract.md`.
