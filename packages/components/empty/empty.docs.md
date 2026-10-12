# Empty state

`<sg-empty>` is what a place shows before there is anything in it. You write the words; the register brings the picture.

## Usage

```html
<link rel="stylesheet" href="susegad/components/empty/empty.css">
<script type="module" src="susegad/components/empty/empty.js"></script>

<sg-empty scene="paus">
  <h2>No messages</h2>
  <p>Guests can write to you from their booking. Their messages arrive here.</p>
  <button type="button">Write a welcome note</button>
</sg-empty>
```

Write three things: a heading that says what is empty, one sentence about what will appear and when, and the one action that moves things on. Avoid "Nothing to see here". Say what will be here.

## Attributes and properties

| Name | Type | What it does |
|---|---|---|
| `scene` | scene name (default `paus`) | The scene for warm and playful, and the drawing for quiet. Any scene in `susegad/scenes/` works; quiet has a drawing for Paus and a plain tray for the rest. |
| `scene-<param>` | text | Passed to the scene as `<param>`, for example `scene-intensity="0.5"`, `scene-fog="0.9"` or `scene-seed="4"`. Changes are forwarded as they happen. |
| `scene-interactive` | `true` | Opt in to a scene you can play with (playful only). Without it the scene is set `interactive="false"` in every register: a picture with a pause button, so Tab goes from your action straight past it. |
| `register` | `quiet`, `warm` or `playful` | Overrides the page's register for this element. |

## Registers

- **Quiet:** a small hairline drawing beside the words. Nothing moves, and the scene is never downloaded.
- **Warm:** the scene beside the words (above them on a narrow box), drifting slowly. It has its own pause button and pauses off screen.
- **Playful:** the scene in full, playing, as warm's does but livelier. It can be played with: in Paus you wipe the fogged glass with a finger, the pointer or the arrow keys. That is opt in, with `scene-interactive="true"`; by default the scene is not interactive, so a person using Tab meets your action and its pause button and no extra stop.
- **Reduced motion:** the scene shows its finished still. Its play button still plays it for anyone who asks.

## Accessibility

