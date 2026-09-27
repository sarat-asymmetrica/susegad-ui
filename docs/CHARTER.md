# Susegad UI: the charter

*Version 1.0, 24 September 2026. The durable description of what this library is. The run that builds it lives in `GOAL.md`; the agents that build it live in `.claude/agents/`.*

## What we are making

Susegad UI is a front-end library for interfaces and documents that are beautiful and comfortable at the same time. Awe gets someone to look; comfort keeps them there.

It grew out of the Susegad sketchbook, nineteen code-drawn studies of Goa and India, and a villa redesign, where drawings did real work: a facade elevation that registers on its photograph, a site plan you can walk, a booking calendar with a block-print stamp. The library turns that craft into parts a builder can pick up.

Three ideas make it different from a conventional component library:

1. **One component, three registers.** Every component has a `quiet`, `warm` and `playful` register, set globally the way colour mode is. The same progress bar is a pencil hairline for an ERP buyer, a kolam that closes for a homestay, and chai steam for a festival brand. One library serves the most conservative client and the most playful one.
2. **Every component ships with its prompt.** Next to the code sits the prompt you could give an AI agent to make it, and a map from the words in that prompt to the techniques in the code. The library teaches as it serves.
3. **Behaviour and skin are separate.** Accessibility and behaviour live in a headless core that is boringly correct. The theatre is a skin on top. The quiet skin must pass an audit without a single flourish.

**Status:** internal. We build a critical mass of components, compose recipes from them, find what polish remains, and only then take it outside. MIT licensed from the first commit so the door is open.

## Decisions already made

| Decision | Choice |
|---|---|
| Name | Susegad UI |
| License | MIT (code). Documentation, stories and sample copy: CC BY 4.0. Fonts: their own licences, usually OFL. |
| Distribution | shadcn-style. A registry and a small CLI copy component source into the builder's project, where they own it and can change anything. No black-box package for components. Tokens and the engine may also ship as plain packages. |
| Core | Framework-agnostic: plain ES modules plus custom elements (`<sg-*>`), attribute-driven so a server can drive them. |
| Adapters | Svelte (apps), Astro (sites), htmx 4.0 (server-driven pages). Thin wrappers only; behaviour never forks per framework. |
| First document genre | The proposal. |
| Narration | Open to several providers; Sarvam (Bulbul text-to-speech, voices, dubbing) is the first-class choice. |

## The layers

| Layer | Holds | Notes |
|---|---|---|
| **Tokens** | colour in OKLCH, type (including Indic scripts), spacing, radii, motion (named durations and easings), sound, the register | Plain CSS custom properties plus a JS mirror. A palette-from-photo tool derives colour tokens from a client's photographs. |
| **Engine** | stage, loop, pointer, seeded rng, noise and fBm, ink, pencil, hatch, wash, paper, fields, shader helpers, the quality governor | Grown from `lib/sketch.js`. Pure functions tested in Node. |
| **Scenes** | the plates, refactored: Paus, Kolam, Tollem and the rest | Each scene is a pure model plus a renderer, with parameters. See the scene contract. |
| **Components** | Button, TextField, Select, Toggle, Progress, Toast, Dialog, Tabs, Table, Chart and so on | Headless behaviour plus one skin per register. |
| **Moments** | small pieces of theatre: the kolam loader, the firefly sync indicator, the HELD stamp, the ink underline, rain on glass for an empty state | Harvested from real use, never invented in a vacuum. |
| **Folio** | the document layer: single-file build, sealing, print, Markdown with directives, the diagram grammar | HTML as a better PDF. |
| **Sound and AV** | synthesised UI sounds and soundscapes, narration with timing tracks, video treatments, a Susegad player | Off until the user opts in. |
| **Recipes** | a booking flow, an enquiry form, a proposal, a storybook spread, an ERP dashboard header | Compositions for real business types. |

## The register

`register` is `quiet`, `warm` or `playful`. It is set on `:root` (`data-register`), can be overridden on any element, and is read by every component and scene.

| | quiet | warm | playful |
|---|---|---|---|
| Motion | only what state requires; transitions under 200ms; scenes show a still frame | slow ambient motion, one living thing per screen | fully interactive scenes, overshoot and spring allowed |
| Ornament | none; hairline pencil rules, generous space | hand-drawn detail visible up close | motifs, colour, delight |
| Sound (when enabled) | none except confirmations | soft confirmations, optional ambience | full vocabulary |
| Copy tone | plain and exact | plain and warm | plain and cheerful |
| Who it is for | auditors, finance, ERP buyers, anyone who equates fun with carelessness | homestays, studios, restaurants, most small businesses | festivals, children, brands that want joy |

Reduced motion (`prefers-reduced-motion`) always wins over the register: every register has a finished still. Save-Data and low-power devices step down one register automatically.

## The scene contract (v2)

The Volume I and II plates are paintings. In the library, a scene is a surface, a state display or a responder, and often all three.

