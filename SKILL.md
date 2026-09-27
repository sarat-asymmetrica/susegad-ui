---
name: susegad-ui
description: Compose pages, documents and new pieces with Susegad UI, the register-aware front-end library of code-drawn scenes (<sg-scene>), OKLCH tokens and self-hosted Indic fonts. Use it when a task mentions Susegad UI, sg-scene, a register (quiet, warm or playful), the Kolam, Paus, Tollem or Rampon scenes, the susegad CLI, a Folio document or the proposal recipe, UI sound, narration, the player or the storybook spread, or when you are building or reviewing a scene or component in this repo.
---

# Susegad UI

Susegad UI is a front-end library for interfaces and documents that are beautiful and comfortable at the same time. Its pieces are plain ES modules and custom elements you copy into your own project, and each one comes in three registers (quiet, warm and playful), so the same page can suit an auditor or a festival. Every piece ships with the prompt that makes it and a map from that prompt's words to the code, and its accessibility lives in a plain core under the drawing.

The durable description is `docs/CHARTER.md`. Decisions that change it live in `docs/decisions/`. When this file and the code disagree, the code wins; say so, and fix whichever is wrong.

## 1. Choose a register

The register is the first decision on any page. It sets motion, ornament, sound and the tone of the words.

| | quiet | warm | playful |
|---|---|---|---|
| Who it is for | auditors, finance, ERP buyers, anyone who equates fun with carelessness | homestays, studios, restaurants, most small businesses | festivals, children, brands that want joy |
| Motion | only what state needs, under 200ms; scenes show a still | slow ambient motion, one living thing per screen | fully interactive scenes, spring and overshoot allowed |
| Ornament | none; hairline rules and generous space | hand-drawn detail you notice up close | motifs, colour, delight |
| Copy | plain and exact | plain and warm | plain and cheerful |

When in doubt, choose warm. It is the default. Choose quiet when money, compliance or a serious buyer is on the page. Choose playful only when the client asks for joy.

Set it once for the page, then override where a part of the page needs to differ:

```html
<html lang="en" data-register="quiet" data-theme="light" data-palette="susegad">
  ...
  <!-- this one scene is warm, on an otherwise quiet page -->
  <sg-scene name="paus" register="warm"></sg-scene>
  <!-- data-register works on any element; its children inherit it -->
  <section data-register="playful">...</section>
</html>
```

- `data-register="quiet|warm|playful"` goes on `:root` or any element. The nearest ancestor wins. A `register` (or `data-register`) attribute on the element itself beats every ancestor. An unknown value is ignored.
- Reduced motion (`prefers-reduced-motion: reduce`) always wins: every register shows its finished still.
- Save-Data, or a device with 1 GB of memory or less, steps down one register automatically (playful to warm, warm to quiet). Do not fight this.
- `data-theme="light|dark"` on `:root`. Leave it off to follow the reader's system setting.
- `data-palette="susegad|casa"`. Default `susegad`: monsoon-indigo ink on handmade cream. `casa` is a Goan house palette. A palette made from a client's photographs (see `packages/tokens/README.md`) adds its own `data-palette` value.
- All three attributes work on any element, not only `:root`. An element inside a nested `data-theme` must read the tokens itself (`color: var(--sg-text)`), because a colour inherited from outside was resolved for the outer theme.

## 2. Install pieces with the CLI

Pieces are copied into your project, shadcn-style. After that they are your code: change anything.

```sh
# from your project's root; Node 22 or later
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs list
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs add scene-paus
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs add scene-kolam --dir app/vendor --dry-run
```

The items today are `core`, `core-component`, `engine`, `tokens`, the scenes `scene-kolam`, `scene-paus` and `scene-tollem`, and the components `progress`, `loader`, `skeleton`, `toast`, `stamp`, `empty`, `badge`, `field-note` and `connecting`, and the recipes `file-upload`, `saving-footer` and `room-details`.

- `add` copies the item and everything it depends on. `scene-paus` brings `core`, `engine` and `tokens` with it.
- `packages/<path>` becomes `<dir>/susegad/<path>`, with the tree kept, so the relative imports between pieces still resolve. `<dir>` is `src/lib` unless you pass `--dir`. So `packages/scenes/paus/render.js` lands at `src/lib/susegad/scenes/paus/render.js`.
- `add` writes `<dir>/susegad.json` with each item's version and a hash of every file. Running `add` again updates files you have not touched and leaves your edits alone unless you pass `--overwrite`. `susegad diff <item> --patch` shows what you changed.
- `info <item>` lists the files, dependencies, registers, byte budget and prompt path. `--json` gives the same for scripts and agents.
- If the CLI says the registry index is out of date, run `node registry/build.mjs` in the Susegad UI repo, then try again. Or install from a commit instead: `--ref <commit, branch or tag>` reads the registry as committed (through `git archive`), so uncommitted work in the library's checkout never reaches your project and a stale index there never blocks you. `susegad add enquiry date-range --dir public/vendor --ref main`.

No bundler, no bare specifiers, no import maps. Library code imports by relative path only.

## 3. Load tokens, fonts and core

```html
<link rel="stylesheet" href="src/lib/susegad/tokens/fonts.css">
<link rel="stylesheet" href="src/lib/susegad/tokens/tokens.css">
<script type="module">
  import './src/lib/susegad/core/index.js';        // defines <sg-scene>
  import './src/lib/susegad/scenes/paus/index.js'; // registers the paus scene
</script>
```

- Link `fonts.css` before `tokens.css`. It declares the self-hosted faces, split by script with `unicode-range`, so a page downloads only the scripts it shows. No request leaves the site.
- Import `core/index.js`, then each scene you use. Every scene module imports core itself, so one scene import also works, but naming core first keeps the order plain.
- `<sg-scene>` loads nothing by itself. It waits until its scene module has registered, then draws.

## 4. Use tokens, never raw colours

Components and pages read roles, never pigments and never hex values.

| Role | Use it for |
|---|---|
| `--sg-surface`, `--sg-surface-raised`, `--sg-surface-sunk` | the page, cards, wells and inputs |
| `--sg-text`, `--sg-text-soft`, `--sg-text-faint` | text; all three are 4.5:1 or better on every surface |
| `--sg-accent`, `--sg-on-accent` | the primary action as a fill, and the text on it |
| `--sg-accent-text` | the accent as text: links, the active tab |
| `--sg-success`, `--sg-warning`, `--sg-danger`, `--sg-info` | status text and icons |
| `--sg-focus`, `--sg-focus-width`, `--sg-focus-offset` | focus rings |
| `--sg-rule`, `--sg-rule-strong` | hairlines; use `rule-strong` for anything a person must see to operate, such as an input border |
| `--sg-scrim` | the paper wash behind text on a scene |
| `--sg-selection` | `::selection` |
| `--sg-lift` | the shadow under anything raised: a card, a popup list, the signature pad. Use it rather than a shadow of your own. |
| `--sg-shadow` | the lift's colour: ink by day and near black at night, so nothing raised glows in the dark theme. If you truly need another shadow, make it from this, never from the text colour. |
| `--sg-pencil` | drawing only: pencil strokes and construction lines that need no text contrast; never text |

Pigments (`--sg-laterite`, `--sg-kokum`, `--sg-pool`, `--sg-paddy`, `--sg-indigo` and the rest) are for drawing and decoration only.

Canvas code reads hex, never the CSS strings: a 2D context cannot parse `light-dark()` or `var()`, and older ones cannot parse OKLCH. Take colours from the JS mirror, `roleHex(palette, theme)` in `tokens/tokens.js` (`roleHex('casa', 'light').pencil` is `'#93897A'`), or resolve them on a live element with `readColor(el, 'pencil').hex`, which follows the page's palette and theme. Redraw when the theme changes.

Space, shape and motion: `--sg-space-1` to `--sg-space-8`, `--sg-radius-0` to `--sg-radius-4` and `--sg-radius-pill`, `--sg-step--1` to `--sg-step-5` (fluid type sizes), `--sg-measure` (62ch) and `--sg-measure-narrow`. Durations are `--sg-dur-instant | quick | calm | slow | ambient | fade` and easings `--sg-ease-out | in-out | spring | ink`. The register sets the durations, and reduced motion collapses them, so animate with these and you get both for free.

### Type, including Devanagari and Kannada

