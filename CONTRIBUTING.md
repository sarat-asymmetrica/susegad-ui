# Contributing

Thank you for thinking about it. Susegad UI is a small library of interface pieces
for Indian makers, and it gets better when more hands touch it. This page tells you
how to join in, whether or not you write code.

## The two shelves

The project keeps two shelves, and both of them are open.

The first shelf is the **sketchbook**, at `sketchbook/`. Anyone can contribute a
scene there without writing a single line of code. A scene is a living picture:
a remembered verandah, a bus window at dusk, a kitchen in the first rain. You
describe the place, an agent with the scene skill at `skills/susegad-scene/`
paints it for you, and what lands in the sketchbook carries your name on it.

The second shelf is the **library**, under `packages/`. That is where the code
lives: the components, the scenes that have been used in real surfaces, the
recipes. Pieces are promoted from the sketchbook to the library by the
maintainers, after the full gate. Not every sketch gets promoted, and that is
all right; the sketchbook is not a waiting room, it is its own room.

If you are not sure which shelf your idea belongs on, start with the sketchbook.
It costs you nothing but the memory of a place.

## How to contribute a scene without code

You do not need git, npm or any of that. You need an agent that has the scene
skill installed, and a place in your head.

1. Tell the agent about a place: where it is, when you were there, what the
   light was doing, what moved, what stayed still, what you heard.
2. The agent paints a scene following the scene contract, then shows it back to
   you in all three registers (quiet, warm, playful) at phone and desktop widths.
3. Say what is different from your memory. The river ran the other way. The
   sound was a temple bell, not traffic. It will paint again.
4. When the scene feels like the place, it files itself in `sketchbook/` with
   your name, the place, and the notes.

One thing matters more than the rest: if you use a reference photo of a person,
the person must have said yes. The agent will ask, and the sketchbook entry
records the answer. Other people's artwork can be a thing to learn from, never
a thing to trace.

## How to contribute code

Code contributions follow the usual open-source path, and if you have never
used git before, take it one line at a time; the steps below are the whole of it.

1. Fork the repository and make a branch for your piece.
2. Run `npm test`. This is the whole suite, about a minute. It should pass
   before you start and pass after you finish.
3. Run your piece's own check: `node packages/components/<name>/<name>.check.mjs`.
   This is the piece's bar: all three registers, small widths, keyboard, reduced
   motion.
4. Attach a contact sheet to your pull request:
   `node tools/contact-sheet.mjs --url /packages/components/<name>/demo.html --name <name>`.
   The pull request needs the sheet so a reviewer can see what you saw.

Copy pieces (the prompt and the words-to-code map that ship with every component)
follow the contract in `references/building.md`. `packages/components/event-card/`
is the pattern to copy; look at its files, its check and its docs together.

## Which gate a change meets

Not every change needs the same amount of looking at. The tier is read from the
files your change touches; a change can raise its tier, never lower it.

| Tier | When | Gate | Target reviewer time |
|---|---|---|---|
| **Light** | Only `packages/engine` (with tests), `tools/`, `docs/`, tests, `*.prompt.md` / `*.docs.md` copy; nothing that renders | Automated gates + C's lints. No review agent; the Sutradhar reads the diff. | 0 min |
| **Standard** | Rendering files (`render.js`, `skins/`, `*.css`, `demo.html`) in an existing piece, or a new piece in an existing family | Rasika *lean*: the evidence pack, one strip if it moves, the keyboard if it's interactive. | ≤ 15 min |
| **Full** | A shared primitive (`core`, `tokens`, a component other pieces import), a new tier or decision, focus-managing overlays and forms, a cultural motif at tier `regional`-new or `sacred`, the home page / front door, or anything the owner or request marks `gate: full` | Today's Rasika, run on the evidence pack | ≤ 35 min |

A request or a slice can raise its tier (`gate: full` in its header). A Standard
review that finds a blocker may escalate to Full on the spot. The tier and its
reasons go at the top of every review, so the record shows which gate each
merge passed. Table reproduced from `docs/requests/2026-10-02-lighter-gate.md`.

## The copy rules

Words are part of the design here, so they have rules, and the same rules bind
everything a reader or listener meets: interface strings, docs, prompts, story
text. Sentence case. Plain and warm, active voice, no marketing adjectives. No
em dashes in copy people will read. Indian English spellings throughout. Errors
say what happened and how to fix it, and never blame the person. Nothing
announces its own honesty or transparency; it is simply accurate. The full
standard lives in `docs/CHARTER.md` under Copy standards.

## Credit and licences

Code is under the MIT licence (see `LICENSE`). Documentation and drawings,
including every scene and sketch, are under CC BY 4.0. Contributors are credited
by the name they choose, in the sketchbook metadata and in the file or recipe
they touched; tell us the name you want shown and that is the name we use.
