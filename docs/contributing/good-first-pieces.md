# Good first pieces

Nine gaps in the library, each with a short note on what the piece needs. These
are good first code contributions: each one is a piece on its own, following the
contract in `references/building.md` and the pattern at
`packages/components/event-card/`. Pick one, not nine.

The register hint at the end of each paragraph is where most of the work will
be. It is a hint, not a spec; your piece's check will tell you the real bar.

## Pagination

Moving through a list of many items, such as the entries of a directory or the
pages of a catalogue. Build on a native list with real links where you can, so
back and forward still work; a form fallback covers the rest. The hard parts
are the current page announced for screen readers, windowing so a long list
never floods the page, and keeping the page number in the address so a link can
be shared. Quiet register will be the most work, because the numbers and labels
must stay legible at 390 px without shouting.

## Breadcrumbs

The path back to where you came from, as on a recipe site where a dish sits
under its course and its kitchen. Build on the native `<nav>` with an
`aria-label`, and keep the current page as plain text rather than a link to
itself. The hard parts are truncation when paths grow long, without hiding the
middle steps from screen reader users, and choosing what to show on a phone.
Warm register will be the most work: the separator and the home word should
sound like the library and not like a filing cabinet.

## Avatar

A small face or name that stands for a person, as in a member list. Initials by
default, not photos; the gallery piece already treats consent as the first
question. Build on a native `<img>` with fallback text, and give initials real
contrast against the token colours. The hard parts are the size steps across
the tokens, handling names with one word or many (initials from a Kannada or
Marathi name should not guess), and what the image fallback says when a photo
is withheld. Warm register will be the most work, because an avatar that tries
too hard turns a person into a decoration.

## Search

Finding things in a local list or catalogue, without sending anyone's words to
a server; the library's privacy rule is no tracking, so search stays client
side. Build on a native `<input type="search">` and an `<output>` or live
region for the count. The hard parts are the empty state ("nothing matched
'poonam' here, try fewer letters") written in the copy rules, matching across
Indian language scripts, and announcing result counts without interrupting.
Quiet register will be the most work, since search is a tool and tools get
calmer words.

## Announcement banner

One line at the top of a page: a workshop date, a closure notice, a new
release. Build on native dismiss controls and remember the dismissal locally,
without inventing a tracker. The hard parts are not pushing content down
jerkily (respect reduced motion), announcing the banner once and not on every
page turn, and a version that carries no colour weight at all. Playful register
will be the most work, because a banner has three seconds of attention and a
playful one must still be read first.

## Pricing table

Rates laid out side by side, in rupees, the way a homestay or a studio posts
them. Build on a native `<table>` with a caption and `<th>` headers; this
piece is cousin to the data-table pattern. The hard parts are lakh and crore
grouping (1,25,000, never 125,000), tabular figures so the columns stay
aligned, a marked highlight column that is not colour alone, and sideways
scroll inside the table at 390 px, never on the page. Quiet register will be
the most work: money is where the words get calmest.

## Product card

One item offered for sale or shown in a list: picture, name, price, one action.
Build on a real link wrapping the whole card, with the action as a button
inside it only when it does something, not when it is decoration. The hard
parts are the image frame when no photo is loaded yet, the price line with the
rupee and Indian grouping, and the sold-out or withheld states written kindly.
Warm register will be the most work; the card is the first handshake a product
gets.

## Slider

Choosing a value on a range, such as how many guests a booking covers. Build on
the native `<input type="range">` before anything else; the platform gives you
keyboard, touch and screen reader steps for free. The hard parts are showing
the chosen value as text at all times (a number a screen reader says, not only
a position), mapping uneven steps such as quarter plates, and a still finish
under reduced motion. Warm register will be the most work, because the value
readout and its label are copy as much as control.

## Language switcher

Moving the whole surface between languages, such as English, Konkani and
Devanagari. Build on a native list of links or a `<select>`; each option is
named in its own language and script, never translated into the current one.
The hard parts are remembering the choice without a tracker, the moment of
change (fonts, line lengths and layout shift all jump), and writing the switch
label itself in every language it serves. Warm register will be the most work,
because the switcher is often the first Indian-language string on the page and
it sets the tone for the rest.

## How to start

Read `CONTRIBUTING.md`, fork, branch, and say in the issue or pull request
which piece you picked. A new piece in a new family meets the Full gate, so
write the prompt and the map with the same care as the code; the reviewer will
read both.