The stacks are `--sg-font-display` (Castoro, Tiro Devanagari Marathi, Tiro Kannada), `--sg-font-body` (Mukta, Noto Sans Kannada), `--sg-font-hand` (Kalam) and `--sg-font-mono`. Each covers Latin, Devanagari and Kannada, with metric-matched and system fallbacks, so the page still reads if the fonts fail.

```css
body { font-family: var(--sg-font-body); color: var(--sg-text); background: var(--sg-surface); }
p, li, h1, h2, h3 { line-height: var(--sg-leading-body); }
h1, h2 { font-family: var(--sg-font-display); line-height: var(--sg-leading-tight); }
```

```html
<p lang="mr">पाऊस आला.</p>
<p lang="kn">ಮಳೆ ಬಂತು.</p>
<p lang="kok-Latn">Paus ailo.</p>
```

- Mark every run of Indian-language text with `lang`. `:lang(hi|mr|kok|kn|sa|ne)` raises the `--sg-leading-*` values for the matras above and below the line. Konkani in Romi (`kok-Latn`) keeps Latin leading.
- Declare `line-height: var(--sg-leading-body)` on the text elements themselves, not only on `body`. A custom property only changes the line height where the `var()` is used.
- Kannada has no hand face yet; `--sg-font-hand` falls back to Noto Sans Kannada for it.
- Indian-language copy is reviewed by a native speaker before it ships. Machine translation is a first draft.

## 5. Use `<sg-scene>`

A scene is a drawing that does a job. It can host your words (surface), show something real (state) and answer the person using it (response).

### Attributes

| Attribute | What it does |
|---|---|
| `name` | Which scene: `kolam`, `paus`, `tollem`. Required. |
| `register` | Overrides the inherited register for this scene. |
| `seed` | A number or a word. Same seed, same drawing. |
| `paused` | Present: start paused. Removing it plays again, unless the register or reduced motion calls for a still. |
| `label` | The accessible name of the drawing. Defaults to the scene's own description. Use it when the scene stands for something, such as "Upload progress". |
| every param | Each scene's params, as kebab-case attributes (below). |

Changing any attribute updates the scene with no glue code, so a server can drive it by swapping attributes (htmx works as it is). Numbers are clamped to their range, and an unreadable value falls back to the default. A bare boolean attribute is true; `false`, `0`, `off` and `no` are false. Removing a param attribute returns it to its default.

### Slotted content and the scrim

Put your words inside the element. They sit in a reading layer over the drawing, on a scrim that keeps them readable, and the scene quietens its motion around them (the calm zone).

```html
<sg-scene name="paus" register="warm">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>
```

- The scrim is `--sg-scrim`, with text in `--sg-scrim-ink` if you set it, else `--sg-text`.
- `--sg-reading-place` places the panel (default `end start`, bottom left). `--sg-reading-inset` sets its padding from the edge.
- Style the insides through `::part(panel)`, `::part(reading)`, `::part(stage)` and `::part(toggle)`.
- When the panel would cover more than 45% of the drawing's height (on a phone, usually), it moves below the drawing on the same scrim, and comes back over it under 40%.
- The panel hides itself when nothing is slotted. Keep slotted text short: a heading and a sentence or two. Long reading belongs outside the scene.
- The element sizes itself: it is a block as wide as its container, with the drawing held at the scene's aspect ratio. Size it with `width` or `max-width` in CSS.

### `progress` is real state

Kolam, Paus and Tollem each take `progress` from 0 to 1. Absent, time drives the scene. Set, only the real number moves it, time stands still, and the element says the same number in a polite status region, naming the work: `label="Upload progress"` gives "Upload progress: 40% done". Without a `label` it uses the scene's title ("The threshold at dawn: 40% done"), so always give a state scene a label. It speaks only when the sentence changes, at most once a second.

- Set `progress` only from real work: bytes uploaded, steps finished. Never animate it on a timer. A drawing that moves when the work has not moved is a lie.
- Remove the attribute (or `set({ progress: null })`) to hand the scene back to time.

### Methods, properties and events

| Member | What it does |
|---|---|
| `play()`, `pause()` | Start or stop motion. `play()` also works under reduced motion and in quiet, because the viewer asked. |
| `replay()` | From the start, and play. |
| `reseed(seed?)` | A new drawing: the seed you give, or the next one. |
| `set(params)` | Merge and coerce params, for example `set({ intensity: 0.3 })`. Calls made before the scene loads are kept. |
| `still()` | Draw the finished still and stop. |
| `destroy()` | Tear it down for good. |
| `playing` | True while frames are running. False off screen and in hidden tabs. |
| `wanted` | The viewer's intent: true after `play()`, false after `pause()` or `still()`. Use this, not `playing`, for a play/pause button's label. |
| `params`, `seed`, `meta` | Read only. `meta` has the scene's title, alt text, caption, prompt, map and logical size `W` × `H`. |
| `lastPointer` | The last pointer position the scene saw, in its own units, or `null`. |
| `sg-ready` event | After the first frame is drawn. Bubbles and crosses shadow roots. |
| `sg-state` event | When `wanted` or the still changes. `detail: { wanted, still, playing }`. |

What every scene does without being asked: pauses off screen and in hidden tabs; shows the still in quiet and under reduced motion; puts a native "Pause animation" button in the top right corner in warm and playful whenever it can move (WCAG 2.2.2); in playful, becomes focusable so the arrow keys move a pointer and Enter or Space acts; keeps running through `moveBefore()` and View Transitions; runs the quality governor so slow devices draw less detail.

### Kolam: the threshold at dawn

One unbroken line of rice flour looping around a grid of dots. Hairline ink in quiet, drawn once at a hand's pace on a red-oxide floor in warm, poured by your hand on laterite with rangoli colour and ants in playful. A kind loader.

| Param | Values | Default | What it does |
|---|---|---|---|
| `progress` | 0 to 1 | absent | Absent: time draws the kolam. Set: drawn exactly that far. |
| `grid` | 3 to 9 | absent | Dots across, rounded up to odd. Absent: the seed picks. |
| `palette` | `auto`, `flour`, `rangoli` | `auto` | `auto` is white flour in warm and coloured powder in playful. |

```html
<sg-scene id="upload" name="kolam" progress="0" label="Photo upload progress"></sg-scene>
<p id="upload-text">0 of 5 photos uploaded</p>
<script type="module">
  const kolam = document.getElementById('upload');
  // call this from your real upload code, never from a timer
  function onProgress(done, total) {
    kolam.setAttribute('progress', (done / total).toFixed(3));
    document.getElementById('upload-text').textContent = `${done} of ${total} photos uploaded`;
  }
</script>
```

Text slotted over a kolam moves the drawing aside into the largest clear space, so the words sit on clear floor.

### Paus: monsoon, through the glass

A Goan window in the monsoon. Rain beads on fogged glass, merges and runs; the palms lean in the wind. The heavy scene of the set, and the frame-time baseline for every other.

| Param | Values | Default | What it does |
|---|---|---|---|
| `intensity` | 0 to 1 | 0.8 | How hard it rains: beads, streaks outside, rings on the paddy. |
| `fog` | 0 to 1 | 0.8 | How thick the condensation is and how fast it creeps back. |
| `progress` | 0 to 1 | absent | Set: the fog clears from the sill up in step with it. |
| `wipe` | boolean | true | Pointer and keyboard wiping, and the passing hand in playful. |

```html
<!-- a hero that hosts text; rain stays off the words -->
<sg-scene name="paus" register="warm" intensity="0.6">
  <h2>Come for the rain</h2>
  <p>Our lowest rate, June to September.</p>
</sg-scene>

<!-- a gentle drizzle, no wiping, on a quiet page that wants one living thing -->
<sg-scene name="paus" register="warm" intensity="0.3" fog="0.5" wipe="false"></sg-scene>
```

In a dark theme the same window is painted at dusk, with a lamp lit inside.

### Tollem: the pool at noon

Looking down into a Goan pool at noon: a moving net of light over pale tiles, and a frangipani that drops a flower now and then. WebGL, with a full 2D painting when WebGL is missing, lost or too slow.

| Param | Values | Default | What it does |
|---|---|---|---|
| `swell` | 0 to 1 | 0.5 | How much the surface moves. 0 is a still pool with only the net of light. |
| `flowers` | boolean | true | Whether the tree drops flowers. |
| `palette` | `seed`, `aqua`, `sky`, `celadon` | `seed` | Tile and flower colours. `seed` lets the seed choose. |
| `touch` | boolean | true | Ripples from pointer and keyboard, in playful. |
| `progress` | 0 to 1 | absent | Set: one flower sits that far along an arc across the pool. |
| `renderer` | `auto`, `webgl`, `2d` | `auto` | `2d` always paints on a canvas; `webgl` keeps the shader even when frames are slow. |

