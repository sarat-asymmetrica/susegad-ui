# Entry template

Copy this whole folder to `sketchbook/entries/<your-entry>/` and fill in `entry.jsonc`.
The lint (`node sketchbook/lint.mjs`) checks every field before a maintainer sees the
entry, so fill them all, even the ones marked null below.

## The fields

- `title` (string): the scene's name, as you want it shown. Example: `"The well at dusk"`.
- `rememberedBy` (string): your name, as you want it shown. A handle is fine.
- `place` (string): where it is, in free text. A village, a street, a memory, an imagined
  place. Write it the way you would say it aloud.
- `motif` (object) with three subfields:
  - `origin` (string): where the visual idea came from, in your words. Example:
    `"terracotta tiles outside the village church"`.
  - `tier` (string): one of `everyday`, `regional`, `sacred`. Everyday is for anything
    ordinary to you. Regional is for a motif that belongs to a particular community and
    needs a note naming where it comes from. Sacred is for a motif that a community holds
    as sacred; those entries need a named community lead, see `communityLead`.
  - `gloss` (string or null): required when `tier` is `regional`. Name the place or
    community the motif comes from and one line about what it means. Set it null for
    everyday.
- `consent` (string or null): required whenever the entry uses a reference photo of a
  person. Say who is in the photo and what they agreed to, for example:
  `"The fisherman in the reference photo is my cousin Ravi; he agreed in writing that his
  photo can be used as reference for this scene."` Mark it null when the entry uses no
  photo of a person.
- `references` (array): what the agent looked at. Each item is an object with a `kind`
  and a `note`. Kinds the lint understands: `scene` (an existing scene in the library),
  `principle` (a principle or charter line), `photo` (a photo with no people), and
  `personPhoto` (a photo with a person in it, which turns on the consent check).
  Example: `[{ "kind": "photo", "note": "my own photo of the Aldona bund" }]`.
- `status` (string): one of `sketch`, `proposed`, `promoted`. A new entry starts as
  `sketch`. A maintainer sets `proposed` when the entry goes up for the full gate, and
  `promoted` only after it passes.
- `communityLead` (string or null): required when `tier` is `sacred`. The name of a person
  from the community who is leading the work on this entry. Set it null for other tiers.

## The scene folder

`scene/` is a stub structure an entry may use: put whatever the agent painted here, plus
a short `scene/README.md` in the agent's own words. Nothing in this folder is checked by
the lint yet; the metadata file is the contract.
