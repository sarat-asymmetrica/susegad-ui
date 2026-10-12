# Bloom

`<sg-bloom>` draws a flower head laid out by Vogel's model, seen face-on. The first kind is the zendu, the marigold. Use it for a count that should be seen as well as read, for a placeholder in place of a photograph, and for a greeting card that is different for everyone who gets one.

## Use

```html
<link rel="stylesheet" href="susegad/components/bloom/bloom.css">
<script type="module" src="susegad/components/bloom/bloom.js"></script>

<!-- a bloom for one person: the same name always grows the same flower -->
<sg-bloom seed-from="Maria Fernandes" label="Maria's bloom" size="lg"></sg-bloom>

<!-- an honest count: 37 florets, and the number in text beside them -->
<sg-bloom count="37" label="people registered"></sg-bloom>

<!-- your own words: the picture follows them -->
<sg-bloom count="12">12 volunteers have taken a stall.</sg-bloom>
```

When a count changes, change the attribute. The florets already placed stay where they are and one more arrives (or the outermost one leaves):

```js
document.querySelector('sg-bloom').setAttribute('count', registered);
```

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `kind` | `zendu` | `zendu` |
| `count` | a whole number, 0 or more | none: a full head of 144 and no number beside it |
| `seed`, `seed-from` | any text; a name works well. `seed-from` wins if both are given | `bloom` |
| `label` | what the bloom stands for | none |
| `size` | a number of pixels, `sm` (4rem), `md` (8rem), `lg` (14rem), or a CSS length | `md` |
| `register` | `quiet`, `warm`, `playful` | inherited |

The seed is hashed by the engine's `hashSeed`, so the same text gives the same bloom every time and a different text gives a different one. It is case sensitive: "Asha" and "asha" are two flowers.

## What assistive technology gets

The words come first, and the picture follows them. Exactly one of these holds:

| You write | The picture is | Beside it |
|---|---|---|
| words inside the element | hidden | your words |
| `count`, with or without `label` | hidden | the number, and the label if there is one ("37 people registered"), written by the element |
| `label` and no `count` | an image named by the label | nothing |
| none of these | decoration, hidden | nothing |

So a number is never only in the picture. A bloom with a count of 0 shows no florets and says "0".

## Accessibility

The words come first and the picture follows them: see "What assistive technology gets" above. The bloom takes no keyboard focus and has nothing to operate.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | Exactly one of four cases holds (see "What assistive technology gets"): words you wrote with the picture hidden, a `count` written as text with the picture hidden, a `label` with no count as an image named by it, or decoration hidden. `packages/components/bloom/bloom.check.mjs`: "no words, no label: the picture is decoration", "a label and no count: the picture is an image with that name", "a count and a label: the number and label are text beside the picture, and the picture is hidden", "the author wrote the words: nothing is added beside them and the picture is hidden", and a control that fails the probe: "the aria probe can fail". |
| 1.3.1 Info and relationships | Meets | A count is text beside the picture, never only in it (`bloom.check.mjs`: "a count of zero is a number too, in text", "count 5 → 9: the text and the florets follow", "JavaScript off: the words the author wrote are plainly there"). |
| 1.4.1 Use of color | Meets | The count is a number in text; the florets are the same shape in every register and the head is a picture of the number, not a colour code. Forced colours draw the head in the text colour (`bloom.check.mjs`: "forced colours: the head is one system colour, edged in the page colour, with no tints"). |
| 1.4.3 Contrast (minimum) | Meets | The only text is the count and label the element writes, in the page's text colour. `bloom.check.mjs`: "axe, <theme>, the whole demo (<n> blooms, three registers): 0 violations" in light and dark, while the florets are arriving, in the middle of a press shiver, and with JavaScript off. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the demo page in quiet, warm and playful, with the root font size at 200 percent at 1280 px wide, and at 320 px wide (plain, and with the WCAG text-spacing values injected: line height 1.5, letter 0.12em, word 0.16em, paragraph 2em); the page was never wider than the screen (document scroll width minus window width was 0 in every case) and no box that hides its overflow had text running out of it. The clipping probe is coarse (it only sees boxes with `overflow: hidden`). |
| 1.4.10 Reflow | Meets | `bloom.check.mjs`: "phone width, <register>: no sideways scroll, even for a bloom asked to be 640 px wide". Manual test, 2026-10-07: the demo at 320 px in three registers, document scroll width 320 (see 1.4.4). |
| 1.4.11 Non-text contrast | Not applicable | The flower is a picture beside its own words: the count it shows is also written as text, and a `label` with no count names the picture as an image that stands for something rather than carrying data. No part of it is a control or a state indicator, so there is no boundary to hold at 3:1. In forced colours the head is drawn in the text colour (`bloom.check.mjs`: "forced colours: the head is one system colour ..."). |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the demo page in quiet, warm and playful, with the root font size at 200 percent at 1280 px wide, and at 320 px wide (plain, and with the WCAG text-spacing values injected: line height 1.5, letter 0.12em, word 0.16em, paragraph 2em); the page was never wider than the screen (document scroll width minus window width was 0 in every case) and no box that hides its overflow had text running out of it. The clipping probe is coarse (it only sees boxes with `overflow: hidden`). |
| 2.2.2 Pause, stop, hide | Not applicable | Nothing runs for more than five seconds: a head grows once when first seen and the whole growth is over in under 1.5 s, then nothing is left running (`bloom.check.mjs`: "the whole growth is over in under 1.5 s, and each floret takes the calm duration of the register", "when it has grown, nothing is left running and no floret is left marked new"). Reduced motion and Save-Data show the finished head ("<what>: the finished head, no growth and no shiver"). |
| 2.3.1 Three flashes or below threshold | Meets | Each floret scales up once from its own base, one after another from the heart outward over under 1.5 s, and a press makes the outer ring rotate a few degrees over 280 ms, once per press (`packages/components/bloom/bloom.css`, `sg-bloom-grow` and `sg-bloom-shiver`; `bloom.check.mjs`: "the shiver is inside the touch contract: each floret under 300 ms", "and it lets go: nothing is left running"). Nothing flashes or repeats. |
| 4.1.2 Name, role, value | Meets | An image named by `label`, or hidden when the words beside it say it; it takes no keyboard focus and has nothing to operate (the press shiver is a flourish and does nothing else). `bloom.check.mjs`: "axe without JavaScript: 0 violations" and the axe cells under 1.4.3. |