```html
<sg-scene name="tollem" register="warm">
  <h2>Swim before lunch</h2>
  <p>The pool is open from seven. Towels are by the steps.</p>
</sg-scene>

<!-- booking progress, three steps of five done -->
<sg-scene name="tollem" progress="0.6" label="Booking progress"></sg-scene>

<!-- playful: touch the water, or use the arrow keys and Enter -->
<sg-scene name="tollem" register="playful" swell="0.7"></sg-scene>
```

## 6. Use the components

Components are light-DOM custom elements that wrap and enhance a native element, or a plain status region where no native element fits. The native part carries the meaning, the keyboard and the form behaviour, and it works without JavaScript. The drawing a register adds is `aria-hidden` decoration. Each component's folder has a `.docs.md` with every attribute and a `.prompt.md` with its prompt and map.

```sh
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs add progress toast field-note
```

Component items are named after their folder: `progress`, `loader`, `skeleton`, `toast`, `stamp`, `empty`, `badge`, `field-note`, `connecting`, and for forms `form`, `field`, `select`, `combobox`, `check`, `radio`, `toggle`, `date-range`, `stepper`, `file-drop`, `signature`, `otp`. `add` brings `core-component`, `core`, `tokens` and anything else each one needs. On the page, link the component's CSS and import its module:

```html
<link rel="stylesheet" href="src/lib/susegad/components/progress/progress.css">
<script type="module" src="src/lib/susegad/components/progress/progress.js"></script>
```

### Which one to use

| The person needs to know | Use |
|---|---|
| how far along some work is, and you have a real number | `<sg-progress>` |
| that something is loading, when you have no number | `<sg-loader>` |
| that a region's content is on its way, keeping its shape | `<sg-skeleton>` |
| that something just happened, without being interrupted | `<sg-toast>` in an `<sg-toast-region>` |
| that something real is done: held, received, paid | `<sg-stamp>` |
| what a place will hold, before it holds anything | `<sg-empty>` |
| the status of a thing, in a word or two | `<sg-badge>` |
| what is wrong with a form field and how to fix it | `<sg-field-note>` |
| whether a live connection is up | `<sg-connecting>` |

### Which form part to use

| The person gives you | Use |
|---|---|
| a line of text, or a longer message | `<sg-field>` round an `<input>` or a `<textarea>` |
| one choice from a short, fixed list | `<sg-select>` round a `<select>` |
| a value from a long list, or one that isn't on it (a city, a name) | `<sg-combobox>` round an `<input list>` |
| agreement, or any number of items from a set | `<sg-check>` round a checkbox |
| one of a few choices they should see side by side | `<sg-radio-group>` round a `<fieldset>` of radios |
| something switched on or off | `<sg-toggle>` round a checkbox with `role="switch"` |
| an arrival and a departure | `<sg-date-range>` round two date inputs |
| a long form, one step at a time | `<sg-stepper>` round the form's `<fieldset>`s |
| files | `<sg-file-drop>` round an `<input type="file">` |
| a signature | `<sg-signature>` round a typed-name `<input>` |
| a one-time code from a message | `<sg-otp>` round one `<input>` |
| the whole form: checking it, sending it, and saying what happened | `<sg-form>` round the `<form>` |

### What every form part does

- **The native control is the component.** It submits with the form, takes the keyboard, autofill and password managers, and validates with `required`, `pattern`, `min` and the rest, with or without JavaScript. Write `<label for>` yourself, so the page without JavaScript is labelled too.
- **Problems are said in words** by `<sg-field-note validate>` beside the control. `<sg-form>` adds a note to any field that has none.
- **One drawing language.** Quiet is hairlines and the native look, and moves only as state needs. Warm writes on the paper: a pencil rule drawn by hand under the control, inked as far as your words go (field, select and combobox share it, from `field/rule.js`). Playful stamps things in accent ink, a little tilted, with an off-register ghost.
- **A problem shows in the drawing too.** A field the note marks invalid turns its rule, box or digits to the danger colour in every register, and the note says what is wrong in words.
- **Send with POST.** A form that carries a name, a number or a signature must never put them in the address bar, the history or a server's logs.

### What every component does

- **Registers.** Each reads the register like a scene does, from `data-register` on an ancestor or its own `register` attribute, and loads only that register's skin. A quiet page never downloads the warm or playful drawing. Quiet is the native element with hairline rules and tokens, and moves only as state needs (under 200 ms). Warm adds hand-drawn detail and slow motion. Playful adds motifs, colour and spring.
- **Reduced motion.** Every skin shows its finished state with nothing moving. All animation pauses off screen.
- **`hidden`.** Each component has its own `display` rule, which would beat the browser's `[hidden]` rule, so core adds `tag[hidden] { display: none !important }` for every component and each stylesheet repeats it. Setting `hidden` on any `sg-*` component hides it. Use `hidden`, not your own class, to take one out of view.
- **Events.** `sg-skin` fires when a register's drawing has loaded (`detail: { register, motion }`). Component events bubble and cross shadow roots.

### Progress that follows the work

- A determinate indicator moves only when its value changes. Set `<sg-progress>` from the work itself (bytes sent, rows imported), never from a timer or an estimate.
- If you have no number, say what is happening in words: `<sg-progress>` with no value, or `<sg-loader label="…">`. Nothing may suggest an amount it does not have.
- A skeleton's ink-in and a stamp's landing happen only when the real thing happens: `busy` removed, `stamp()` called.
- Fireflies fall into step only when `state="connected"`. Change the state from your connection code; the component never guesses.
- Empty states are weather. They never suggest that something is loading.

### Progress

```html
<sg-progress id="upload" label="Uploading photos">
  <progress value="0" max="1">0%</progress>
</sg-progress>
<script type="module">
  const bar = document.getElementById('upload');
  xhr.upload.addEventListener('progress', e => { bar.value = e.loaded / e.total; });
  bar.addEventListener('sg-complete', () => { /* the work reached 100% */ });
</script>
```

`label` names the bar for screen readers and shows above it. `value` (property) sets the native element; `null` makes it indeterminate. `max` on `<progress>` works as usual. `sg-complete` fires once at the maximum. Quiet is a pencil hairline, warm a small kolam drawn exactly as far as the value, playful a cutting-chai glass filling with tea.

### Loader

```html
<sg-loader label="Loading your bookings"></sg-loader>
<sg-loader>Checking the calendar for 14 to 18 October</sg-loader>
```

A polite `role="status"` region: the words are read out, and a change of `label` is read again. Without words it says "Loading" (quiet), "Getting things ready" (warm) or "Spinning up" (playful). Never a number. Quiet shows three pulsing dots, warm a light walking a kolam's line, playful a spinning top.

### Skeleton

```html
<sg-skeleton id="guests" busy shape="list" lines="3" label="your guests"></sg-skeleton>
<script type="module">
  const sk = document.getElementById('guests');
  sk.innerHTML = renderGuests(await fetchGuests()); // content first
  sk.busy = false;                                   // then it steps aside
</script>
```

`shape` is `text`, `card`, `list` or `media`; `lines` is 1 to 12; `label` is a lower-case noun phrase ("Loading your guests", then "Your guests loaded"); `seed` fixes the bar widths. While busy the region is `aria-busy` and its content is hidden. `sg-loaded` fires when `busy` goes.

### Toast

```html
<sg-toast-region></sg-toast-region>
<script type="module">
  import { toast } from './src/lib/susegad/components/toast/toast.js';
  toast('Your changes are saved.', { tone: 'success', title: 'Saved' });
  toast('The photo was deleted.', { action: { label: 'Undo', onAction: restore } });
</script>
<!-- or from a server, appended to the region -->
<sg-toast tone="error"><strong class="sg-toast-title">Couldn't save</strong> Check your connection and try again.</sg-toast>
```

Put one region on the page. `tone` is `info`, `success`, `warning` or `error`. Toasts never take focus. Errors are spoken as alerts and, like any toast with an action, stay until dismissed. The rest stay for their reading time: at least 5 s, and the clock stops while the pointer or focus is on them or the tab is hidden. Region attributes: `max` (default 3), `layout` (`pile` or `list`), `position` (`bottom-end`, `bottom-center`, `top-end`, `top-center`), `duration` (`0` turns every timeout off), `hotkey` (default `Alt+T`), `label`. Methods: `region.show(options)`, `region.hold(on)`, `toastElement.dismiss()`. Event: `sg-toast-dismiss` with `{ reason, id }`.

