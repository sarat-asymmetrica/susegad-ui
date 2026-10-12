# Bubble

`<sg-bubble>` is a speech, thought or shout bubble around a native `<figure>`. The words are the page's own paragraph; the bubble is the drawing around them, and in warm and playful the words are laid into the drawing's real shape.

## Markup

| Element | What it is |
|---|---|
| `<figure>` | required; the element enhances it |
| `<p>` | the words, one paragraph; plain text gets the line-by-line layout, a paragraph with markup (an `<em>`, a link) is set by CSS instead and keeps its markup |
| `<figcaption>` | optional: who is speaking, if the page wants it written; with no figcaption and a `speaker`, a screen-reader-only one is added |

Put one paragraph in a bubble. For a second thought, use a second bubble.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `kind` | `speech`, `thought`, `shout` | `speech` |
| `tail` | `bottom-left`, `bottom`, `bottom-right`, `top-left`, `top`, `top-right`, `left`, `right`, `none` | `bottom-left` |
| `speaker` | the speaker's name; with no figcaption, adds a caption only a screen reader sees: "Crow says", "Crow thinks", "Crow shouts" | none |
| `label` | the whole caption, written in the page's language; it beats `speaker`'s words, and works without a `speaker` | none |
| `size` | `sm` (14 rem wide at most), `md` (20 rem), `lg` (28 rem) | `md` |
| `seed` | any string, for the pen's hand | the first 60 characters of the words |
| `register` | `quiet`, `warm`, `playful` | inherited |

The bubble is as wide as its container up to the `size`, and it shrinks to fit short words. The tail leaves the body by `--sg-bubble-tail` (1.75 rem); the paragraph keeps that room beside it in every register, so a bubble does not move when the register changes.

## Registers

| | Look | Words | Motion |
|---|---|---|---|
| quiet | a hairline rounded callout with a small tail; a thought is dotted, a shout firm and bold | plain CSS text, no script | none |
| warm | a hand-inked outline: a rounded speech balloon, a cloud with a trail of three circles, a burst of spikes | laid into the shape, line by line, in the hand face | a gentle rise and fade the first time it is seen |
| playful | the same, with a bolder pen, a warm fill, an offset shadow, a seeded tilt of a degree or so, and a torn edge on a shout | laid into the shape, in the hand face (bold for a shout) | pops out of the tail's tip once |

Reduced motion: warm and playful keep the drawing and lose the arrival and the type tier's layout. The words are set by CSS between two floats that hug the same shape (`shape-outside`), so the still looks like the live bubble. Without JavaScript: the quiet look.

## How the words are laid

Three ways, and `data-text` on the element says which is on screen:

- `laid`: the type tier lays the words into the zone and the paragraph holds one `<span>` per line (warm or playful, motion on, plain-text paragraph). The bubble starts about 1.7 times as wide as tall, grows taller up to 0.9 of its width until the words fit at a legible size, and then shrinks, with the same shape, for as long as they still fit at the size the CSS asks for. Pretext is requested only here.
- `hug`: CSS sets the words between two floats whose `shape-outside` is the zone (reduced motion, a paragraph with markup, or text spacing the page has added). The same search runs by measuring the real text.
- `flow`: when even the tallest bubble cannot hold the words at 14 px, the bubble becomes a rounded box with the same tail that grows with plain CSS text. Words are never clipped and never set under 14 px.

The still and its live twin are similar in size, not identical (they can differ by up to 32 px in width): CSS breaks the lines, so the same words can come out a different size. The hidden caption made from `speaker` is marked `lang="en"` (its verbs are English); write a `label` in your language and the page's language applies to it instead.

Text laid by script is left to right. A page that sets letter or word spacing (WCAG 1.4.12) gets the CSS way, whenever the spacing appears.

## Using it

The words are the page's, and so is the speaker's name: write them in the language of the page and put `lang` on a paragraph in another language. The demo's speakers and words are made up. The Devanagari line in the demo is Konkani, a first draft by a non-native writer, and wants a native reader before it is used anywhere.

Touch contract: not interactive, so it does not apply. A link in the paragraph is the page's own and answers a press as any link does (`docs/contributing/touch-contract.md`).

## In another language

The caption's verbs are English until the component has tables for other languages, so on a page in another language write the whole caption yourself with `label`. A screen reader says it before the words, as "Crow says", then the paragraph. These suggestions keep the speaker first and the verb last, which is how Konkani and Kannada order a sentence, and are first drafts for a native reader.