- The element is a `region` named by its heading. Without a heading it has no role.
- The words and action are your own HTML, in reading order, and never sit over the picture.
- In warm and playful the scene is an image with its own name and a pause button, after your action in reading order. Set `scene-interactive="true"` in playful and the drawing also takes focus, with help text, one Tab stop between your links and the pause button. Checked, 2026-10-07, in playful on the demo: Tab stops are the action, the link, the pause button; with `scene-interactive="true"` one more (the drawing) comes before the pause button.
- The quiet drawing is `aria-hidden`.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The quiet drawing is `aria-hidden` (`packages/components/empty/skins/quiet.js`). In warm and playful the scene is an image with its own name. Manual test, 2026-10-07: the demo's scene reads `role="img"` named "A Goan window in the monsoon: ..." in both registers, at 1280 px and at 390 px (throwaway Playwright script). |
| 1.3.1 Info and relationships | Meets | The element is a `region` named by the heading it holds, and without a heading it has no role (`packages/components/empty/empty.js`: `role="region"` and `aria-labelledby` set only when a heading is found). The words and the action are the author's own HTML in reading order. |
| 1.4.1 Use of color | Meets | The empty state says what is missing in words and offers the next step as a link or button; the picture carries no meaning of its own (`packages/components/empty/empty.docs.md`, "What moves, and why"). |
| 1.4.3 Contrast (minimum) | Meets | The words are the author's and take `--sg-text` and `--sg-text-soft`, tested at 4.5:1 or more on every surface in `packages/tokens/tokens.test.js`; the words never sit over the picture. `tools/axe.mjs --url /packages/components/empty/demo.html`: 0 violation(s) across 6 run(s) (three registers, light and dark, desktop), nothing to review by hand, 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: the demo with the root font size at 200 percent in three registers (1280 px wide), no sideways scroll and no clipped text (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px, three registers, 2026-10-07: no sideways scroll and no element past the viewport; in a narrow column the words move below the picture (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.11 Non-text contrast | Meets | The picture is decoration beside the words, which say the same thing, so it needs no contrast of its own. The pause button and the links take the focus ring `--sg-focus`, tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | Manual test, 2026-10-07: Tab walks the author's links and button and, in warm and playful, the scene's "Pause animation" button, in reading order, in each register (throwaway Playwright script). The drawing itself takes Tab and the arrow keys only with `scene-interactive="true"` (manual test, 2026-10-07: playful on the demo, default and with the attribute); by default it is a picture, and the docs say so. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: six presses of Tab in each register moved through every control and out to the page; `packages/components/empty/empty.js` binds no key handler of its own. |
| 2.2.2 Pause, stop, hide | Meets | Manual test, 2026-10-07: in warm and playful the scene drifts and has its own "Pause animation" button (`aria-pressed`, 32 by 32 px), which it shows already pressed under reduced motion, where the scene is a finished still; it also pauses off screen (`packages/components/empty/empty.docs.md`). The button is present in both registers at 1280 px and at 390 px, and reads `aria-pressed="true"` with reduced motion on (throwaway Playwright script). Quiet moves nothing. |
| 2.3.1 Three flashes or below threshold | Meets | The scene is weather: slow drift, with no flashing (`packages/components/empty/empty.docs.md`, "What moves, and why"). This is the scene's own claim; the scene's flash behaviour is not tested in this component. |
| 2.4.3 Focus order | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the empty demo at 390 px in quiet, warm and playful, Tab pressed through every stop (3 stops in quiet, 5 in warm and playful); each focused control was on screen and not covered (the element at its centre is the control itself) and every stop came after the previous one in document order. The same script on a page with a full-screen fixed layer added reported every stop covered, so it can fail. In warm and playful the order is the author's links, then the scene's "Pause animation" button, then the next control: the scene comes after the words in the document and CSS only moves it (`packages/components/empty/skins/warm.js`, header comment). With `scene-interactive="true"` the drawing is one more stop, before the pause button. |
| 2.4.7 Focus visible | Meets | The rule is `sg-empty :is(a, button):focus-visible` in `packages/components/empty/empty.css`, and `tools/touch.check.mjs` finds the component interactive and requires a focus style in every register. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | `packages/components/empty/empty.css` has no `position: fixed` or `sticky`, so the component never covers a focused control itself. Manual test, 2026-10-07 (throwaway Playwright script): the empty demo at 390 px in three registers, every Tab stop was on screen and not covered (the element at its centre is the control itself); the same script with a full-screen fixed layer added reported every stop covered, so it can fail. A sticky header or banner the page adds can still cover a focused control. |
| 2.5.3 Label in name | Meets | The author's action and links are named by their own visible text: the component adds no `aria-label` to them (`packages/components/empty/empty.js` sets `aria-labelledby` on the region only). The scene's pause button shows only an icon, so it has no visible text to contain; its name is "Pause animation" (manual test, 2026-10-07: warm and playful, 32 px wide, `aria-label="Pause animation"`, `aria-pressed`). |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: the pause button is 32 by 32 px, the demo's primary action 166 by 45 px and its text link 126 by 29 px in quiet at 1280 px; no focusable control under 24 by 24 px at 1280 px or at 390 px in any register (throwaway Playwright script). |
| 4.1.2 Name, role, value | Meets | A `region` named by its heading, a scene that is `role="img"` with a name, a pause button with `aria-pressed`. axe: 0 violations, `tools/axe.mjs --url /packages/components/empty/demo.html`, 2026-10-07. |

**The page author owns:**

- The heading, the words and the action, in the language of the page, and `lang` on a passage in another language (3.1.2).
- A heading inside the element, so the region has a name.
- Keeping the words and the action as real links or buttons next to the picture, never over it.
- The colours the page sets behind the element, if it overrides the tokens.
- Action and link texts that make sense on their own, since the component names nothing for them (2.4.4, 2.5.3).

## What moves, and why

An empty state has no progress to show. The scene is weather: it never suggests that something is loading or about to arrive. If something is loading, use a skeleton or a loader instead.
