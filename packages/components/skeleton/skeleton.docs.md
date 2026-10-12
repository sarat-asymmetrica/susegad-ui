# Skeleton

`<sg-skeleton>` stands in for a region while its content is loading, and steps aside the moment the content is there.

## Usage

```html
<link rel="stylesheet" href="susegad/components/skeleton/skeleton.css">
<script type="module" src="susegad/components/skeleton/skeleton.js"></script>

<sg-skeleton busy shape="list" lines="3" label="your guests">
  <!-- the real list goes here when it arrives -->
</sg-skeleton>
```

Put the content inside the element, then remove `busy` (or set `el.busy = false`). If the content is already there when the page renders, leave `busy` off and nothing is drawn.

Pick the shape that looks most like what is coming, so the page does not jump when it arrives:

| shape | draws |
|---|---|
| `text` (default) | `lines` bars of text, the last one shorter |
| `card` | a picture, a title and `lines` bars |
| `list` | `lines` rows, each a circle and two bars |
| `media` | one 16:9 picture |

## Attributes, properties and events

| Name | Type | What it does |
|---|---|---|
| `busy` | boolean attribute, and the `busy` property | While set, the content is hidden, the element is `aria-busy`, and the placeholder shows. |
| `shape` | `text`, `card`, `list` or `media` | The placeholder layout. Unknown values fall back to `text`. |
| `lines` | number, 1 to 12 (default 3) | Lines of text, or rows of a list. |
| `label` | text | What is loading, as a noun phrase in lower case: `label="your guests"` gives "Loading your guests", then "Your guests loaded". |
| `seed` | number or text | Changes the bar widths. The same seed always gives the same placeholder. |
| `register` | `quiet`, `warm` or `playful` | Overrides the page's register for this element. |
| `sg-loaded` | event | Fires once when `busy` goes away, with `detail: { label }`. |

## Registers

- **Quiet:** flat blocks a shade deeper than the surface. Nothing moves while waiting; the content fades in within 150 ms.
- **Warm:** the placeholder drawn in pencil, with light shading where a picture goes. Nothing moves while waiting. When the content arrives, each outline is traced in ink (about a third of a second), then the drawing gives way to the content.
- **Playful:** soft colour washes and a doodled picture in the accent ink. It is meant to boil on twos while waiting (three drawings swapped twelve times a second); as built it does not: the swap is set with `easing: 'step-end'` on the whole animation, which holds the first drawing for the whole cycle, so the playful skeleton is still while waiting (manual test, 2026-10-07: opacity of the three drawings read `1,0,0` on every one of 20 samples 40 ms apart). The only motion is the ink-in on arrival. Known bug, for the skeleton's owner: per-keyframe `step-end` would make it boil.
- **Reduced motion:** the placeholder is still, and the content appears at once when it arrives.

## Accessibility

