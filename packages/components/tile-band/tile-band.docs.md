# Tile band

`<sg-tile-band>` is a band of hand-painted tiles for a border or a divider. It is a decoration component and not a scene: its box is the band (a length and a thickness the page chooses, along the page or down it), and it has no loop. It is painted once on a canvas and kept.

## Markup

```html
<sg-tile-band></sg-tile-band>
<sg-tile-band tones="majolica" seed="church"><hr></sg-tile-band>
<sg-tile-band orientation="vertical" style="height: 20rem"></sg-tile-band>
```

An `<hr>` inside makes it a divider: the `<hr>` is the separator for assistive technology and, without JavaScript, the cobalt hairline. Without one the band is `aria-hidden`.

## Attributes and sizing

| Attribute | Values | Default |
|---|---|---|
| `tones` | `azulejo` (blue and white), `majolica` (cobalt, lemon, leaf green) | `azulejo` |
| `seed` | any text or number: the same seed lays the same tiles | `azulejo` |
| `orientation` | `horizontal`, `vertical` | `horizontal` |
| `register` | `quiet`, `warm`, `playful` | inherited |

`--sg-tile-size` is the tile you would like (default 4rem, 3.25rem on a phone). The band fits whole square tiles to its length and sets `--sg-tile-fit` to the size that makes them fit, which is also its thickness. A vertical band needs a height: give it one, or let a grid or flex parent stretch it (it has a minimum of 12rem).

## The motifs

Four, geometric and floral only: a **rosette** (petals and corner fans), a **quatrefoil** (four lobes and a diamond), **corners** (quarter-circle rings) and a **vine** (a stem that runs edge to edge so neighbouring vines join). Two alternate along the band, an accent of another turns up every six to nine, and no two neighbours are alike. No figures and no religious symbols.

## Registers

| | Look |
|---|---|
| quiet | a cobalt hairline on the page, flat: line art only, no fills, following the theme (lighter cobalt at night) |
| warm | a hand-painted glaze: white tiles that keep their colours by day and night, brushwork with a bleed under each stroke, glaze pooled at the edges, a sheen, a bevel, a fine crackle, and each tile a hair off true |
| playful | warm, and a tile turns a quarter when a pointer passes over it or a finger taps it, swings a little past and settles |

Under reduced motion nothing turns. The colours come from `--sg-cobalt`, `--sg-wash`, `--sg-lemon`, `--sg-leaf` and `--sg-glaze` (the `azulejo` palette defines them) and fall back to the same values on any other palette.

## No idle frames

The band repaints only when something that changes the picture changes: its length, the wanted size, the pixel ratio, the register's look, the colours, the seed, the tones or the direction. A turn runs a `requestAnimationFrame` for about half a second and stops. An idle band records zero frames.

## Registry

`motif: { origin: "goa", tier: "everyday", gloss: "Azulejo: the painted tiles of Goa's Portuguese-era houses and churches; majolica is its Mediterranean cousin." }`

## Accessibility

- Decoration is hidden from assistive technology; a divider is a real `<hr>`.
- Turning a tile is a flourish for pointer and touch; there is nothing to operate, so it is not in the tab order.
- High-contrast mode replaces the canvas with a plain line.
