# Drawer

`<sg-drawer>` is Dialog's sibling: the same native `<dialog>` modal contract
(`showModal()`, Escape, native focus return), laid out as a panel sliding
in from an edge instead of a centred card. In warm and playful, its backdrop
is the [Carepa surface](../../surfaces/carepa/carepa.docs.md); playful times
the slide's start to the Teental stagger's first beat.

## Usage

```html
<a href="/rooms" data-sg-drawer="rooms">The rooms</a>
<button type="button" commandfor="rooms-dialog" command="show-modal">The rooms</button>

<sg-drawer id="rooms" edge="end">
  <dialog id="rooms-dialog">
    <h2>The rooms</h2>
    …
    <form method="dialog"><button type="submit" value="dismiss">Close</button></form>
  </dialog>
</sg-drawer>
```

- `edge` is `start`, `end` (default), `top` or `bottom`. `start`/`end` are
  logical, so a right-to-left page gets the mirror image for free.
- A `<button commandfor="rooms-dialog" command="show-modal">` opens it with no script at all (`commandfor` names the native `<dialog>`'s `id`); the element still sees the opening, so the skin mounts and `sg-drawer-open` fires. Browsers without invoker commands get a click handler that does the same.
- Same opener contract as Dialog: any element with `data-sg-drawer="<id>"`
  opens it, upgraded from a real link's click; without JavaScript it is a
  real link to a real page.
- `dlg.show()` opens it; `dlg.close(value)` closes it; `dlg.open` is `true`
  while shown.
- Events: `sg-drawer-open`, `sg-drawer-close` (`detail: { returnValue }`),
  `sg-drawer-cancel`.

## Registers

- **Quiet**: a hairline panel at the edge, full height (or full width for
  `top`/`bottom`), arriving and leaving in 120 ms of opacity and nothing else.
- **Warm**: a paper panel with a deckled edge (a repeating mask, so it works
  at any panel height) over the Carepa scrim; the panel slides in a short way
  from its edge as it fades in (200 ms).
- **Playful**: the same, brighter, sliding a little further on the spring, with the slide's start delayed by
  `talaDelay(1)` from `packages/tokens/tokens.js` (one beat into the
  sixteen-beat cycle, not the very first), a small anticipatory pause
  before the panel moves, never more than 130ms, well under the charter's
  600ms cap for a stagger's last item.

Entry is a CSS transition from `@starting-style`; leaving is the same, played back, where the browser can keep the drawer in the top layer while it goes (the `overlay` property), and instant elsewhere. Reduced motion shows it at once. The panel's buttons are pressed like Dialog's.

## Accessibility

Identical to Dialog: focus trapped by `showModal()`, returned to the
opener on close, Escape closes it, the scrim is `aria-hidden`. `edge="top"`
and `edge="bottom"` still trap focus and block the page exactly as
`edge="end"` does; only the layout differs.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The scrim and the warm and playful backdrop are `aria-hidden` and carry no meaning (`packages/components/drawer/drawer.check.mjs` and the scrim layer in `packages/components/drawer/drawer.js`). The drawer's content is the author's markup. |
| 1.3.1 Info and relationships | Meets | Manual test, 2026-10-07: a native `<dialog>` opened with `showModal()`, with a heading and the author's own markup; the open drawer's accessibility tree at 320 px (Playwright `ariaSnapshot`) is a `dialog` holding its heading, paragraph and controls in order. Its name is under 4.1.2. |
| 1.4.1 Use of color | Meets | Nothing in the drawer depends on colour alone: the demo's one control is the word "Close" in a bordered button (`packages/components/drawer/drawer.css`, `.sg-drawer-card button`). |
| 1.4.3 Contrast (minimum) | Meets | Text is `--sg-text` on `--sg-surface-raised`, tested at 4.5:1 or more in `packages/tokens/tokens.test.js`. In warm and playful the card is 96 to 97 percent opaque over the backdrop, so axe lists `color-contrast` as "to review by hand" on the open drawer (`tools/axe.mjs` run on the open page, 2026-10-07: 0 violations, `color-contrast` incomplete). Manual test, 2026-10-07: a throwaway script mixed `--sg-surface-raised` at that opacity over pure black and over pure white and measured `--sg-text` and `--sg-text-soft` on it: 4.5:1 or more in every palette, light and dark. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: the drawer opened with the root font size at 200 percent in three registers (1280 px wide), the card stays inside the viewport, no sideways scroll, no clipped text (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px, three registers, 2026-10-07: the drawer opened, no sideways scroll, nothing past the viewport edge; the card scrolls inside itself when it is taller than the screen (`overflow: auto` in `packages/components/drawer/drawer.css`). |
| 1.4.11 Non-text contrast | Meets | The card's button borders are `--sg-rule-strong` and the focus ring is `--sg-focus`, both tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the open drawer in three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.13 Content on hover or focus | Not applicable | The drawer opens when the reader presses the opener, not when the pointer hovers or focus lands, and it holds no hover or focus popups of its own. |
| 2.1.1 Keyboard | Meets | `packages/components/drawer/drawer.check.mjs`: "clicking the opener shows the drawer modally" with Enter or a click, Escape closes it, and every control inside is a native button, link or field. |
| 2.1.2 No keyboard trap | Meets | `drawer.check.mjs`: "Escape closes the drawer" and "focus returns to the opener", and "Tab never leaves the open drawer onto real page content"; Tab wraps inside it through the browser's own controls ("at most one transient body stop per wrap, never stuck"). Escape is always a way out. |
| 2.2.2 Pause, stop, hide | Meets with author's part | In warm and playful a slow light (a drifting sun, `driftSun` in `packages/surfaces/carepa/model.js`) moves on the backdrop while the drawer is open. It is drawn once as a finished still under reduced motion (`reducedMotion: ctx.motion === 'still'` in `packages/components/drawer/skins/warm.js`) and quiet draws none. There is no on-page pause control, so a page that uses warm or playful owns offering the quiet register or a motion switch. |
| 2.3.1 Three flashes or below threshold | Meets | The backdrop is a slowly drifting light with no flashing (`packages/surfaces/carepa/model.js`). |
| 2.4.3 Focus order | Meets | The order is the markup's inside a native modal `<dialog>`, and focus returns to the opener on close (`drawer.check.mjs`: "focus returns to the opener"). Manual test, 2026-10-07: Tab through the open drawer at 320 px visited its controls in reading order in all three registers. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` requires a focus style in every register; the rule is `:focus-visible` in `packages/components/drawer/drawer.css`. |
| 2.4.11 Focus not obscured (minimum) | Meets | Manual test, 2026-10-07: at 320 by 640 px the drawer opened and Tab pressed eight times in each register; every focused control was fully inside the viewport and the element at its centre was the control itself (`elementFromPoint`). A modal dialog sits in the browser's top layer, so a sticky bar of the page cannot cover it. |
| 2.5.3 Label in name | Meets | Buttons are named by their visible text, because the component adds no `aria-label` (`packages/components/drawer/drawer.js`). |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: the smallest control in the open drawer at 320 px is the Close button, 69 by 35 px (and no control under 24 by 24) in all three registers (throwaway Playwright script). |
| 4.1.2 Name, role, value | Meets | The open `<dialog>` is named from its first heading: `packages/components/drawer/drawer.js` sets `aria-labelledby` when the author gave no name, and `packages/components/drawer/drawer.check.mjs` asserts the browser's accessibility tree (Playwright `ariaSnapshot`) reads `dialog "The rooms"` in quiet, warm and playful, in Chromium, WebKit and Firefox. It failed before the fix (`dialog:`, no name). axe (`tools/axe.mjs`, open page, 2026-10-07): 0 violations. |

**The page author owns:**

- A heading inside the dialog that is the title, or your own `aria-labelledby` or `aria-label` on the `<dialog>` (4.1.2).
- The heading, text and button words, in the language of the page, and `lang` on a passage in another language (3.1.2).
- A motion switch or the quiet register for the animated backdrop (2.2.2).
- Labels, instructions and errors for any form inside the drawer (3.3.1, 3.3.2).
- A visible way to close it: the demo's Close button, since Escape is not available on every device.
- The colours the page sets for the drawer's contents, if it overrides the tokens.

## Lineage

Drawer's warm and playful backdrop is the Carepa surface; see
[carepa.docs.md](../../surfaces/carepa/carepa.docs.md). Its playful timing
uses the Teental stagger; see `packages/tokens/tokens.js`'s own comments
for that port's lineage note.
