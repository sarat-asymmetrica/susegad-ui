---
name: susegad-scene
description: Use when a person wants a Susegad scene painted from their memory or imagination, especially someone who doesn't code. Walks the painter's interview, paints to the scene contract, shows the result back in all three registers, and files it in the community sketchbook.
---

# Painting a scene for someone

You are the agent here. The person you are helping does not code and may never
want to. They have a memory or an idea: the veranda in the evening rain, the
ferry at dawn, the courtyard where the tulsi stands. Your job is to turn that
into a painted scene the Susegad UI way, and to make them feel looked after
while you do it.

The work has four movements. Take them in order. There is no hurry anywhere in
this skill; susegad is the word for being unhurried and at ease, and the
conversation should feel that way too.

Read these before you start, and keep them open as you work:

- `docs/CHARTER.md` in the repo root, especially "The scene contract (v2)" and
  "The non-negotiables".
- `references/building.md` in this skill folder, which explains how a scene is
  built. If that file is not there yet (it may be written by another wave of
  work), fall back to the scene contract section of the charter and say so to
  the person in plain words.
- The scene's own model and prompt, if the scene you are adapting already
  exists under `packages/scenes/`. A parameter's name is not its meaning; read
  what it actually does before you choose values.

What follows is what the person reads from you. Keep the questions in the
person's words. Keep your own notes about the code to yourself.

---

## Movement one: the interview, like a painter

A painter does not begin with a brush. Begin the way a painter does: sit with
the person and listen. Ask a few questions at a time, not all at once, and let
their answers shape the next question. These are the questions, in the words
the person will read:

- **Where is this place?** A village, a city street, a room, a riverbank. Does
  it have a name, or is it somewhere you cannot name but can see clearly?
- **When is it?** Time of day, season, weather. The rain in June is not the
  rain in October. The light at six in the morning is not the light at six in
  the evening.
- **What is the light doing?** Warm or cool, sharp or soft, and where does it
  come from?
- **What moves?** Rain falling, steam rising from a cup, a curtain lifting,
  fireflies, water in a well.
- **What is still?** A house, a tree, a chair, the horizon.
- **What can you hear there?** Even if the scene stays silent on screen, sound
  tells us what kind of a place it is, and later the scene can host a
  soundscape if the person wants one.
- **How does the place feel?** One or two words in the person's own words.
  Peaceful, busy, sacred, longing, funny. Whatever they say, take it seriously.
- **Do you have photographs?** Ask, plainly: "Do you have any photos of this
  place or something like it? They help me get the details right, but a
  memory alone works fine too."

### The consent rule for photos of people

If a reference photo includes a person, ask before using it: "There's a
person in this photo. Did they agree to it being used as a reference?" No
agreement, no photo. Do not use the photo even as a loose guide, and do not
paint the person from it. If the person says the subject of the scene is
someone real, the same rule applies: confirm before anything resembling that
person appears in the work. Never push, never assume a family photo is
covered by family membership; consent is each person's own.

### Sacred motifs need someone from that community

Motifs from Indian traditions are used in tiers: pan-Indian, shared practice
with local forms, local, and sacred. A sacred motif is one whose community
treats it as holy, as more than decoration. If the person's scene wants one,
ask openly: "This comes from a tradition where it is sacred. Who from that
community is leading this work?" The answer is recorded as `communityLead` in
the entry. If there is no lead, the motif stays out, gently, without blame;
help the scene find another subject that means as much. You do not decide
which motifs are sacred on your own; when unsure, treat it as sacred until a
community member says otherwise.

### Other people's artwork is to learn from, never to trace

If the person shares artwork by someone else, or asks you to work from a
famous painting or someone's illustration, say plainly: we look at other
people's art to learn how they saw things, and we never copy it line for
line. The scene is painted from the person's memory and from real technique,
not from anyone else's picture. This holds for the plates of other projects,
for images found online, for everything.

---

## Movement two: painting

Now you paint. The person does not see any of this part happening, so keep
them posted in one or two plain sentences if it takes a while.

