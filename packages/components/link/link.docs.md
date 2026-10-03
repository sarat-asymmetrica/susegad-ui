# Link

`<sg-link>` wraps one native `<a href>`. It takes the keyboard and navigates with or without JavaScript. The register draws the underline; the native anchor carries every behaviour.

## Use

```html
<link rel="stylesheet" href="susegad/components/link/link.css">
<script type="module" src="susegad/components/link/link.js"></script>

<sg-link><a href="/rooms">See the rooms</a></sg-link>
```

## Attributes and properties

| | Values | Default |
|---|---|---|
| `seed` | any string, for the drawn line's wobble | the link's own text |
| `register` | `quiet`, `warm`, `playful` | inherited |

## Registers

| | Look | Motion |
|---|---|---|
| quiet (and no JS) | a plain hairline underline, the browser's own | none beyond the native hover colour change |
| warm | an ink underline drawn a little off true | it draws in on hover or focus, and draws back out on leave, as a stroke length transition |
| playful | the underline as a kolam line: one continuous wave with a small knotted loop | always drawn; no extra motion of its own |

Reduced motion: warm's draw-in transition collapses to instant (the tokens' `--sg-dur-calm` goes to near zero); nothing else moves. Forced colours: the browser's own underline and link colour, drawings hidden.

## Accessibility

- The native `<a>` is the whole control: `href`, `:visited`, keyboard activation.
- A link is never told apart by colour alone: quiet and warm each carry a real underline (native or drawn); playful's wave serves the same purpose.
- Link text and the drawn ink hold 4.5:1 and 3:1 in every palette and theme (tested).

## Budget

Behaviour 1.6 KB (`link.js` + `link.core.js`); skins quiet 0.1 KB, warm 1.1 KB, playful 0.9 KB.
