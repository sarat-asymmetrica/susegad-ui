# Person card

`<sg-person-card>` is one person, and what they are building. It enhances an `<article>`.

## Markup

| Element | What it is |
|---|---|
| a heading (`h2` to `h4`) | the person's name; the article is named by it, and the initials are cut from the same words |
| `p.sg-person-role` | their role in a few words ("Teacher, Aldona") |
| `p.sg-person-building` | one line on what they are building |
| `p.sg-person-link` | one link: their site, a profile or an email. The card never writes a link. |
| `img.sg-person-photo` | optional, and only with that person's consent (see below). Written by you; it takes the disc's slot exactly. |

## The initials, not a photo

By default the card shows no photo. The element adds an `aria-hidden` disc with the
person's initials, cut from the heading by `initialsOf(name)` in `person.core.js`:
first and last word ("Sarita Fernandes" gives "SF"), one initial for a single name,
middle names skipped, edge spaces trimmed, "" when the name has no letters at all
(the disc is then plain, and the heading is read as usual).

A photo goes on the card only when the person gave it and their consent is recorded
wherever you keep such things. Put the `<img class="sg-person-photo" alt="…">` inside
the article yourself; the element notices it and takes the disc away. The card never
fetches a photo of its own, and nothing here implies consent.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `data-track` | one of the project's tracks ("AI for Kids", "Tech for Good", ...) | none; the member-directory recipe reads it |
| `seed` | the playful disc's colour and the card's tilt | the name |
| `register` | `quiet`, `warm`, `playful` | inherited |

Event: `sg-person-ready` when the disc is first drawn.

## Registers

| | Look |
|---|---|
| quiet | a hairline card, the initials in a plain disc |
| warm | a soft card with a wash at the top, the initials in the hand |
| playful | a colour disc, its hue seeded, the name in the hand, and a small seeded tilt that arrives on hover or focus and settles back |

Reduced motion keeps every register still.

## Accessibility

- The `<article>` is named by the person's own heading.
- The initials disc is `aria-hidden`; the name is read as words, not letters.
- The link is an ordinary link: it takes Tab and shows a focus ring.
- A photo needs a real `alt` you write; the element fills only a missing `alt`.
- Without JavaScript the markup you wrote shows in full, in the quiet look.

### Conformance (WCAG 2.2 AA)

The table adds rows for the card's link (2.4.7, 2.5.8), which the component's traits in `tools/conformance.core.js` do not ask for.

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The initials disc is `aria-hidden` and the heading is read as words: `packages/components/person-card/person-card.check.mjs`, "the disc is not in the accessibility tree (aria-hidden), so the heading is read as words". A photo needs the author's `alt`; the element only fills a missing one with "<name>'s photo" ("a photo without alt gets one filled from the name"). |
| 1.3.1 Info and relationships | Meets | An `<article>` named by the person's own heading, with the role, the building line and the link as real elements. `person-card.check.mjs`: "without JavaScript: name, role, building line and link show on every card", and axe without JavaScript: 0 violations. |
| 1.4.1 Use of color | Meets | The link keeps its underline (`packages/components/person-card/person-card.css` sets only the offset and thickness); the playful card's seeded hue and tilt are decoration. |
| 1.4.3 Contrast (minimum) | Meets | Text roles on the page surface: `packages/tokens/tokens.test.js` ("AA: every text role on every surface is 4.5:1 or more") for every palette and theme; `person-card.check.mjs` runs axe in light and dark, all three registers: 0 violations. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | `person-card.check.mjs`: "at 390 px the <register> demo does not scroll sideways". Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). |
| 1.4.11 Non-text contrast | Meets | The initials disc is decoration beside the name in words, and the focus ring is tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `packages/components/person-card/person-card.check.mjs`: "<register>: Tab reaches the link ... and it shows a focus ring" in each register, and "a card with no link puts nothing on Tab (nothing was invented for it)". The card's only control is the author's native link. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/person-card/person-card.js` and its skins bind no key handler, set no `tabindex` and call no `focus()`, so Tab and Shift+Tab pass through the native links. |
| 2.4.3 Focus order | Meets | Manual test, 2026-10-07 (throwaway Playwright script): the person-card demo at 390 px in quiet, warm and playful, Tab pressed through every stop (4 stops in each register, one link per card); each focused control was on screen and not covered (the element at its centre is the control itself) and every stop came after the previous one in document order. The same script on a page with a full-screen fixed layer added reported every stop covered, so it can fail. Each card has at most one stop, so the order is the order of the cards. |
| 2.4.4 Link purpose (in context) | Meets with author's part | The link is the author's own link text ("Her notes", `packages/components/person-card/person-card.check.mjs`: "without JavaScript: name, role, building line and link show on every card"), under the person's heading in the same article. Whether it says enough alone is the author's. |
| 2.4.7 Focus visible | Meets | `person-card.check.mjs`: "<register>: Tab reaches the link ... and it shows a focus ring"; `tools/touch.check.mjs` requires a focus style in each register. A card with no link puts nothing on Tab ("a card with no link puts nothing on Tab"). |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | `packages/components/person-card/person-card.css` has no `position: fixed` or `sticky`, so the component never covers a focused control itself. Manual test, 2026-10-07 (throwaway Playwright script): the person-card demo at 390 px in three registers, every Tab stop was on screen and not covered (the element at its centre is the control itself); the same script with a full-screen fixed layer added reported every stop covered, so it can fail. |
| 2.5.3 Label in name | Meets | The link is named by its own visible text because the component adds no `aria-label` to it (`packages/components/person-card/person-card.js` sets none; the `aria-labelledby` in its header comment is on the article, from the heading). |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07, 390 px touch: the link is 22.0 px tall in quiet and warm (51.4 to 94.4 px wide) and 27.0 px in playful, so quiet and warm are under 24 px. They meet the spacing exception: the nearest other link is 209.1 px away (one card higher or lower), so a 24 px circle on the link touches no other target. A page that packs links or cards closer than 24 px would lose that. No check in the repository asserts target size for the card yet. |
| 4.1.2 Name, role, value | Meets | A native `<article>` and `<a>`; `person-card.check.mjs`: axe with and without JavaScript, 0 violations. |

**The page author owns:**

- The person's name, role and building line, in the language of the page, and `lang` on text in another language (3.1.2).
- A real `alt` on a photo that carries information.
- The link's text and where it goes (2.4.4), and the room around the links: cards laid out so two links are never closer than 24 px (2.5.8).
- The colours the page sets behind the card, if it overrides the tokens.

- A sticky header or banner that could cover the card's link when it takes focus (2.4.11).