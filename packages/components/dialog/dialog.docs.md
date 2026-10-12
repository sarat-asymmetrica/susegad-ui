# Dialog

`<sg-dialog>` wraps and enhances a native `<dialog>`: `showModal()` traps
focus and blocks the page, `Escape` closes it, and the browser returns focus
to whichever element opened it. In warm and playful, its backdrop is the
[Carepa surface](../../surfaces/carepa/carepa.docs.md), a Goan window that
keeps the page behind present but never legible through it (see Carepa's own
lineage note there). Quiet uses a plain dimmed backdrop instead.

## Usage

```html
<a href="/ask-the-house" data-sg-dialog="ask">Ask the house</a>
<button type="button" commandfor="ask-dialog" command="show-modal">Ask the house</button>

<sg-dialog id="ask">
  <dialog id="ask-dialog">
    <h2>Ask the house</h2>
    <p>Tell us your dates and how many are coming.</p>
    <form method="dialog">
      <menu>
        <button type="submit" value="dismiss">Cancel</button>
        <button type="submit" value="ok">Send</button>
      </menu>
    </form>
  </dialog>
</sg-dialog>
```

```js
import '…/core/index.js';
import '…/components/dialog/dialog.js';

const dlg = document.getElementById('ask');
dlg.addEventListener('sg-dialog-close', e => {
  if (e.detail.returnValue === 'ok') { /* the form's own submit already ran */ }
});
```

- **A `<button commandfor="ask-dialog" command="show-modal">` opens it with no script at all**: `commandfor` names the native `<dialog>`'s `id` (put the `id` on the `<dialog>`, as the usage above shows). The element still sees the opening, so the skin mounts and `sg-dialog-open` fires. `command="close"` and `command="request-close"` work the same way. In a browser without invoker commands (iOS before 26.2) the element gives those buttons a click handler that does the same; a button naming the `<sg-dialog>`'s own id works with the script.
- Any element anywhere on the page with `data-sg-dialog="<the sg-dialog's id>"` opens it: `<sg-dialog>` finds them on connect and upgrades their click. **Without JavaScript, that element is a real link to a real page** (`href`), so nothing is unreachable; `data-sg-dialog` is simply ignored and the browser navigates.
- Use `<form method="dialog">` for the actions: submitting sets the native `<dialog>`'s `returnValue` to the submitter's `value` and closes it, with no JavaScript required.
- `dlg.show()` opens it programmatically; `dlg.close(value)` closes it. `dlg.open` (the read-only property) is `true` while shown.
- Events: `sg-dialog-open`, `sg-dialog-close` (`detail: { returnValue }`), `sg-dialog-cancel` (fired for Escape, before close).
- Clicking the dimmed fill outside the card closes the dialog in every register (the click lands on the `<dialog>` element itself, not inside `.sg-dialog-card`). A press that starts inside the card and is let go outside it (selecting text, dragging off a button) does not.

## Registers

- **Quiet**: an own-sized box, centred, with a plain dimmed `::backdrop`. No Carepa; nothing is mounted. It arrives and leaves in 120 ms of opacity and nothing else.
- **Warm**: the dialog becomes full-bleed; the Carepa surface fills it behind a floating card holding your content, only while the dialog is open. The card rises a little as it arrives (180 ms).
- **Playful**: the same Carepa backdrop, brighter (`register: 'playful'` on the surface), with the card rising and giving a little on the spring (260 ms).

Entry is a CSS transition from `@starting-style`; leaving is a fade where the browser can keep the dialog in the top layer while it goes (the `overlay` property, Chromium today), and instant elsewhere. Reduced motion shows it at once. The card's buttons are pressed like every Susegad control: the state answers in the same frame, with no transition, and eases back in under 150 ms. Quiet settles 1 px, warm shades the colour toward the ink, playful gives a little (scale 0.97, released on the spring). The keyboard never moves it, and under reduced motion the shade stays and the movement goes.

## Accessibility