**The page author owns:**

- A `label` in the page's language, and `lang` on it if it differs from the page (3.1.2).
- Words that say what the count or the picture means, in the page's language, when the bloom is more than decoration.
- The colours the page sets behind the bloom, and where it sits near deity imagery or a puja setting (see "A note on the flower").


## Registers

| Register | What you see |
|---|---|
| quiet | One ink. The florets are dots in the text colour on the page. Still. |
| warm | The zendu in its own colours: ruffled orange or saffron petals, darker and redder at the rim, lighter at the heart, each over a dark crevice, lit from the upper left. Still. |
| playful | The same flower, grown from the heart outward each time it is first seen, with the last floret starting by 1.1 seconds however many there are. A touch or click gives the outer ring a small shiver, each petal's lasting 280 ms. It is a flourish and does nothing else, so it is never the only way to anything, and the bloom takes no keyboard focus. |

Reduced motion and Save-Data show the finished head, with no growth and no shiver. Save-Data steps playful down to warm, as it does for every component. A playful head that is below the fold waits, with its florets unseen, and grows when it scrolls into view.

In forced colours the head is drawn in the text colour, each petal edged in the page colour, without the tints.

## The cap

A bloom draws at most 400 florets. A count bigger than that is a number, not a flower. The number beside it is still the real one: `count="600"` shows "600" and draws 400.

Up to a full head of 144 florets, every head uses one scale, so a head of 37 is a smaller head and not the same head with huge florets, and adding one never moves the others. Past 144 the florets shrink to keep the head the same size, so a change of count there lays the head out again, without growing it.

## Events and the growth

`sg-bloom-grown` fires on the element once every floret of a growing head has arrived. While a head grows the element carries `data-state="growing"`.

The growth is CSS. Each floret is marked `data-new` while it grows and waits `rank × --sg-bloom-step` before it scales up from its own base, where its rank is its place counted from the heart. The rank is `sibling-count() - sibling-index()` where the browser has those functions, and the `--i` the element wrote on the floret where it does not. The DOM runs from the rim to the heart, which is the order the petals must be painted in (the heart on top), so the two give the same answer. The check proves it in every engine that has `sibling-index()`; where one has not, the rank is the `--i` itself.

## Where it goes

- The greeting card: a bloom seeded from the guest's name, with the name and a line of text, exported to PNG to keep and JPG to share. See the `greeting-card` recipe.
- An honest count on an event or sign-up page.
- A placeholder in a member list where a person has no photograph.

## A note on the flower

The zendu is drawn here as a flower, as a flower seller has it on a tray. Do not set it beside deity imagery or frame it as a puja element. If a client's festival or ceremony asks for flowers in that setting, the client leads and decides how they appear.

## Credit

The marigold's palette and petal come from the toran scene's `drawMarigold`, which brought them from the Susegad sketchbook. The layout is Vogel's 1979 model of the sunflower head. Motif tier: everyday.