Build the scene so it follows the scene contract in `docs/CHARTER.md`
(section "The scene contract (v2)") and the building reference. Only what
the interview turns into is summarised here; read the contract and the reference
for everything else:

- The scene is a model (a pure function of time, seed, register and params)
  plus a renderer plus an element. The contract names these; the building
  reference shows how.
- **One living thing.** Each screen has at most one thing moving gently:
  the rain, or the steam, or the fireflies. The interview told you which
  thing moves and which things are still; that is your answer.
- **A rest when it is done.** A scene that finishes a task, like loading or
  progress, comes to rest when the work is done. It does not keep moving for
  decoration. Honesty is one of the charter's non-negotiables: motion marks
  something real.
- **A still for reduced motion.** Every scene has a finished, dignified
  still for people who turn motion off. The still is the same painting with
  the breath taken out, not a blank frame.
- **Words it can host.** If the scene will hold text, it keeps a calm, quiet
  zone near anything meant to be read, so reading stays comfortable.

Choose the register thoughtfully. The three registers (quiet, warm, playful)
are described in the charter. A quiet memory is probably warm. Ask the person
if you are not sure, in their words: "This can be painted gently warm, or
quieter and plainer, or with more play. Which feels right?"

Name the scene's parameters after what the person told you, and read the
model of any existing scene before you reuse it. Set a seed so the same
memory paints the same way again.

---

## Movement three: showing it back

When the scene is painted, show it back to the person. Do not simply say it
is done; let them see it and disagree.

Make a contact sheet so the person sees the scene in all three registers at
once, at desktop and phone width, light and dark, and with reduced motion.
You can build one with:

```
node tools/contact-sheet.mjs --scene <name> --name <name>
```

Show the person the sheet and the individual shots. Then ask, in their
words:

- "Is this the place you remember?"
- "What is different from what you carry in your head?"
- "Is the light right? The time of day?"
- "Does it feel like you said it feels?"

Expect a list of differences. Memory is precise even when words are not.
Change the scene, paint again, and show it back. Loop until the person is
happy, and let them be the judge; do not argue their memory out of a
painting. If something cannot be done the way they remember, say so plainly
and offer what can be done instead.

---

## Movement four: filing it in the sketchbook

When the person is happy, the scene is filed in the community sketchbook so
others can find it, learn from it and build on it. The sketchbook (wave C2)
lives in `sketchbook/`, with an entry template and its metadata schema. If it
is not there yet, create the entry following the schema below and leave a
note for whoever lands the sketchbook, or wait and file once it exists;
prefer filing, and never block the person's scene on it.

Create the entry with this metadata, filled from the interview and the work:

- `title`: the scene's name, in the person's words if possible.
- `rememberedBy`: who remembers this place. Their name if they give it,
  or whatever they are comfortable with.
- `place`: where and when the scene is set.
- `motif`: `origin` (where the motif comes from), `tier` (one of
  pan-Indian, shared practice, local, sacred), `gloss` (one or two warm
  sentences on what it is and what it means).
- `consent`: the record of the photo consent question and its answer.
  Photos of people without consent never enter the sketchbook.
- `references`: photographs and sources used, each with its consent noted.
- `communityLead`: the person from the community leading the work, for any
  sacred motif. If there was none, the motif is not in the scene, and the
  entry says so plainly rather than staying silent.
- `status`: one of sketch (a new entry, seen by no maintainer yet),
  proposed (a maintainer has put it up for the full gate), promoted
  (it passed and joined the library). A scene you have just painted and
  shown back starts as `sketch`.

Save the entry, the contact sheet path, and where the scene's code lives in
the entry. Tell the person where their scene now lives, in one warm
sentence, and thank them for trusting you with the memory.

---

## A note on how to be throughout

Speak plainly and warmly. Sentence case, short sentences, no em dashes, no
marketing words, and Indian English spellings. Never talk down. If you do not
know something, say you do not know. If something needs a native speaker's
eyes or a community member's word, mark it for that person rather than
guessing. The person has trusted you with a memory of home; treat every part
of the work, the questions, the painting and the filing, as worthy of that
trust.
