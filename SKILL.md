---
name: susegad-ui
description: Compose pages, documents and new pieces with Susegad UI, the register-aware front-end library of code-drawn scenes (<sg-scene>), OKLCH tokens and self-hosted Indic fonts. Use it when a task mentions Susegad UI, sg-scene or any code-drawn scene, a register (quiet, warm or playful), the susegad CLI, a Folio document or the proposal recipe, UI sound, narration, the player or the storybook spread, or when you are building or reviewing a scene or component in this repo.
---

# Susegad UI

Susegad UI is a front-end library for interfaces and documents that are beautiful and comfortable at the same time. Its pieces are plain ES modules and custom elements you copy into your own project, and each one comes in three registers (quiet, warm and playful), so the same page can suit an auditor or a festival. Every piece ships with the prompt that makes it and a map from that prompt's words to the code, and its accessibility lives in a plain core under the drawing.

The durable description is `docs/CHARTER.md`. Decisions that change it live in `docs/decisions/`. When this file and the code disagree, the code wins; say so, and fix whichever is wrong.

This file stays short on purpose. It has what every task needs first: the register, install, and where to go next. The `references/` files below hold the rest, verbatim from the fuller version this replaced; nothing was cut, only moved.

## 1. Choose a register

The register is the first decision on any page. It sets motion, ornament, sound and the tone of the words.

| | quiet | warm | playful |
|---|---|---|---|
| Who it is for | auditors, finance, ERP buyers, anyone who equates fun with carelessness | homestays, studios, restaurants, most small businesses | festivals, children, brands that want joy |
| Motion | only what state needs, under 200ms; scenes show a still | slow ambient motion, one living thing per screen | fully interactive scenes, spring and overshoot allowed |
| Ornament | none; hairline rules and generous space | hand-drawn detail you notice up close | motifs, colour, delight |
| Copy | plain and exact | plain and warm | plain and cheerful |

When in doubt, choose warm. It is the default. Choose quiet when money, compliance or a serious buyer is on the page. Choose playful only when the client asks for joy.

```html
<html lang="en" data-register="quiet" data-theme="light" data-palette="susegad">
  <!-- this one scene is warm, on an otherwise quiet page -->
  <sg-scene name="paus" register="warm"></sg-scene>
  <!-- data-register works on any element; its children inherit it -->
  <section data-register="playful">...</section>
</html>
```

`data-register` goes on `:root` or any element; the nearest ancestor wins, and an element's own `register` attribute beats every ancestor. Reduced motion always wins over the register: every register shows its finished still. Save-Data, or 1 GB of memory or less, steps down one register automatically; do not fight this. `data-theme="light|dark"` follows the system setting if left off. `data-palette="susegad|casa"` (default `susegad`); a palette made from a client's photographs adds its own value (`packages/tokens/README.md`).

## 2. Install pieces with the CLI

Pieces are copied into your project, shadcn-style. After that they are your code: change anything.

```sh
# from your project's root; Node 22 or later
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs list
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs add scene-paus
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs add scene-kolam --dir app/vendor --dry-run
```

`susegad list` (or `list --json`) is the live, current shelf: don't guess item names from this file, ask the CLI. `add` copies an item and everything it depends on; `info <item>` shows its files, dependencies, registers, byte budget, stability label and prompt path. Files land at `<dir>/susegad/<path>` (default `src/lib`), with the tree kept, so relative imports between pieces still resolve. Running `add` again updates files you have not touched and leaves your edits alone unless you pass `--overwrite`; `susegad diff <item> --patch` shows what changed. `--ref <commit>` installs from a commit, branch or tag, never the working tree. No bundler, no bare specifiers: library code imports by relative path only.

Then load tokens, fonts and core, and use tokens rather than raw colours: see [`references/tokens.md`](references/tokens.md).

## 3. How to choose a piece

| You need | Reach for | Reference |
|---|---|---|
| a page background or moment that draws itself, optionally hosting your words | a scene, mounted by `<sg-scene>` | [`references/scenes.md`](references/scenes.md) |
| a control or status region: a field, a toast, a badge, a progress bar, anything form-shaped | a component | [`references/components.md`](references/components.md) |
| several components already composed for a real flow (a booking form, a file upload) | a recipe | [`references/recipes.md`](references/recipes.md) |
| a self-contained document that's more than a PDF: a proposal, a report, a signed agreement | Folio | [`references/folio.md`](references/folio.md) |
| a confirmation sound, spoken narration with captions, or a media player | the sound, narration, player or export packages | [`references/av.md`](references/av.md) |
| something none of the above cover | a new piece, following the existing contracts | [`references/building.md`](references/building.md) |

Every reference file above is deep detail for one kind of task; open only the one the task needs. [`references/style-and-gates.md`](references/style-and-gates.md) holds copy standards, the "before you say done" checklist and the gates and tools every piece is checked against — read it once building anything, before you call it finished.

## Stability

Every registry item carries a stability label (`experimental`, `beta` or `stable`; `susegad info <item>` shows it). Most of the library is still `experimental`: treat it as likely to change, and say so if you're building something a stranger will depend on. `tokens` and `core` (the `<sg-scene>` contract) are `beta`.
