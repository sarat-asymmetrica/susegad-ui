# Accordion

`<sg-accordion>` is a list of questions and answers for an FAQ. It enhances the
browser's own `<details>` and `<summary>`: the browser does the opening and
closing, with or without JavaScript.

## Markup

| Element | What it is |
|---|---|
| `details` (children of the element) | one question. Several sharing the same `name` form an exclusive group: only one open at a time. |
| `summary` | the question, one per details. It is the reader's toggle: Tab to it, Enter or Space to turn it. |
| everything after the summary | the answer, plain markup (paragraphs, lists, links). Write it as you would any prose. |

The element adds no words and no structure of its own. Two things it does add:

- A `name` attribute on the element becomes the group for every child that has none. A child that already carries its own `name` keeps it, so one accordion can hold an exclusive group and free-standing sections side by side.
- Attributes for the skins: `data-skin` (set by the element), `data-motion`, `data-open-count`, `data-any-open`.

Two or more items of one group starting `open` are settled by the browser while parsing: it keeps the first and drops the rest. Check the source with `resolveOpen()` from the pure core at build time if you want the clash named where an author can see it.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `name` | a group name for the children that have none | none: every item stands alone unless it carries a name |
| `register` | `quiet`, `warm`, `playful` | inherited |

Event: `sg-accordion-change` `{ open, total, exclusive }`, when an item moves (`open` is the indices now open). The element also exposes `details` (its items), `items` (`{ name, open, label }[]`) and `account` (`{ total, open, exclusive, groups }`) for a page that wants the state in JS.

## The platform owns the behaviour

- A summary is a real toggle: it takes Tab, opens on Enter and Space, and shows a 2 px focus ring.
- Screen readers get the open and closed state from the `<details>` itself; the element adds no ARIA, because none is needed.
- The exclusive group is `<details name="…">`, native in Chromium and Safari, Firefox from 130.
- Without JavaScript everything still opens and closes. The quiet look applies.

## Registers

| | Look |
|---|---|
| quiet | hairline rules between items and across the top of the first, generous space, a thin chevron that turns when the item opens. No ornament. |
| warm | the marker drawn in the hand face: a small hand-set `+` that becomes a `–` when the item opens, and a soft open transition (the answer slides down and fades in). |
| playful | the questions set in the hand face; the marker a drawn glyph in the accent colour, each with its own small seeded tilt, that flips 180 degrees with a spring when the item opens. |

Nothing moves under reduced motion: every register keeps its finished still, and an item still opens and closes.

## Sample

```html
<link rel="stylesheet" href="susegad/components/accordion/accordion.css">
<script type="module" src="susegad/components/accordion/accordion.js"></script>

<sg-accordion name="faq">
  <details name="faq" open>
    <summary>Where is the homestay, and how do I get there?</summary>
    <p>In Aldona, a village in the fields north of Panjim. Half an hour by car or bus; we send directions when you book.</p>
  </details>
  <details name="faq">
    <summary>Is breakfast included?</summary>
    <p>Yes, on the veranda from 7:30 to 10.</p>
  </details>
</sg-accordion>
```

## Accessibility notes

- No ARIA: `<details>` and `<summary>` already say everything. Adding `role` or `aria-expanded` here would only be noise.
- The drawn markers and the open rule are decoration on a pseudo-element; they carry no meaning and sit outside the accessibility tree.
- The focus ring is visible on every register, and the summary is reachable in the tab order in the order the questions are written.
- At phone width nothing scrolls sideways; the answer wraps inside the measure.

## Pure core

`accordion.core.js` runs in Node with no DOM: `groupsOf(items)` and `namedGroups(items)` for the exclusive groups, `resolveOpen(items)` for which items should start open (the first of each named group, the rest closed, each with a warning), `describeItems(items)` for the open account (`{ total, open, exclusive, groups }`), and `othersToClose(items, index)` for what one turn of a named item closes. An item is `{ name, open, label }`. Build steps and tests use these; the element uses `describeItems`.