- **Scene as surface:** it hosts content in slots. It guarantees contrast (an automatic scrim behind text) and calm reading zones (motion quietens near anything meant to be read).
- **Scene as state:** it reflects something real (upload progress, a project's phase, the time at a place). Used sparingly, as calm technology.
- **Scene as response:** it answers the user (typing brings the fireflies into sync; submitting prints the stamp).

Every scene is split into:

1. a **model**: a pure function of `{ time, seed, register, params }` that returns plain data. Runs in Node. Deterministic for a seed.
2. a **renderer**: draws the model with canvas, SVG or WebGL, and owns side effects.
3. an **element**: `<sg-scene name="paus" register="warm" progress="0.4">…slotted content…</sg-scene>`. Observed attributes map to params. A server can swap an attribute (htmx) and the scene responds with no glue code.

Every scene exposes `play`, `pause`, `replay`, `reseed`, `set(params)`, `still()` (the reduced-motion frame) and `destroy`. It pauses when off screen and runs the quality governor.

## The component contract

A component ships as one folder:

```
components/progress/
  progress.js        headless behaviour and the custom element
  skins/quiet.js     one skin per register
  skins/warm.js
  skins/playful.js
  progress.css
  progress.prompt.md the prompt and the words-to-code map
  progress.test.js   pure-core tests
  progress.docs.md   usage, props, accessibility notes, examples
  registry.json      what the CLI copies
```

It is not done until:

- keyboard and screen reader work (native elements first: `<button>`, `<dialog>`, the popover API, form validation);
- it passes axe with no violations in all three registers;
- it holds its budget: JS size, and milliseconds per frame when animated;
- it pauses off screen and has a reduced-motion still;
- screenshots exist for every register, at desktop and phone width, light and dark;
- it has been used in at least one recipe.

## Folio: HTML as the document format

A Folio document is one self-contained `.html` file.

- **Portable:** everything inlined; fonts subsetted and embedded; images compressed (AVIF data URIs); a size budget (default 3MB, a proposal should aim for under 1.5MB).
- **Sealed:** no network requests, a strict Content-Security-Policy meta tag, and an integrity hash printed in the footer so a recipient can tell it was not altered. It never phones home: no analytics.
- **Printable:** print CSS gives a clean PDF as a by-product; scenes render a high-resolution still for print.
- **Authored in Markdown** with directives (`::scene{name=paus register=warm}`, `::diagram{…}`, `::price-table{…}`), so writers do not touch JavaScript.
- **Alive where it helps:** live calculators (the Casa pricing kernels), step-through SVG diagrams, scrubbable numbers. Heavy parts (WebAssembly, SQLite, Pyodide) load lazily; a document must be readable without them.

Genres, in order: the proposal, the storybook (bilingual, narrated, word-by-word highlighting), the lesson (explorable explanations), the essay (scroll-driven, margin notes). Later: menus, invitations, certificates, brochures.

## Sound and AV

- **UI sound** is synthesised with Web Audio (no files): a small vocabulary of tick, confirm, complete and gentle-error, plus paired haptics on phones. Off by default. One global switch. Never on page load.
- **Soundscapes** are procedural and tied to the visuals (each visible raindrop is an audible tick), seeded like everything else.
- **Narration** is recorded or synthesised speech plus a WebVTT timing track that drives captions and word highlighting. Captions are always available.
- **Video** passes through our look: a shader treatment (ink, halftone, duotone, risograph), ink annotations registered on the moving frame, a drawn scrubber, captions in our type, a drawing as the poster.
- **Grading tokens** (colour grade, grain, the mount) apply to all media so photographs and video sit in the same world as the drawings.
- **Export** runs the other way too: scenes render to PNG, GIF or video for social posts.

## The non-negotiables

1. **Accessibility first.** WCAG 2.2 AA. Keyboard and screen reader complete. Theatre never carries meaning on its own.
2. **Honesty.** Motion marks something real. A determinate loader only moves when work moves. No fake progress.
3. **Performance budgets.** Measured, not hoped for. Pause off screen, reduced-motion stills, the quality governor, a lite tier for budget phones and Save-Data.
4. **Fallbacks everywhere.** No JavaScript, no WebGL, no fonts, no sound: each still gives a usable, dignified result.
5. **Cultural respect.** Motifs sit in tiers: pan-Indian, shared practice with local forms, local, and sacred. Sacred motifs are used only when the client leads. Traditions and artisans are credited in the docs.
6. **Harvested, not invented.** Nothing enters the library until it has been used in a real surface or a recipe.
7. **India first.** Devanagari, Kannada and Konkani (in Romi and Devanagari) are tested, not afterthoughts. Lakh and crore formatting. The rupee.
8. **Privacy.** No tracking in components or documents.
9. **Every component teaches.** Prompt and map ship with the code.

## Copy standards

Plain, warm, specific, active voice. Sentence case. No marketing adjectives. No em dashes in UI or document copy. Numbers stated plainly. Errors say what happened and how to fix it. Never announce honesty or transparency; just be accurate. The Humane Register Doctrine (`C:\Projects\kernel-eval\docs\HUMANE_REGISTER_DOCTRINE.md`) applies to every word a person will read.
