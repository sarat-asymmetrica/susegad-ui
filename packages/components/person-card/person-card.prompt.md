# Person card

Make a person-card web component around an `<article>`: the person's name as a heading, their role in a few words, one line on what they are building, and one link (their site, a profile or an email) that is a plain link in the markup. With no photo, show the person's initials instead: a pure function `initialsOf(name)` cuts them from the heading's words (first and last word, one initial for a single name, middle names skipped, edge spaces trimmed, empty when the name has no letters), and the element draws them in an `aria-hidden` disc so the heading is read as usual. There is no photo by default, and the component never fetches one; a photo appears only when the author writes `img.sg-person-photo` inside the article, with that person's consent recorded, and then the disc steps aside. Give it three registers as lazy skins. Quiet: a hairline card, the initials in a plain disc. Warm: a soft card with a wash at the top and the initials in the hand. Playful: a disc coloured from a seeded hue, and a small seeded tilt that arrives when the pointer or the keyboard focus arrives and settles back; nothing loops, and under reduced motion nothing moves.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| initials instead of photos | pure core | `initialsOf('Sarita Fernandes')` is `"SF"`: the first letter of the first and last word that has letters, one for a single name, middle names skipped, `""` for a name with no letters. Runs in Node, no DOM. |
| the initials disc is added by the element | one owner | `#disc()` writes the initials from the heading into `span.sg-person-initials`, aria-hidden, once, so author and element cannot disagree. |
| no photo until consent | honesty | The element never fetches or builds an image. Only `img.sg-person-photo` written by the author shows one; the element adds `data-photo`, removes the disc, and fills a missing `alt` from the name. |
| a seeded tilt, a seeded hue | `tiltOf(seed)`, `hueOf(seed)` | 0.4 to 1.4 degrees, sign seeded, set once as `--sg-person-tilt`; hue 0 to 359 as `--sg-person-hue`. Same seed, same card, every time. |
| the tilt arrives on hover or focus ... settles back | CSS only | On `:hover` or `:focus-within`, `rotate: var(--sg-person-tilt)` with the spring ease, once; the rest state is flat. Reduced motion keeps it flat. No loops, no timers. |
| one link, from the markup | slot | The element never writes a link. The `<a>` in `p.sg-person-link` is yours. |
| the directory reads the track | attribute | `data-track` on the card; `filterPeople(people, { q, tracks })` in the pure core does the matching for the member-directory recipe. |

## Accessibility

- An `<article>` named by its heading (the person's name).
- The initials disc is `aria-hidden`; the person is read as their name, not as letters.
- The link takes Tab and shows a 2 px focus ring.
- The tilt is decoration; no meaning is carried by motion.
- Without JavaScript the written markup shows in full: name, role, work, link.