| | says | thinks | shouts |
|---|---|---|---|
| English | Crow says | Crow thinks | Crow shouts |
| Konkani, Devanagari (`gom-Deva`) | क्रो म्हणटा | क्रो चिंतता | क्रो वरडटा |
| Konkani, Romi (`gom-Latn`) | Crow mhonta | Crow chintta | Crow voroddta |
| Kannada (`kn`) | ಕಾಗೆ ಹೇಳುತ್ತಾರೆ | ಕಾಗೆ ಯೋಚಿಸುತ್ತಾರೆ | ಕಾಗೆ ಕೂಗುತ್ತಾರೆ |

Write the speaker's name in the language of the page too (in Kannada the ending is polite and plural, so it fits anyone). Screen readers may have no Konkani voice and read it in a Hindi or Marathi one; the `lang` tag is still right.

## Accessibility

- Native `<figure>` and `<p>`; a laid paragraph is still one paragraph, its lines spans inside it.
- The outline, trail and shadow are `aria-hidden` SVG; the float shapers are empty, hidden elements.
- The kind (speech, thought, shout) is in the caption's words, never only in the shape.

### Conformance (WCAG 2.2 AA)

The table adds a row for a link in the paragraph (2.4.4) and one for the arrival (2.2.2), which the component's traits in `tools/conformance.core.js` do not ask for.

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The outline, trail and float shapers are `aria-hidden` and hold no text: `packages/components/bubble/bubble.check.mjs`, "the drawing adds no words: what is read from each paragraph is the same with and without the skins" (with a control: "art that is not aria-hidden and carries a word shows up in the same probe"). |
| 1.3.1 Info and relationships | Meets | A native `<figure>`, one `<p>`, an optional `<figcaption>`; a laid paragraph keeps its lines as spans in order. `packages/components/bubble/bubble.check.mjs`: "laid lines are in reading order", "every paragraph is selectable text and selects as the words in their order, in every mode", and axe with and without JavaScript, 0 violations. |
| 1.4.1 Use of color | Meets | The kind is in the caption's words ("Crow thinks"); the fill and pen carry no meaning: `packages/components/bubble/bubble.check.mjs`, "a speaker the page names gets a caption a screen reader reads, with the kind's verb". |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/bubble/bubble.check.mjs`, "the words are 4.5:1 or more over every fill (the warmest playful fill included), and the pen 3:1 or more against the page", light and dark, computed from the painted fill and the text colour (with a control: "the contrast probe reads a dark fill under dark words as under 4.5:1"). |
| 1.4.4 Resize text | Meets | `packages/components/bubble/bubble.check.mjs`, "200 percent text": the words are laid again at the bigger size, every line inside its fill, no sideways scroll. |
| 1.4.10 Reflow | Meets | `packages/components/bubble/bubble.check.mjs`, "at 390 px" and "at 320 px": no sideways scroll, every drawing inside the viewport, every line inside its fill. |
| 1.4.11 Non-text contrast | Meets | The pen is `--sg-text` against the page, measured at 3:1 or more in light and dark by the same contrast check in `packages/components/bubble/bubble.check.mjs`. The outline carries no meaning a reader needs; the caption does. |
| 1.4.12 Text spacing | Meets | `packages/components/bubble/bubble.check.mjs`, "WCAG text spacing injected after load": the words are laid again by CSS and every line is inside its fill. |
| 2.2.2 Pause, stop, hide | Not applicable | The only motion is a one-time arrival of under half a second; nothing moves on its own after it. |
| 2.4.4 Link purpose (in context) | Meets with author's part | A paragraph with a link is set by CSS and keeps the link (`packages/components/bubble/bubble.check.mjs`, the paragraph with markup is the hug). The link's text is the author's. |
| 4.1.2 Name, role, value | Meets | Native elements only; the speaker's caption names the figure. `packages/components/bubble/bubble.check.mjs`: axe with and without JavaScript, 0 violations. |

**The page author owns:**

- The words and the speaker's name, in the language of the page, and `lang` on a paragraph in another language (3.1.2).
- The text of a link in the paragraph, so it says where it goes (2.4.4).
- The colours the page sets behind the bubble, if it overrides the tokens.
- The `seed`, if two bubbles with the same words should be drawn differently.
