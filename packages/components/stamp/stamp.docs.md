# Stamp

`<sg-stamp>` marks that something real has happened: dates held, files received, a payment made. It enhances a `<p role="status">` that holds the words.

## Use

```html
<link rel="stylesheet" href="susegad/components/stamp/stamp.css">
<script type="module" src="susegad/components/stamp/stamp.js"></script>

<sg-stamp tone="success" pending>
  <p role="status"><strong>Held</strong> <span>12 to 15 Oct, for 20 minutes</span></p>
</sg-stamp>
```

Land it when the work is done, not before:

```js
const stamp = document.querySelector('sg-stamp');
await holdDates();        // the real work
stamp.stamp();            // lands and is announced once
stamp.lift();             // hides it again, for example when the hold is released
```

From a server (htmx): swap in an `<sg-stamp>` without `pending`. A stamp added after the page has loaded is announced; one that was in the page from the start is not.

## Markup

- `<strong>`: the big word. Keep it to one or two words: Held, Paid, Received, मिळाले.
- Anything after it: the detail line. One short line; it wraps if it has to.
- Mark Indian-language text with `lang`. The element also detects the script of each line itself: Latin lines get capitals and letter spacing, and Devanagari and Kannada keep their natural spacing.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `tone` | `accent`, `success`, `warning`, `danger`, `info`, `neutral` | `accent` |
| `pending` | boolean | absent (stamped) |
| `seed` | any string | the text |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Properties, methods and events

- `stamped` (read only): `true` unless `pending`.
- `stamp()`, `lift()`.
- `sg-stamp` event, bubbling, `detail: { tone }`, when it lands.
- `sg-skin` event when a skin mounts (from the component base).
- Plays `complete` when it lands, through the sound switch (`packages/sound`). Silent unless the switch is on and a gesture has already happened.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a ruled rectangle, square, words in the tone's ink | a 120 ms fade when it lands |
| warm | a carved double frame, a tilt of 1.5 to 4 degrees, an off-register ghost, seeded ink starvation | a 220 ms press when it lands |
| playful | as warm, tilted 3 to 7 degrees, heavier ink, a diamond on each side | comes down, presses past flat, settles; ink spreads and fades |

Reduced motion shows the landed stamp in every register.

## Accessibility

- A stamp that pictures news the page already says in words (the Form's answer, a gallery) takes `role="none"` on the element: its words stay on it, in a plain paragraph, and are not a live region, so the news is heard once.
- The words are text in a `role="status"` live region, announced once per landing.
- Every tone meets 4.5:1 on every surface. The texture sits on the frame and on Latin big words only; the detail line is never textured.
- All decoration is `aria-hidden`. No stamp takes focus; it is a status, not a control.
- Without JavaScript you get the quiet look, and `pending` stays hidden, so only render `pending` when a script will land it.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The frame, the ink halo and the motifs are decoration set `aria-hidden="true"` (`packages/components/stamp/skins/warm.js`), and the words are real text. Manual test, 2026-10-07 (throwaway Playwright script, warm demo): every `.sg-stamp-frame` and `.sg-stamp-spread` has `aria-hidden="true"`. |
| 1.3.1 Info and relationships | Meets | The words sit in a `<p role="status">` inside the element, in reading order, and the host takes no role: manual test, 2026-10-07 (same script): each of the 12 stamps on the demo holds exactly one `[role="status"]`, and no host has a `role`. A stamp that pictures news the page already says takes `role="none"`, and its words are then a plain paragraph (`packages/components/stamp/stamp.js`). |
| 1.4.1 Use of color | Meets | The tone is colour, and the words say the same thing: "Held", "Paid", "Declined", "Void" (the demo, `packages/components/stamp/demo.html`). The frame, tilt and texture add feeling, not meaning. |
| 1.4.3 Contrast (minimum) | Meets | Every tone ink is a text role: `--sg-accent-text`, `--sg-success`, `--sg-warning`, `--sg-danger`, `--sg-info` and `--sg-text-soft` (`packages/components/stamp/stamp.css`) are in `textRoles`, tested 4.5:1 on every surface by `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). The ink texture sits on the frame and the big word, and the detail line is never textured: `packages/components/stamp/stamp.test.js`, "the texture starves the ink without eating the word". axe: `tools/axe.mjs --url /packages/components/stamp/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07; color-contrast was left for review by hand and is covered by the ratios in this table. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). Sizes are in `em`, `rem` and tokens, and the mask is redrawn when the box changes size (`skins/warm.js`, `paint`). |
| 1.4.10 Reflow | Meets | `packages/components/stamp/stamp.check.mjs`: "<register> at <320 or 390> px: the page does not scroll sideways" on the demo with every stamp landed, in all three registers. In playful it failed before the fix (350 px wide at 320, 429 at 390): the ink halo `.sg-stamp-spread` is invisible at rest but still counted as scrollable overflow. A playful stamp now keeps 1rem of room on each side and the halo reaches at most that far (`packages/components/stamp/stamp.css`), so it stays inside the stamp's container; 320 and 390 now. |
| 1.4.11 Non-text contrast | Not applicable | The frame and texture are decoration; the words carry the meaning and take the text contrast above. A stamp is a status, not a control. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) applied before the page loaded, warm and playful at 1280 px: the big words (Held 140 by 47 px, Unconfirmed 367 by 54 px) stay whole inside a mask that is the size of the stamp (284 by 96 px for Held). The same values at 320 px give page width 320 in quiet and warm; playful is the reflow failure above. No check in the repository asserts it yet. |
| 4.1.2 Name, role, value | Meets | A status region holding the words; no stamp takes focus (`packages/components/stamp/stamp.js`). axe: `tools/axe.mjs --url /packages/components/stamp/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07; color-contrast was left for review by hand and is covered by the ratios in this table. |
| 4.1.3 Status messages | Meets | The words are in a `role="status"` live region that exists before they land. Manual test, 2026-10-07 (throwaway Playwright script): a `pending` stamp is `visibility: hidden`; calling `stamp()` made the status element's children go to 0 and then back to 3 nodes within a frame (`#announce` in `stamp.js`), which is what makes a live region speak, and the stamp became visible. No screen reader was run. A stamp with `role="none"` is not a live region, so news the page already says is not spoken twice. |

**The page author owns:**

- The words, in the language of the page: a short word and a detail line, and `lang` on a passage in another language (3.1.2). The demo carries Marathi, Kannada and Konkani stamps.
- Rendering `pending` only when a script will land it (`stamp()`), and `role="none"` on a stamp that pictures news the page says in words elsewhere.
- Where a playful stamp is nearly as wide as the screen, stopping the invisible halo from widening the page (for example `overflow-x: clip` on its container) until the component does it (1.4.10).

## Budget

| File | Bytes |
|---|---|
| `stamp.js` + `stamp.core.js` (behaviour) | 9.4 KB of 12 KB |
| `skins/quiet.js` | 0.6 KB |
| `skins/warm.js` | 4.0 KB |
| `skins/playful.js` (loads warm.js) | 0.4 KB + 4.0 KB |

The texture is computed once per size and seed, about 29,000 pixels for a typical stamp at 2× density, and handed to CSS as a mask. Nothing runs per frame.