### Stamp

```html
<sg-stamp id="held" tone="success" pending>
  <p role="status"><strong>Held</strong> <span>12 to 15 Oct, for 20 minutes</span></p>
</sg-stamp>
<script type="module">
  await holdDates();                            // the real work
  document.getElementById('held').stamp();      // lands, and is announced once
</script>
```

`tone` is `accent`, `success`, `warning`, `danger`, `info` or `neutral`. `pending` keeps it hidden and silent; `stamp()` lands it, `lift()` hides it again, `stamped` says which. `sg-stamp` fires on landing. Keep the `<strong>` to one or two words. Mark Indian-language text with `lang`: Latin gets capitals and letter spacing, Devanagari and Kannada keep their natural spacing.

### Empty state

```html
<sg-empty scene="paus" scene-intensity="0.5">
  <h2>No bookings yet</h2>
  <p>When a guest books a room, their stay shows up here with the dates and what they asked for.</p>
  <a href="/share">Share your listing</a>
</sg-empty>
```

Write a heading that says what is empty, one sentence about what will appear, and the one action that moves things on. The element becomes a region named by the heading. `scene` picks the scene (default `paus`); `scene-<param>` passes a param through. Quiet draws a small hairline picture and never downloads the scene. Warm puts the scene beside the words (above them when narrow, never behind), and playful lets people play with it.

### Badge

```html
<p>Your booking is <sg-badge tone="success">Confirmed</sg-badge>.</p>
<sg-badge tone="info" busy>Checking payment</sg-badge>
```

The word is the meaning. `tone` (`neutral`, `accent`, `success`, `warning`, `danger`, `info`) adds a distinct shape and colour. `busy` means the thing is still happening, and the words must say so. A badge is never a button: put a real button beside it if the status needs an action.

### Field note

```html
<label for="email">Email</label>
<input id="email" type="email" required>
<sg-field-note for="email" validate></sg-field-note>

<sg-field-note for="phone" validate data-pattern-mismatch="Use 10 digits, like 98220 12345."></sg-field-note>
<sg-field-note for="dates">Those dates are booked. The next free nights start on 16 October.</sg-field-note>
```

With `validate` it follows the browser's constraint validation and words the first problem ("Enter your email.", "Use at least 8 characters. You have 5."). `data-<check>` attributes (`data-value-missing`, `data-pattern-mismatch` and so on) give your own wording. Without `validate` it shows its own text, for server messages. `tone="hint"` is a note that never marks the field invalid. It stays silent while someone types their first try, shows when they leave a changed field or submit, and goes as soon as the value is right. It manages `aria-describedby` and `aria-invalid` on the field. Methods: `setMessage(text)`, `check()`. Event: `sg-field-note` with `{ shown, message, field }`.

### Connecting

```html
<sg-connecting id="live" state="connecting" label="Live updates">
  <span role="status">Live updates: connecting</span>
</sg-connecting>
<script type="module">
  const live = document.getElementById('live');
  socket.addEventListener('open', () => { live.connection = 'connected'; });
  socket.addEventListener('close', () => { live.connection = 'offline'; });
</script>
```

`state` (or the `connection` property) is `connecting`, `connected` or `offline`, and a server can swap the attribute. A picture of a state that should not speak, such as a gallery of stills, takes `role="none"`: the words still show, but not as a live region. The words are the same in every register and are read out politely when they change. Quiet shows a still dot, a different shape per state. Warm and playful show fireflies that blink out of step and fall into step within about three seconds of `connected`.

### Form

```html
<sg-form>
  <form action="/enquire" method="post">
    <sg-field><label for="name">Your name</label><input id="name" name="name" required autocomplete="name"></sg-field>
    <sg-field><label for="contact">Phone or email</label><input id="contact" name="contact" required></sg-field>
    <button>Send</button>
  </form>
</sg-form>
<script type="module">
  document.querySelector('sg-form').addEventListener('sg-submit', e => e.detail.respondWith(
    fetch('/enquire', { method: 'POST', body: e.detail.formData }).then(r => {
      if (!r.ok) throw new Error(`the server answered ${r.status}`);
      return { message: 'Sent. We will write back within a day.', stamp: 'Sent' };
    })));
</script>
```

Leave `novalidate` out: the element sets it when it runs, so the page without JavaScript keeps the browser's own checks. A valid submit fires `sg-submit` with `{ formData, submitter, respondWith(promise) }`. Resolve with `{ message, stamp, detail, tone, reset }`, all optional, or reject with an `Error` whose message says what happened in plain words. The `fetch` attribute posts to `action` and stays on the page instead; with neither, the browser submits as usual. The states, said once in one polite line: invalid ("Check 2 fields: Your name, Phone or email.", focus on the first), sending (a Loader, only after 150 ms), sent (the message, and a Stamp) and failed (an error toast; the words typed stay). `data-summary-name` on a field gives the summary a short name when the label is a whole sentence. Link the CSS for field, field note, loader, stamp and toast too. **Quiet** uses plainer words ("Sending.", "Sent.") and draws nothing; **warm** and **playful** add the Loader and the Stamp.

### Field

```html
<sg-field>
  <label for="phone">Phone</label>
  <p class="hint" id="phone-hint">We only call about this booking.</p>
  <input id="phone" name="phone" autocomplete="tel" aria-describedby="phone-hint">
</sg-field>
<sg-field>
  <label for="msg">Anything else</label>
  <textarea id="msg" name="message" rows="4" maxlength="600"></textarea>
</sg-field>
```

One label and one `<input>` or `<textarea>`; the element takes only `register`. Hints go between the label and the control. With a `maxlength`, a count appears in the last fifth and is read aloud only at 20, 10 and 0 left. **Quiet:** a hairline rule under a faint writing strip, a textarea ruled like a notebook. **Warm:** written on the paper itself, with no grey well; a seeded graphite pencil rule drawn a little past both ends, inked over as far as your words go, a laterite margin down a textarea, and the focused rule inks in over 560 ms. **Playful:** the same in accent ink with a thicker nib and a double margin; the ink wobbles while you type and settles 0.6 s after you stop.

### Select

```html
<sg-select>
  <label for="guests">Guests</label>
  <select id="guests" name="guests">
    <option>1</option><option selected>2</option><option>3</option>
  </select>
</sg-select>
```

The `<select>` stays native: its keyboard, its listbox, `<optgroup>`, `required`. It adds no events of its own; listen to the select's `change`. Mark an error the server sent back with `aria-invalid="true"`: it looks the same as the browser's `:user-invalid`. Browsers without customizable select show their own, with the hairline border. **Quiet:** a hairline box, a plain chevron, a checkmark on the chosen option. **Warm:** the field's pencil rule and a pencilled caret; a choice inks the rule as far as the chosen words. **Playful:** a stamped box and stamped option chips; a choice lands with a small press.

### Combobox

```html
<sg-combobox>
  <label for="from">Travelling from</label>
  <input id="from" name="from" list="cities" autocomplete="off">
  <datalist id="cities">
    <option value="Mumbai" data-aliases="Bombay, मुंबई">Maharashtra</option>
    <option value="Panaji" data-aliases="Panjim, पणजी">Goa</option>
  </datalist>
</sg-combobox>
```

Without JavaScript it is the browser's own `<input list>`; with it, the ARIA editable combobox. The value is whatever the person types, and the list only suggests. `data-aliases` finds older names, other spellings and other scripts; accents are ignored on Latin letters, never on Indic vowel signs. Put `lang` on an option whose value isn't English. `sg-choose` fires with `{ value }`. A server's error takes `aria-invalid="true"`, as on a select. **Quiet:** a hairline input and a raised list. **Warm:** the field's pencil rule, inking as you type; a list ruled in pencil, the highlighted name underlined in ink. **Playful:** a stamped box and stamped suggestion chips.

### Check

```html
<sg-check>
  <label><input type="checkbox" name="rules" value="yes" required> I have read the house rules</label>
</sg-check>
<sg-check controls="x-breakfast x-pickup">
  <label><input type="checkbox" id="x-all"> All extras</label>
</sg-check>
```

One checkbox and its label. `controls` makes a "select all" of the listed checkboxes, with the mixed state; give that one no `name`, and leave it out of a page that must work without scripts. `indeterminate` sets the mixed state yourself. **Quiet:** a hairline box and a crisp tick. **Warm:** a box sketched in four pencil strokes whose corners cross, and a heavy pencil tick drawn in. **Playful:** a rubber-stamp block, and a bold stamped tick that overprints its edge through the Wave 1 stamp's ink texture, pressing past flat and settling.

