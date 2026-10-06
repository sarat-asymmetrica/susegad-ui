# Sketchbook

This folder holds every scene contributed by the community. There are two shelves here.

## The two shelves

**The sketchbook** is the lower shelf, open to anyone and anything. A person describes a
place from memory or imagination, an agent paints it with the library's principles, and
the agent files the result here. Nothing is too small for this shelf: a doorway, a
morning on the bund, a village square as someone remembers it from twenty years ago.

**The library** is the upper shelf, at `packages/scenes/`. It holds the pieces the
maintainers promoted after the full gate. Nothing moves from the library and nothing
joins it from here directly; promotion is a maintainer's job, not a contributor's.

## How a scene lands

1. A person talks to an agent that has the scene skill. They describe the place in their
   own words: what it looks like, when they last saw it, why it matters to them.
2. The agent paints the scene with the library's principles and files the result under
   `sketchbook/entries/<the-entry-name>/`, with a metadata file filled from
   `sketchbook/_template/`.
3. The lint checks the entry: `node sketchbook/lint.mjs`. It must pass clean.

## The light bar

Every entry carries a light bar: the line of status it sits at. `sketch` means it is
freshly landed and anyone may look. `proposed` means a maintainer has taken it up for
the full gate. `promoted` means it passed, and the maintainer records it in the library.
The status lives in the entry's metadata file, and the lint checks it is a real value.

## What promotion means

Promotion is not a formality. A maintainer runs the full gate, the same checks the
library's own pieces pass, before anything joins the library. Most entries will live
happily on the sketchbook shelf forever, and that is fine. The sketchbook is a shelf of
its own, not a waiting room.

## Running the lint

```
node sketchbook/lint.mjs
```

It exits 0 when every entry is clean, and 1 with one line per problem, naming the file
and the field, when something is wrong. Its tests are in `lint.test.js`; run them with
`node --test sketchbook/lint.test.js`.
