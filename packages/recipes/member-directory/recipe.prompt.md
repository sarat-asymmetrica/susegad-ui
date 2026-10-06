# Member directory (recipe)

Make a member-directory recipe that filters a list of person-card web components by a text field and by track, built from library parts only: the library's `<sg-field>` for the text input, `<sg-check>` for the track checkboxes, and `<sg-person-card>` for each member. The text matches any word against the card's name heading, its role line and its building line (fold accents, so "fernandés" matches "Fernandes"; two words must both match). The track checkboxes narrow to the ticked tracks, and none ticked means every track; the card declares its track with a `data-track` attribute, and the tracks are: AI for Senior Citizens, AI for Kids, Tech for Good, Builders Moving to Goa, Workshops for Founders. Filtering happens live as the person types. The filter state lives in the URL's query (`?q=aldona&track=AI%20for%20Kids`), written with `history.replaceState` so the back button still works, read back into the controls on load, and the page says once that a filtered view is in the address and can be copied. A `role="status"` count says how many show ("Showing 7 members"). When nothing matches, hide every card and show a kind empty state that names the two fixes: "No one matches that yet. Try a shorter word, or a different track." Without JavaScript the full list shows, unfiltered, the filters do nothing and say so, and nothing breaks.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| what each card says, in data | pure core | `personOf(card)` reads the card's own markup: the heading, `.sg-person-role` and `.sg-person-building` carry the words, `data-track` the track. |
| fold accents | `fold(t)` | lowercase and strip diacritics with `normalize('NFD')`, so the filter forgives them. |
| any word against name, role, building | `filterPeople(people, { q, tracks })` | every word you typed must appear somewhere in that person's words; runs in Node, tested without a browser. |
| none ticked means every track | the same core | `tracks: []` matches everything; a ticked set keeps only its members. |
| the state lives in the URL | `stateOf(params)`, `stateToQuery(state)` | read `?q` and a comma-joined `?track` from the query, and write back with `history.replaceState` on each change, omitting what is empty. |
| the list updates as you type | wiring | `input` on the field, `change` on each checkbox; the element's `submit` is prevented. |
| the count, read once | `role="status"` | `.sg-directory-count` says "Showing 7 members"; a screen reader hears each change once, not per keystroke. |
| the kind empty state | the page's words | `.sg-directory-empty` unhidden with the two fixes in it; never a blank list. |
| nothing breaks without JavaScript | honesty | No script: the full list shows, the filters do nothing, and a `noscript` note says so. |
| sample people | markup | Seven made-up people in and around Aldona, one per track or two, each a person-card with a role, what they are building, and a link. No real people or businesses. |

## Accessibility

- The field has a real `<label for>`; the checkboxes are native inputs.
- The count is `role="status"`: each change is heard once.
- Hidden cards are `hidden`, so they leave the tab order; the empty state replaces them.
- The share note is ordinary text, shown whenever the filter hides anything.
- Without JavaScript nothing is hidden, nothing is broken, and it says why the filters are inert.
