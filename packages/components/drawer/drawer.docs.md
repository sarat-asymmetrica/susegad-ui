# Drawer

`<sg-drawer>` is Dialog's sibling: the same native `<dialog>` modal contract
(`showModal()`, Escape, native focus return), laid out as a panel sliding
in from an edge instead of a centred card. In warm and playful, its backdrop
is the [Carepa surface](../../surfaces/carepa/carepa.docs.md); playful times
the slide's start to the Teental stagger's first beat.

## Usage

```html
<a href="/rooms" data-sg-drawer="rooms">The rooms</a>

<sg-drawer id="rooms" edge="end">
  <dialog>
    <h2>The rooms</h2>
    …
    <form method="dialog"><button type="submit" value="dismiss">Close</button></form>
  </dialog>
</sg-drawer>
```

- `edge` is `start`, `end` (default), `top` or `bottom`. `start`/`end` are
  logical, so a right-to-left page gets the mirror image for free.
- Same opener contract as Dialog: any element with `data-sg-drawer="<id>"`
  opens it, upgraded from a real link's click; without JavaScript it is a
  real link to a real page.
- `dlg.show()` opens it; `dlg.close(value)` closes it; `dlg.open` is `true`
  while shown.
- Events: `sg-drawer-open`, `sg-drawer-close` (`detail: { returnValue }`),
  `sg-drawer-cancel`.

## Registers

- **Quiet**: a hairline panel at the edge, full height (or full width for
  `top`/`bottom`), sliding a plain transform.
- **Warm**: a paper panel with a deckled edge (a repeating mask, so it works
  at any panel height) over the Carepa scrim.
- **Playful**: the same, brighter, with the slide's start delayed by
  `talaDelay(1)` from `packages/tokens/tokens.js` (one beat into the
  sixteen-beat cycle, not the very first) — a small anticipatory pause
  before the panel moves, never more than 130ms, well under the charter's
  600ms cap for a stagger's last item.

## Accessibility

Identical to Dialog: focus trapped by `showModal()`, returned to the
opener on close, Escape closes it, the scrim is `aria-hidden`. `edge="top"`
and `edge="bottom"` still trap focus and block the page exactly as
`edge="end"` does; only the layout differs.

## Lineage

Drawer's warm and playful backdrop is the Carepa surface; see
[carepa.docs.md](../../surfaces/carepa/carepa.docs.md). Its playful timing
uses the Teental stagger; see `packages/tokens/tokens.js`'s own comments
and `docs/briefs/progress/karigar-motion.md` for that port's lineage note.
