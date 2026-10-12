# Speakers (recipe)

Make a speakers recipe for an event page: a grid of the library's `<sg-person-card>` for each speaker, after the member-directory recipe. Each card has the name as its heading, a role and organisation line ("Teacher, Aldona Learning Circle"), one line about the talk, and one link: the talk's title, pointing at that talk's slot in the agenda (`#storybook-reader`, the id of the agenda session). There is no photo: a speaker without one gets a `<sg-bloom kind="zendu" seed-from="<their name>">` in the card's round `aria-hidden` disc, sized to the disc (2.75rem in 3rem), as decoration (no label, no words), so the same name always grows the same flower and two names differ. A person-card photo is only ever written by the author with consent recorded, and then the disc and bloom step aside. The bloom comes from an `avatar(card, { name, seed })` option on `mountSpeakers` (default `bloomAvatar`), called once per card, whose returned node replaces the initials; `avatar: null` keeps initials.replaceState` and read back on load. A `role="status"` count says "Showing 7 speakers"; when nothing matches show a kind empty line: "No speaker is on that track yet. Try another track, or clear them all." Without JavaScript every speaker shows, the links work, and a note says the filter does nothing. The talk link has a 44 px tall target. Sample content is invented: no real person.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a grid of speakers | CSS grid, `repeat(auto-fill, minmax(min(100%, 19rem), 1fr))` | one column on a phone, more as there is room. |
| each speaker | `<sg-person-card data-track="…">` with `.sg-person-role`, `.sg-person-building`, `.sg-person-link` | the card is the library's; the recipe only lays it out. |
| the talk, linked to its slot | the link's `href` is the agenda session's `id` | `#storybook-reader` on one page, `../agenda/index.html#storybook-reader` across two. |
| filter by track, in the URL | `tracksOf(params)`, `tracksToQuery(tracks)`, `visibleFor(people, tracks)` | the filter reuses the person-card's `filterPeople`; state is a comma-joined `?track`. |
| no photo | `bloomAvatar(card, { name })` | a zendu `sg-bloom` seeded from the name, in the card's disc; a photo (with consent) replaces it; `avatar` swaps the drawing. |
| nothing breaks without JavaScript | honesty | all speakers show, links work, a `noscript` note says the filter is inert. |

## Accessibility

- The cards are named articles; the initials disc is `aria-hidden`.
- The checkboxes are native inputs in a `fieldset` with a `legend`.
- The count is `role="status"`: each change is heard once.
- The talk link takes Tab, shows a focus ring and is 44 px tall.