### Radio group

```html
<sg-radio-group>
  <fieldset>
    <legend>Arriving by</legend>
    <label><input type="radio" name="arrive" value="car" required> Car</label>
    <label><input type="radio" name="arrive" value="train" required> Train to Thivim</label>
  </fieldset>
</sg-radio-group>
```

Always give the group a `<legend>`: it is the question the radios answer. `orientation` is `column` or `row`; the `value` property gets or sets the choice. **Quiet:** hairline circles and a crisp dot. **Warm:** pencil circles, and the choice circled in ink as a pen circles an answer. **Playful:** bold inked circles, and the choice blooms into a four-petalled kolam flower.

### Toggle

```html
<sg-toggle>
  <label><input type="checkbox" role="switch" name="reminder" value="whatsapp"> A WhatsApp reminder the day before</label>
</sg-toggle>
```

A screen reader calls it a switch. Off sends nothing, like any checkbox, so read it on the server as "present means on". The state is always a shape as well as a colour. **Quiet:** a track and thumb. **Warm:** a brass tower bolt, home in its keeper when on. **Playful:** a clay diya, lit when on.

### Date range

```html
<sg-date-range prices open-from="2026-09-24">
  <fieldset>
    <legend>Your dates</legend>
    <label>Arrival <input type="date" name="arrival" required></label>
    <label>Departure <input type="date" name="departure" required></label>
  </fieldset>
</sg-date-range>
<script type="module">
  const range = document.querySelector('sg-date-range');
  range.blocks = await fetch('/api/taken').then(r => r.json()); // [{ arrival, departure, kind }]
  range.rates = myRateCard;                                    // redraws prices, ribbon and season table
</script>
```

Two native date inputs are the component; the calendar writes into them and sets their validity with the booking kernels' reasons, in a guest's words. `blocks` and `rates` are setters: assign a new value and the calendar redraws, with no other nudge. `open-from` is the first night guests can pick, for a site that takes enquiries before bookings open: every night after the notice period can be picked, and the season ribbon keeps the rate card's own opening flag. Limits the element fills in on the inputs follow both; limits you write are never moved. **Quiet:** hairline cells, the ends outlined and the nights between tinted. **Warm:** the ends looped in pool-blue ink, the nights underlined, and a season ribbon above. **Playful:** the same in laterite ink, bolder and looser.

### Stepper

```html
<form action="/book" method="post">
  <sg-stepper>
    <fieldset><legend>Your dates</legend> … </fieldset>
    <fieldset><legend>Who is coming</legend> … </fieldset>
    <fieldset><legend>Your details</legend> … </fieldset>
    <button type="submit">Send the request</button>
  </sg-stepper>
</form>
```

Each step is a `<fieldset>` with a `<legend>`, a direct child; the one submit button goes last. Next checks the step with the form's own validation and focuses the first problem; focus moves to each new step's legend ("Step 2 of 3"). Hidden steps still submit, and without JavaScript every step shows, numbered. `next()`, `go(i)`, `index`, and `sg-step` with `{ index, from }`. **Quiet:** numbered stations on a hairline. **Warm:** a small survey map of the walk, the road inked as far as you have come. **Playful:** the map in accent ink, with footprints.

### File drop

```html
<sg-file-drop max-size="5 MB">
  <label for="id">Photo ID <span>One photo, JPG or PNG, up to 5 MB</span></label>
  <input type="file" id="id" name="id" accept="image/jpeg,image/png" required>
</sg-file-drop>
```

Everything about what may be sent lives on the input (`accept`, `multiple`, `required`), and the form needs `enctype="multipart/form-data"`. Say the limits in the label too. Files that don't fit are turned away with a sentence; each kept file gets a Remove button named for it. It says "chosen", never "uploaded", because nothing leaves until the form is sent; for uploading as files arrive, use `handoff` and the file-upload recipe. `sg-files` fires with `{ files, messages }`. **Quiet:** a dashed zone that turns solid under a dragged file. **Warm:** a pillar post box whose letter lifts to the slot, and is posted when files are kept. **Playful:** the letter drops in with a thunk.

### Signature

```html
<sg-signature>
  <label for="sig">Type your full name to sign</label>
  <input id="sig" name="signature" autocomplete="name" required>
</sg-signature>
```

The typed name is the whole control without JavaScript and the keyboard way to sign with it. With JavaScript, a pad appears with Undo last stroke and Start again; drawing or typing both count. The form receives `signature` (the typed name) and `signature-path` (the drawn ink as SVG path data in a 600 by 200 box). Show a drawn one again with `<svg viewBox="0 0 600 200"><path fill="currentColor" d="…"/></svg>`, or `toSVG(colour)`. **Quiet:** a plain signing line and a plain pen. **Warm:** a pencilled line and a broad nib at 35 degrees whose ink dries into the paper. **Playful:** as warm in accent ink, with a flourish under the name, never submitted.

### One-time code

```html
<sg-otp>
  <label for="code">Enter the 6-digit code we sent to 98220 12345</label>
  <input id="code" name="code" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required>
</sg-otp>
```

Say in the label how many digits and where the code went. Keep `autocomplete="one-time-code"`, `inputmode="numeric"` and the `pattern`: they bring the phone's code suggestion, the number pad and native validation. Pasting a whole message keeps only the digits, and digits in any Indian script are read as ASCII. Nothing submits by itself when the last digit arrives. `webotp` also asks Android Chrome for the code from the SMS. **Quiet:** plain boxes with a hairline. **Warm:** stamp boxes whose carved frames ink as each digit arrives. **Playful:** a stamp per digit, each at its own tilt, pressed in.

## 7. Recipes

A recipe composes components into a flow for a real job. Recipes live in `packages/recipes/<name>/` (decision 0008) and are added like anything else: `susegad add file-upload` copies the recipe, every component it uses, and a demo `index.html` that opens in your project.

| Recipe | Composes | For |
|---|---|---|
| `file-upload` | Empty, Field note, Progress, Toast, Stamp | choosing photos and PDFs, a bar per file, a "Received" stamp at the end |
| `saving-footer` | Loader, Badge, Toast, Connecting | a form that saves itself when the person pauses, and says so |
| `room-details` | Skeleton, Badge | a homestay room card: held in shape until the details arrive, the rate in rupees (₹1,25,000), availability as a badge |
| `enquiry` | Form, Field, Field note, Select, Combobox | "Ask the house": a native form the browser checks, posting to your endpoint without JavaScript |
| `booking` | Form, Stepper, Date range, Select, Combobox, Radio group, Field, One-time code, Check, Toggle, Signature | a stay in four steps (dates, guests and room, your details, confirm and hold), with a quote the booking kernels work out night by night |
| `proposal` | Scene, Price table, Timeline, Diagram, Signature | a priced offer written in Markdown and built into one sealed Folio document (section 8) |
| `storybook-spread` | Scene (Paus), Narration, Player | two facing pages of a story, in English and Marathi, narrated with the word being read marked and the rain following the story (section 9) |

```js
import { mountFileUpload } from './src/lib/susegad/recipes/file-upload/recipe.js';
mountFileUpload(document.querySelector('#upload'), { transport: myTransport });

import { mountSavingFooter } from './src/lib/susegad/recipes/saving-footer/recipe.js';
mountSavingFooter(document.querySelector('form'), { transport: myTransport, toasts: document.querySelector('sg-toast-region') });

import { mountRoomDetails } from './src/lib/susegad/recipes/room-details/recipe.js';
mountRoomDetails(document.querySelector('article.room'), { source: { load: id => fetch(`/api/rooms/${id}`).then(r => r.json()) }, room: 'garden' });

import { mountEnquiry } from './src/lib/susegad/recipes/enquiry/recipe.js';
mountEnquiry(document.querySelector('sg-form.enquiry__form'), data => fetch('/enquire', { method: 'POST', body: data }).then(r => r.ok ? { message: 'Sent.' } : Promise.reject(new Error(`status ${r.status}`))));
```

```js
import { mountBooking } from './src/lib/susegad/recipes/booking/recipe.js';
await Promise.all(['sg-form', 'sg-stepper', 'sg-date-range'].map(t => customElements.whenDefined(t))); // and the rest in the README
mountBooking(document.getElementById('booking'), { blocks: [{ arrival: '2026-11-13', departure: '2026-11-16', kind: 'booking' }] });
```