- Focus is trapped natively inside the `<dialog>` while it is open (`showModal()`); it returns to the opener on close.
- Escape closes it; `sg-dialog-cancel` fires first, so a caller can prevent nothing being lost (the native `cancel` event itself is not prevented by this component; listen on the native `<dialog>` if you need to stop Escape).
- The `<dialog>` is named for you. A modal `<dialog>` has no accessible name of its own (Chromium reads it as `dialog:`), so when you give it neither `aria-label` nor `aria-labelledby`, the component points `aria-labelledby` at the first heading inside it (an `h1` to `h6`, or `role="heading"`). If your first heading is not the title, set `aria-labelledby` or `aria-label` yourself; the component leaves yours alone.
- The scrim (`.sg-dialog-scrim`) is `aria-hidden`; it carries no meaning, only theatre.
- Contrast: `.sg-dialog-card`'s background is `color-mix(in oklab, var(--sg-surface-raised) 96%, transparent)`, checked against Carepa's brightest sheen in every register and theme.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The scrim and the warm and playful backdrop are `aria-hidden` and carry no meaning (`packages/components/dialog/dialog.check.mjs` and the scrim layer in `packages/components/dialog/dialog.js`). The dialog's content is the author's markup. |
| 1.3.1 Info and relationships | Meets | Manual test, 2026-10-07: a native `<dialog>` opened with `showModal()`, with a heading and the author's own markup; the open dialog's accessibility tree at 320 px (Playwright `ariaSnapshot`) is a `dialog` holding its heading, paragraph and controls in order. Its name is under 4.1.2. |
| 1.4.1 Use of color | Meets | The primary button is told from the others by its position and words as well as its fill (`packages/components/dialog/dialog.css`, `button[value="ok"]`); nothing in the dialog depends on colour alone. |
| 1.4.3 Contrast (minimum) | Meets | Text is `--sg-text` on `--sg-surface-raised`, tested at 4.5:1 or more in `packages/tokens/tokens.test.js`. In warm and playful the card is 96 to 97 percent opaque over the backdrop, so axe lists `color-contrast` as "to review by hand" on the open dialog (`tools/axe.mjs` run on the open page, 2026-10-07: 0 violations, `color-contrast` incomplete). Manual test, 2026-10-07: a throwaway script mixed `--sg-surface-raised` at that opacity over pure black and over pure white and measured `--sg-text` and `--sg-text-soft` on it: 4.5:1 or more in every palette, light and dark. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: the dialog opened with the root font size at 200 percent in three registers (1280 px wide), the card stays inside the viewport, no sideways scroll, no clipped text (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px, three registers, 2026-10-07: the dialog opened, no sideways scroll, nothing past the viewport edge; the card scrolls inside itself when it is taller than the screen (`overflow: auto` in `packages/components/dialog/dialog.css`). |
| 1.4.11 Non-text contrast | Meets | The card's button borders are `--sg-rule-strong` and the focus ring is `--sg-focus`, both tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`; the accent button's fill is tested against `--sg-surface-raised` in `packages/components/button/button.test.js`, which uses the same tokens. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the open dialog in three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.13 Content on hover or focus | Not applicable | The dialog opens when the reader presses the opener, not when the pointer hovers or focus lands, and it holds no hover or focus popups of its own. |
| 2.1.1 Keyboard | Meets | `packages/components/dialog/dialog.check.mjs`: "Enter on the opener shows the dialog modally" with Enter or a click, Escape closes it, and every control inside is a native button, link or field. |
| 2.1.2 No keyboard trap | Meets | `dialog.check.mjs`: "Escape closes the dialog" and "focus returns to the opener", and "Tab never leaves the open dialog onto real page content"; Tab wraps inside it through the browser's own controls ("at most one transient body stop per wrap, never stuck"). Escape is always a way out. |
| 2.2.2 Pause, stop, hide | Meets with author's part | In warm and playful a slow light (a drifting sun, `driftSun` in `packages/surfaces/carepa/model.js`) moves on the backdrop while the dialog is open. It is drawn once as a finished still under reduced motion (`reducedMotion: ctx.motion === 'still'` in `packages/components/dialog/skins/warm.js`) and quiet draws none. There is no on-page pause control, so a page that uses warm or playful owns offering the quiet register or a motion switch. |
| 2.3.1 Three flashes or below threshold | Meets | The backdrop is a slowly drifting light with no flashing (`packages/surfaces/carepa/model.js`). |
| 2.4.3 Focus order | Meets | The order is the markup's inside a native modal `<dialog>`, and focus returns to the opener on close (`dialog.check.mjs`: "focus returns to the opener"). Manual test, 2026-10-07: Tab through the open dialog at 320 px visited its controls in reading order in all three registers. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` requires a focus style in every register; the rule is `:focus-visible` in `packages/components/dialog/dialog.css`. |
| 2.4.11 Focus not obscured (minimum) | Meets | Manual test, 2026-10-07: at 320 by 640 px the dialog opened and Tab pressed eight times in each register; every focused control was fully inside the viewport and the element at its centre was the control itself (`elementFromPoint`). A modal dialog sits in the browser's top layer, so a sticky bar of the page cannot cover it. |
| 2.5.3 Label in name | Meets | Buttons are named by their visible text, because the component adds no `aria-label` (`packages/components/dialog/dialog.js`). |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: the smallest control in the open dialog at 320 px is 67 by 35 px (and no control under 24 by 24) in all three registers (throwaway Playwright script). |
| 4.1.2 Name, role, value | Meets | The open `<dialog>` is named from its first heading: `packages/components/dialog/dialog.js` sets `aria-labelledby` when the author gave no name, and `packages/components/dialog/dialog.check.mjs` asserts the browser's accessibility tree (Playwright `ariaSnapshot`) reads `dialog "Ask the house"` in quiet, warm and playful, in Chromium, WebKit and Firefox. It failed before the fix (`dialog:`, no name). axe (`tools/axe.mjs`, open page, 2026-10-07): 0 violations. |

**The page author owns:**

- A heading inside the dialog that is the title, or your own `aria-labelledby` or `aria-label` on the `<dialog>` (4.1.2).
- The heading, text and button words, in the language of the page, and `lang` on a passage in another language (3.1.2).
- A motion switch or the quiet register for the animated backdrop (2.2.2).
- Labels, instructions and errors for any form inside the dialog (3.3.1, 3.3.2).
- A visible way to close it: the demo's Cancel button, since Escape is not available on every device.
- The colours the page sets for the dialog's contents, if it overrides the tokens.

## Lineage

Dialog's warm and playful backdrop is the Carepa surface. See
[carepa.docs.md](../../surfaces/carepa/carepa.docs.md) for the full *after*,
*took*, *left* note.