- While busy, the element has `aria-busy="true"` and holds a visually hidden `role="status"` line saying what is loading. The drawing is `aria-hidden`.
- The content is hidden with `display: none` while busy, so nobody reads stale or half-rendered content.
- When the content arrives it joins the accessibility tree at once, even while the warm ink-in is still playing, and "… loaded" is announced once.
- Nothing in the skeleton takes focus.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The drawing is set `aria-hidden="true"` (`packages/components/skeleton/skins/draw.js`), and what is loading is said in words by a visually hidden status line. Manual test, 2026-10-07 (throwaway Playwright script on the playful demo): the drawing's `aria-hidden` is `true` and the status reads "Loading the room details". `packages/components/skeleton/skeleton.test.js`: "strings say what is loading and when it has arrived". |
| 1.3.1 Info and relationships | Meets | `packages/components/skeleton/skeleton.css` hides the content with `display: none` while busy, so nobody reads stale or half-rendered content, and when it arrives it joins the accessibility tree at once. Manual test, 2026-10-07: busy, the card's content has `display: none`, `aria-busy="true"` is set and the status is `role="status"`; after the content arrives `aria-busy` is `false`, the content is `display: block` and the status reads "The room details loaded" (throwaway Playwright script). |
| 1.4.1 Use of color | Not applicable | The placeholder carries no meaning in colour: what is loading is said in words, and the shapes only suggest where the content will go. |
| 1.4.3 Contrast (minimum) | Not applicable | The skeleton shows no text: it is a drawing and a visually hidden status line. The content that arrives is the author's, in the page's text colours. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three registers, nothing wider than the screen (throwaway Playwright script). The placeholder is drawn to the width of its box and redrawn on resize (`packages/components/skeleton/skins/draw.js`). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320, no sideways scroll (throwaway Playwright script). |
| 1.4.11 Non-text contrast | Not applicable | The placeholder blocks and outlines are not graphics required to understand the content, and not a control or a state of one: 1.4.11 covers those. What is loading is said in words in a `role="status"` line ("Loading your guests", then "Your guests loaded") built in `packages/components/skeleton/skeleton.core.js` and tested in `packages/components/skeleton/skeleton.test.js`; the line is visually hidden, so it is read by assistive technology, not seen. For the record, the blocks are faint by design: 1.07:1 to 1.19:1 against `--sg-surface` and 1.19:1 to 1.53:1 against `--sg-surface-raised` (manual test, 2026-10-07, `resolveRoles` from `packages/tokens/tokens.js`, every palette, light and dark). A page that uses the skeleton as the only sign of loading for sighted readers, with no words of its own, owns that. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). The skeleton has no text of its own. No check in the repository asserts it yet. |
| 2.2.2 Pause, stop, hide | Meets | Manual test, 2026-10-07 (throwaway Playwright script, playful demo, three animations running, 20 samples 40 ms apart while busy): the opacity of the three drawings read `1,0,0` every time, so nothing visibly moves while waiting in any register, and this is what the code does, not what the docs describe as the intended wobble (see Registers). The only motion is the ink-in on arrival, about a third of a second, triggered by the content arriving and never by a timer (`packages/components/skeleton/skins/playful.js`). Reduced motion shows the still. If the wobble is fixed to run, this row must be re-judged: it would loop for as long as the page is busy. |
| 2.3.1 Three flashes or below threshold | Meets | The same manual test: no frame changes while busy. The arrival fades in over 140 to 220 ms and the ink-in traces outlines once (`packages/components/skeleton/skeleton.css`, `sg-skeleton-in`). Nothing flashes. If the playful wobble is repaired to swap three drawings at 12 a second, as the docs describe, run this row again. |
| 4.1.2 Name, role, value | Meets | `aria-busy` carries the state and a `role="status"` line carries the name of what is loading (the manual test above); nothing in the skeleton takes focus. axe: `tools/axe.mjs --url /packages/components/skeleton/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |
| 4.1.3 Status messages | Meets | Added because the component is a status. The line says "Loading ..." while busy and "... loaded" once on arrival, in a `role="status"` region that exists before the message (`packages/components/skeleton/skeleton.js`; `skeleton.test.js`, "strings say what is loading and when it has arrived"). Manual test, 2026-10-07: read after the arrival, "The room details loaded". |

**The page author owns:**

- Saying in visible words that something is loading, if the skeleton is the only sign of it for sighted readers (1.4.11).
- The `label`, so the status says what is loading ("your bookings"), in the language of the page; the built-in words ("Loading ...", "... loaded") are fixed English in `skeleton.core.js`, so on a page in another language they are a passage in English: mark it with `lang` (3.1.2) or ask for them to be made replaceable.
- The content that replaces the skeleton, its contrast and its headings (1.4.3, 1.3.1).
- Rendering `busy` only when a script will clear it, and not leaving it on after a failed load (a skeleton that never resolves says "Loading" for ever).

## What moves, and why

A skeleton does not know how far along the work is, so nothing in it suggests an amount. Playful's wobble, which is meant to say only that something is still coming and to stop when the region is off screen, does not currently show (see Registers). The ink-in is triggered by the content arriving, never by a timer.