The booking recipe is a prototype, and says so on the page: it shows the phone code instead of sending it, and answers the hold at once. For real bookings, send and check the code on your server, and resolve `sg-submit` with `{ message, stamp: 'Held' }` only once your server has made the hold. Use the enquiry recipe while bookings aren't open yet. In warm and playful the enquiry shows the house's front elevation beside its words, a still line drawing (`facade.svg`, 16 KB) used as a CSS mask in the register's ink: no JavaScript, `aria-hidden`, and hidden in quiet and in forced colours. For another house, draw its strokes in `facade.scene.mjs` and run `node packages/recipes/enquiry/facade.bake.mjs`.

A recipe's `recipe.js` only exports; importing it wires nothing. Where a demo page needs wiring of its own (the enquiry's prototype answer), it lives in `demo.js`, which your page leaves out.

How every recipe is built, and how to build the next one:

- **A pure core and a transport.** The words (`STRINGS`), the rules and the state machine sit in a pure `*.core.js`, tested in Node with a virtual clock. The page's only source of change is a transport object, a seeded fake in the demo and your `fetch`, `XMLHttpRequest` or websocket in production. Each recipe's README lists the few methods it needs (`start`/`poll`/`busy` for uploads, `request`/`poll` for saving, `load(id)` returning a promise for a room).
- **The screen never runs ahead of the transport.** A bar shows only bytes reported. An upload's bar reaches its end only when the server confirms the file. "Saving" shows only while a save is in flight, and "Saved at 14:32" is the time the save finished. Timers may decide when to start work (the typing pause); they never show progress.
- **Failure is said, then fixed.** A dropped file keeps its bar where it stopped and gets a "Try again" button. A failed save gets one error toast per outage, cleared by itself when the save succeeds. A room card that could not load hides its skeleton without clearing `busy`, so nothing announces an arrival that did not happen, and only the latest request may change the card.
- **The register is the page's.** A recipe draws nothing of its own. Each component reads `data-register`, so one attribute changes the whole flow.
- **One set of words.** Screen readers hear each state once: one status line or one live component per piece of news, with the pictures `aria-hidden`.

## 8. Write a Folio document

A Folio document is one sealed `.html` file. It opens offline from that one file, loads nothing from the network, prints cleanly on A4 or Letter, and its footer says how to check that nobody has changed it. Use Folio for anything a person keeps, prints or signs: a proposal, a stay note, a lesson, a storybook. For a live page in an app, use the components directly.

Write the document in Markdown with directives (or as an HTML page), then build it:

```sh
npm run folio -- build notes/stay-note.md --budget 1.5MB --pdf
npm run folio -- verify notes/stay-note.folio.html
```

`packages/folio/README.md` has every detail. Decisions 0011 (what the builder depends on), 0012 (the Markdown parser) and 0013 (the diagram contract) say why it works the way it does.

### Markdown with directives

```markdown
---
title: Restoring the house at Balcão
lang: en-IN
register: warm
---
# Restoring the house at Balcão

:::scene{name=kolam seed=7}
## Where we start
Markdown inside a scene sits over the drawing.
:::

:::note{tone=warning}[Before you sign]
The rate card is provisional until the owner confirms it.
:::

::price-table{from=kernels-booking arrival=2026-11-16 departure=2026-11-20 guests=2}

:::timeline
- 2026-11-02: Survey the roof
- 2027-02: New roof on
:::

:::diagram{title="How a guest books" steps}
Guest -> Portal: chooses dates
> The guest picks dates on the booking portal.
Portal => Owner: asks to hold
> The portal asks the owner to hold the house.
:::

::signature{name="The owner" role="for the family" required}
```

- **Front matter** sets `title`, `lang`, `register` (`quiet`, `warm`, `playful`), `theme` (`light`, `dark`) and `description`. Any other key is reported as unused, except where a recipe reads it (the proposal does, below).
- **The Markdown** is a small known subset: headings, paragraphs, block quotes, lists, fenced code, pipe tables with alignment, thematic breaks, raw HTML blocks, emphasis, strong, code spans, links, images and autolinks. It has no reference-style links, no indented code blocks, no footnote syntax, and HTML inside a paragraph is escaped.
- **A leaf directive** stands on its own line: `::name{...}`. **A container** opens with `:::name{...}`, holds lines, and closes with `:::` on its own line. Nest a container with more colons.
- **Attributes** are `{key=value key="a value" #id .class flag}`. A `[label]` goes before or after them.
- **Every mistake is reported at once, with its line number, and the build stops.** Fix the list and build again.

| Directive | Form | Takes | Without its module |
|---|---|---|---|
| `scene` | leaf or container | `name` (required), `register`, `seed`, `label`, `progress` (0 to 1), `paused`, and any scene parameter | the container's Markdown still reads |
| `note` | container | `tone`: `info`, `tip`, `warning`, `success`; a `[label]` (default Note, Tip, Take care, Done) | a plain aside |
| `diagram` | container | `title`, `steps`, `register`, `direction` (`right`, `down`); the line grammar below | the source lines, as written |
| `price-table` | leaf | `from=kernels-booking` (required); `view=bands` for the whole rate card, or `arrival` and `departure` (real dates, at most 90 nights) for one stay; `guests` (1 to 20, default 2), `room`, `register` | a sentence saying which dates the prices are for |
| `timeline` | container | `title`, `scrub`; steps in one of two forms (below) | an ordered list |
| `signature` | leaf | `name`, `role`, `for`, `label`, `field`, `required`; `option` to choose one of the document's options first, or `options="A\|B"` to name the choices | a labelled input to type a name |

A directive's element is used only if its module is in the project. Otherwise its plain version stands, and the build says so.

### The diagram's line grammar

```markdown
:::diagram{title="How a direct booking reaches you" steps}
Site = Your site
group The house: Owner, Caretaker
Guest -> Site: chooses dates
> The guest picks dates on your own site.
Guest => Owner: pays
> The guest pays, and the money comes to you.
Owner <-> Caretaker: plan the stay
> You and the caretaker plan the stay together.
Guest -- Caretaker
> The caretaker looks after the guest in the house.
:::
```

| Line | Means |
|---|---|
| `A -> B: label` | an arrow, with an optional label |
| `A => B: label` | a flow: an arrow with things moving along it |
| `A <-> B: label` | both ways |
| `A -- B` | a plain line |
| `> words` | the step for the arrow just above: read out and listed. Write one for every arrow when you use `steps`. |
| `Name = Label` | show a node under a longer label |
| `group Name: A, B` | a named frame round A and B; a node is in one group at most |
| `title:` / `direction:` / `# ...` | the caption, `right` or `down`, a comment |

Names are what you type. Every diagram has a text alternative made from the same source, so what a screen reader hears and what the picture shows cannot drift apart. A line the grammar cannot read is reported with its line number and left out, and the rest still draws. A line that is only part of a connection, or has two arrows, is an error, never a box:

```markdown
:::diagram{title="Two mistakes"}
Guest -> Portal: books
Portal ->
Owner -> Caretaker -> Guest
:::
```

```
line 3: :::diagram: An arrow needs a name at each end, like Guest -> Portal.
line 4: :::diagram: Write one connection per line: A -> B, then B -> C on the next line.
```

`folio build` reports these, because it draws the diagram. Markdown shown in a page without a build checks only that a diagram has arrows, and the element draws what it can read, so build before you trust a diagram.

Keep a diagram to about a dozen boxes; the layout is simple and large graphs cross lines. `steps` adds Previous step and Next step buttons. Flows move in warm and playful, and stay as three still dots in quiet, under reduced motion and in print.

### The timeline, in two forms

Dated, when the dates are real (YYYY-MM-DD, YYYY-MM, or a label like Week 1):

```markdown
:::timeline{title="The roof"}
- 2026-11-02: Survey the roof
- 2026-12: Tiles ordered
- Week 12: New roof on
:::
```

Numbered, when the order is agreed but the dates are not:

```markdown
:::timeline
1. **You choose an option.** Reply on WhatsApp, or sign below.
2. **The shoot.** We write the brief and the shot list together.
3. **Your site goes live.** The story, the photographs and a sign-up.
:::
```

Use one form for every step, and at least two steps. Built, the plan has a "Walk through the plan" scrubber when JavaScript runs, and reads as a numbered list without it.

### Footnotes

Folio Markdown has no footnote syntax. Put a superscript number where the note is called for, and a paragraph that begins with the same number at the end of the section:

