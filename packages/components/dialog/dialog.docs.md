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

<sg-dialog id="ask">
  <dialog>
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

- Any element anywhere on the page with `data-sg-dialog="<the sg-dialog's id>"` opens it: `<sg-dialog>` finds them on connect and upgrades their click. **Without JavaScript, that element is a real link to a real page** (`href`), so nothing is unreachable; `data-sg-dialog` is simply ignored and the browser navigates.
- Use `<form method="dialog">` for the actions: submitting sets the native `<dialog>`'s `returnValue` to the submitter's `value` and closes it, with no JavaScript required.
- `dlg.show()` opens it programmatically; `dlg.close(value)` closes it. `dlg.open` (the read-only property) is `true` while shown.
- Events: `sg-dialog-open`, `sg-dialog-close` (`detail: { returnValue }`), `sg-dialog-cancel` (fired for Escape, before close).
- Clicking the dimmed fill outside the card closes the dialog in every register (the click lands on the `<dialog>` element itself, not inside `.sg-dialog-card`).

## Registers

- **Quiet**: an own-sized box, centred, with a plain dimmed `::backdrop`. No Carepa; nothing is mounted.
- **Warm**: the dialog becomes full-bleed; the Carepa surface fills it behind a floating card holding your content, only while the dialog is open.
- **Playful**: the same Carepa backdrop, brighter (`register: 'playful'` on the surface), with the card landing with a small press. Cancelled outright under reduced motion.

## Accessibility

- Focus is trapped natively inside the `<dialog>` while it is open (`showModal()`); it returns to the opener on close.
- Escape closes it; `sg-dialog-cancel` fires first, so a caller can prevent nothing being lost (the native `cancel` event itself is not prevented by this component; listen on the native `<dialog>` if you need to stop Escape).
- `<h2>`/`<h3>` inside the card gives the dialog its accessible name via the browser's own dialog-labelling heuristics; give the `<dialog>` an explicit `aria-labelledby` if your first heading is not the title.
- The scrim (`.sg-dialog-scrim`) is `aria-hidden`; it carries no meaning, only theatre.
- Contrast: `.sg-dialog-card`'s background is `color-mix(in oklab, var(--sg-surface-raised) 96%, transparent)`, checked against Carepa's brightest sheen in every register and theme (see Karigar's report for the measured cells).

## Lineage

Dialog's warm and playful backdrop is the Carepa surface. See
[carepa.docs.md](../../surfaces/carepa/carepa.docs.md) for the full *after*,
*took*, *left* note.