```markdown
MakeMyTrip and Goibibo can take more.¹ Each booking taken on your own site costs you only the payment fee.

¹ In a 2019 complaint to the Competition Commission of India, the hotel federation said standalone hotels were paying them 22 to 40%.
```

The proposal recipe sets such a paragraph small, under a short rule. Elsewhere it reads as a plain paragraph.

### Build, seal and verify

`folio build <page.html or doc.md>` reads the page in Chromium, bundles its modules with esbuild into one script, inlines the styles, keeps only the characters each font actually draws (through HarfBuzz, so Devanagari and Kannada still shape), turns images into data URIs (WebP, or AVIF when `sharp` is installed), adds the print sheet and a Content-Security-Policy that allows only what is inlined, seals the file, then opens it with every network request refused and reports what it found.

| Option | What it does |
|---|---|
| `--out <file>` | where to write it (default: `<page>.folio.html`) |
| `--budget <size>` | fail when the file is larger, for example `1.5MB` (default `3MB`). Every build prints a table of the parts, largest first. |
| `--page A4\|Letter\|auto` | the printed page (default A4; `auto` follows the reader's paper) |
| `--pdf [file]` | also print it to PDF through Chromium |
| `--no-check` | skip opening it with the network blocked |

- **Everything is inside the file.** A remote script, stylesheet or image fails the build with a plain message. A link (`<a href="https://...">`) is fine, because it is not loaded.
- **The seal** is the SHA-256 of the whole file, written into the file itself. `folio verify <file>` exits 0 when it matches and 1 when any byte has changed. In the document, the footer's file chooser checks it on the reader's device with Web Crypto, and sends nothing. On paper, the footer says to run `folio verify`.
- **The budget is real.** Aim well under it: the Wave 3 gate holds a proposal to 1.5 MB.
- **A module with a computed `import()` cannot be bundled.** `<sg-empty>` loads its scene that way, so import the scene directly in the page. The builder notes it.

Before you say a document is done: `folio verify` passes and fails when one byte changes; the network log is empty; it reads at 390 px; it prints to A4 and Letter; and every fact in it has a source (see the proposal recipe).

### Print

The print sheet gives a clean page whatever the screen theme: light colours, no buttons or inputs, scenes kept whole and at most 130 mm wide, link addresses after the links, headings kept with what follows, table rows kept whole, the title as a running header and page numbers. Every `<sg-scene>` draws its finished still before printing. The PDF is printed at twice screen density, so scenes stay sharp.

### The proposal recipe

Use it for a priced offer that someone will read, sign and keep: a proposal, a quote, a scope of work. For writing that has no prices or signature, use plain Folio Markdown. For taking a booking, use the booking recipe.

```sh
node packages/recipes/proposal/build.mjs path/to/proposal.md --pdf
node packages/folio/bin/folio.mjs verify path/to/proposal.folio.html
```

```markdown
---
title: A booking site for the house at Aldona
for: The owners, Casa Aldona
from: The studio
date: November 2026
valid-until: 2026-12-15
status: internal review, not for sending
lang: en-IN
register: warm
---

:::scene{name=paus}
# A booking site for the house at Aldona
For the owners of Casa Aldona, from the studio. November 2026.
:::

## Your rate card

::price-table{from=kernels-booking view=bands}

## What it costs

| What you get | Price |
|---|---|
| **Website.** Your own domain and an enquiry form. | ₹40,000 |

**Option 1, the website.** The site and the enquiry form. ₹40,000.

**Option 2, the website with the booking engine.** Everything in Option 1, and bookings. ₹95,000.

## Saying yes

::signature{name="The owners" for="Casa Aldona" option}
```

- **The cover** is a `:::scene` before the first `##`, with its heading over it. `for`, `from`, `date` and `valid-until` in the front matter are set under the cover. `status` stamps the draft (the part before the first comma, large); take it out to send.
- **One section per `##`.** Scope, costs and who does what are plain tables, and on a phone each row stacks into a card.
- **Room prices come from the booking kernels**, never typed by hand: `view=bands` for the rate card, `arrival` and `departure` for a stay, night by night, with GST on its own line. Readers can try other dates.
- **Options** are paragraphs that open with bold `**Option 1, ...**`. `::signature{... option}` finds them and asks the reader to choose one before signing; `required` makes the choice and the name required.
- **Registers:** quiet is formal (straight hairlines, no section numbers); warm (the default) draws its rules with a pen and letters the section numbers by hand; playful sets the numbers in accent discs.
- **Every fact has a source.** A proposal names real people, places, fees and laws. Keep a `SOURCES.md` beside it: each claim, where it came from (a file, or a public page with the date you read it), and a status: sourced, owner to confirm, or unsourced. Soften or remove the unsourced ones before anyone reads the proposal. `packages/recipes/proposal/examples/sample/` is the worked example.

`packages/recipes/proposal/proposal.docs.md` has the rest, including how it looks on paper and without JavaScript.

## 9. Add sound, narration and video

Sound is the last thing a page gets and the first thing a person can refuse. Decision 0015 sets the rules, and every piece here follows them.

**Two kinds of consent.**
- **Interface and ambient sound** (the vocabulary, soundscapes, haptics) plays only when the global switch is on. The switch is off by default and remembered per viewer. Nothing plays before a gesture on the page, even when the remembered switch is on.
- **Content sound** (narration, video) plays when the person presses its own play control. That press is the consent. It doesn't need the switch and doesn't turn it on. Nothing autoplays with sound.

The register sets the vocabulary: quiet plays confirmations only, warm plays everything softly, playful plays the full vocabulary. Reduced motion doesn't silence sound.

### The switch and the vocabulary (`sound`)

```js
import { soundOn, setSoundOn, onSoundChange, play, haptic } from './src/lib/susegad/sound/index.js';
play('confirm', { register: 'warm' });   // a no-op unless the switch is on and a gesture has happened
haptic('confirm');                        // the paired vibration, same rules
```

The four words are `tick`, `confirm`, `complete` and `error` (a gentle error, never an alarm). Toast, stamp, form and date range already call `play()`; a new component does it the same way, in one line. Offer the setting with `<sg-sound-switch>`, and put it anywhere: several on one page stay in sync. Without JavaScript it says plainly that sound needs JavaScript.

### Soundscapes

`attachPausRain(sceneEl)` makes each new raindrop in `<sg-scene name="paus">` a panned tick (four voices at most). `attachRamponKoel(sceneEl)` gives `<sg-scene name="rampon">` a koel in bouts that speed up, in playful only. Both are opt-in (the page calls them), and both stop when the scene leaves the viewport, the tab is hidden or the switch goes off.

### Narration (`narration`)

Narration is synthesised phrase by phrase (Sarvam `bulbul:v3` by default, or the silent stub offline). Word timings are estimated from each phrase's measured length and its syllables (aksharas for Devanagari and Kannada), because no provider publishes word timestamps, and they're written as WebVTT.

- `node packages/narration/synth.mjs` fills the cache and calls the network only for misses. The key is read from `SARVAM_API_KEY` at run time and never written anywhere.
- `<sg-narration>` wraps the audio and the text: it marks the current word with `aria-current` and fires `sg-phrase` at each phrase, which is how the storybook spread moves its scene with the story.
- Without the network it falls back to the browser's speech with its word boundaries, or to captions only, and says which.
- Commit the built audio and VTT a recipe uses. The phrase cache is disposable.

### The player (`player`) and export (`export`)

```html
<sg-player poster-scene="kolam" treatment="ink">
  <video controls preload="metadata">
    <source src="clip.webm" type="video/webm">
    <track kind="captions" src="clip.vtt" srclang="en" default>
  </video>
</sg-player>
```

- Without JavaScript, the browser's own controls play it in full.
- With JavaScript: a drawn scrubber (a hairline in quiet, an ink line in warm, a kolam bead in playful), captions in our type (on by default, C toggles them), and a scene's still as the poster.
- `treatment` is `ink`, `halftone`, `duotone` or `riso`. It's a WebGL pass that stays hidden until it has drawn, and it falls back to the plain video when there's no WebGL.
- `player.annotations = [{ type: 'circle' | 'arrow', start, end, x, y }]` draws timed ink marks on the moving frame.
- Keys: space or K to play and pause, arrows to seek 5 s (15 s with Shift), M to mute.
- For narrated text, wrap the `<audio>` in `<sg-player>` inside `<sg-narration>`, and let the highlighted text be the captions, as the storybook spread does.

`packages/export` turns any scene into a PNG (`canvasToPng`), a WebM (`recordSceneToWebm`, timed by the scene, not the wall clock) or an animated GIF (`recordSceneToGif`, no dependencies). A WebM from `MediaRecorder` has no seek index, so it plays straight through but can't be scrubbed outside the player.

## 10. Build a new piece

Read `docs/CHARTER.md` and `docs/decisions/0001-architecture.md` first. In brief:

**A scene (contract v2)** lives in `packages/scenes/<name>/` as `model.js`, `render.js`, `meta.js`, `index.js`, `<name>.prompt.md`, `<name>.test.js` and `registry.json`.

- `model({ time, seed, register, params, W, H })` is pure: plain data out, deterministic for a seed, runs in Node, never touches `window`, `document` or a canvas. It may return `{ settled: true }` when nothing will change until an input does.
- `createRenderer(host, { W, H, register, motion, seed, governor, scene, invalidate, advance })` returns `{ render(data, frame), setRegister?, restyle?, activate?, ready?, destroy() }`. It owns every side effect. Draw with the engine's `stage(host, { W, H })`. Quieten motion in and near `frame.calm`, follow `frame.quality`, reset interaction when `frame.epoch` changes.
- `index.js` default-exports `defineScene({ name, meta, params, model, createRenderer, kind, interactive, status })`. Params are typed (`number`, `int`, `bool`, `string`, `enum`) and may default to `null` for "unset". `status(params, meta)` returns only the short part of what a screen reader hears, such as "40% done", or `''` when there is nothing to say. The element puts the label in front. Import `defineScene` from `../../core/index.js`, so loading the scene alone defines `<sg-scene>`.
- `meta` carries `title`, `word`, `gloss`, `caption`, `alt`, `keys` (if interactive), `W`, `H`, `stillTime`, `techniques`, `prompt`, `map`, `credit` and `tier`.
- Three registers, a finished still for reduced motion, a calm reading zone, and a byte budget in `registry.json` (40 KB by default, up to 64 KB with a one-line reason).

**A component** (decision 0005) is one folder in `packages/components/<name>/`: `<name>.js` (behaviour and the custom element), pure logic in `<name>.js` exports or `<name>.core.js`, `skins/quiet.js`, `skins/warm.js`, `skins/playful.js`, `<name>.css`, `<name>.prompt.md`, `<name>.test.js`, `<name>.docs.md`, a `demo.html` that shows every state, and `registry.json` (`type: "component"`, depending on `core-component`).

- Extend `SgElement` from `../../core/component.js` and register with `defineComponent(tag, Class)`. Light DOM only, never shadow DOM for content, so the builder who copies it can style everything.
- Enhance a native element (`static native = 'progress'`): it keeps the role, the keyboard, the form behaviour and the no-JavaScript look. Where none fits, use `role="status"` for news and `role="alert"` only for errors that need attention now.
- Skins are `{ mount(el, ctx) => { update(state), destroy() } }`, loaded lazily per register. They draw `aria-hidden` SVG (animated with the Web Animations API, so it can be paused) or a small engine canvas. `ctx.motion === 'still'` means show the finished state; `ctx.visible` false means pause.
- Keep every string people read in one `STRINGS` object, with quiet, warm and playful variants where the register changes the words.
- Budget: 12 KB of behaviour plus 8 KB per skin, and 16.7 ms a frame when animated. It is not done until it has been used in at least one recipe.

**The prompt and the map.** Every piece ships with one rich paragraph you could give an AI agent to make it, specific about technique and about feeling, and a table from phrases in that paragraph to the technique and one or two plain sentences on what the code does. Check every number in the map against the code.

## 11. Copy standards

Plain, warm, specific, active voice. Sentence case. No marketing adjectives. No em dashes in anything a person reads. Numbers stated plainly. Errors say what happened and how to fix it, and never blame the person. Never announce honesty or transparency; be accurate. The Humane Register Doctrine (in the workspace's `kernel-eval` repo) applies to every word.

| Do | Don't |
|---|---|
| The file did not upload. Check your connection and try again. | An error occurred. |
| No bookings yet. When someone books, they'll appear here with their dates and what they paid. | No data found. |
| Save changes | SAVE CHANGES, or Save Changes |
| 3 of 5 photos uploaded | Uploading... please wait! |
| Our lowest rate, June to September. | Unbeatable monsoon deals, don't miss out! |
| The glass clears as the work completes. | To be transparent, this shows real progress. |
| Your card was declined. Try another card, or call your bank. | Oops! Something went wrong 😢 |

The same moment in each register (a file failed to upload):

- **quiet:** "The file did not upload. Check your connection and try again."
- **warm:** "That one didn't go through. Check your connection and we'll try again."
- **playful:** "Hmm, that file got lost on the way. Check your connection and give it another go."

The higher the stakes (money, errors, deadlines), the calmer the words, whatever the register. Never colder.

## 12. Before you say "done"

Run this list. A check that did not run is written as "not run", never as passed.

- [ ] The register is chosen on purpose, and the piece looks right in quiet, warm and playful, light and dark.
- [ ] Reduced motion shows a finished still, not a blank or a half-drawn frame.
- [ ] Keyboard and screen reader work. Nothing is said only by the drawing: every state it shows is also text.
- [ ] axe reports zero violations in every register and theme.
- [ ] Motion marks something real. `progress` moves only when the work moves. No fake progress, no decorative loaders that loop forever.
- [ ] Colours come from tokens, and text meets 4.5:1 (3:1 for focus rings and control borders).
- [ ] It works at 390 px wide with no sideways scroll, and a tap lands where it looks like it should.
- [ ] Fallbacks hold: without JavaScript, WebGL, the fonts or sound, the page is still usable and dignified.
- [ ] Byte budget and frame time are measured, not hoped for. Frame time is within 10% of the Paus baseline measured in the same run.
- [ ] It pauses off screen.
- [ ] Indian-language text is marked with `lang`, renders in the right face, and has been read by a native speaker. Money shows the rupee and lakh and crore where the reader expects them.
- [ ] No tracking, no requests to anyone else's servers.
- [ ] Motifs respect their tier (pan-Indian, shared practice, local, sacred). Sacred motifs only when the client leads. Traditions and artisans are credited.
- [ ] The prompt and the map ship with the code, and the map's numbers match the code.
- [ ] The copy meets section 11.
- [ ] No console errors or page errors in any matrix cell.

## 13. Gates and tools

Every tool starts its own server and headless Chromium. Output goes to `.shots/` unless you pass `--out`. On Git Bash for Windows, set `MSYS_NO_PATHCONV=1` before passing `--url /...`.

```sh
npm test                                            # every unit test: engine, core, tokens, scenes, tools, CLI, registry
node tools/serve.mjs 5173                           # then open /tools/harness/scene.html?name=paus&register=playful&theme=dark
node tools/shot.mjs paus 1 3 --register playful     # screenshots at 1 s and 3 s; exits 1 on console errors
node tools/matrix.mjs --scene paus --content        # 15 cells: 3 registers x desktop and phone x light and dark, plus reduced motion
node tools/axe.mjs --scene paus --content           # WCAG 2.2 AA in every register and theme; exits 1 on any violation
node tools/matrix.mjs --url /packages/components/toast/demo.html   # a component: every tool takes its demo page
node tools/perf.mjs --scene tollem                  # mean, p95 and worst frame time and JS bytes, next to the Paus baseline
node tools/diff.mjs --scene kolam --seed 3 --at 2 --update   # make a visual baseline
node tools/diff.mjs --scene kolam --seed 3 --at 2            # compare with it
node registry/build.mjs --check                     # manifests, files, dependencies and budgets; fails if the index is stale
node packages/cli/e2e.mjs scene-paus                # add to a fresh project outside the repo, load it, pass on sg-ready and a clean console
node apps/docs/build.mjs && node apps/docs/check.mjs  # build the docs site, then screenshots, axe, overflow and Look closer
```

- The matrix writes a contact sheet at `.shots/matrix/<target>/index.html`. Open it and look. Generating screenshots is not the same as seeing them.
- Headless Chromium caps frames at 60 Hz and draws WebGL on the CPU. Read perf as a ratio to Paus measured in the same run, and use `--uncapped` to see the real cost of a frame.
- `--param key=value` sets a scene attribute in any tool; `--content` slots a sample heading and paragraph so you can check the scrim and calm zone.
- `tools/README.md` has every flag.
