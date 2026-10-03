# The components

*Reference file for [`SKILL.md`](../SKILL.md), split out in rung 7 of docs/requests/2026-09-28-open-the-door.md so the top file stays short. Content moved verbatim; nothing here is new.*

## 6. Use the components

Components are light-DOM custom elements that wrap and enhance a native element, or a plain status region where no native element fits. The native part carries the meaning, the keyboard and the form behaviour, and it works without JavaScript. The drawing a register adds is `aria-hidden` decoration. Each component's folder has a `.docs.md` with every attribute and a `.prompt.md` with its prompt and map.

```sh
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs add progress toast field-note
```

Component items are named after their folder. `add` brings `core-component`, `core`, `tokens` and anything else each one needs. On the page, link the component's CSS and import its module:

```html
<link rel="stylesheet" href="src/lib/susegad/components/progress/progress.css">
<script type="module" src="src/lib/susegad/components/progress/progress.js"></script>
```

The list below is generated from `registry/registry.json` by `node tools/skill-inventory.mjs` (never hand-edited; `--check` catches it going stale): the current, complete set, not an example few.

<!-- inventory:component:start -->
- **action-menu** -- A button with popovertarget and a popover list of real links and buttons: a click already opens, closes and activates items with no script. With JavaScript this adds the ARIA APG menu button keyboard model (roving tabindex, arrow keys, Home/End, typeahead) and a teental-staggered entrance. Quiet is a ruled list; warm is ink-ruled; playful is stamped.
- **badge** -- A word or two of status. The text is the meaning, a distinct shape per tone backs it up, colour comes last. Quiet is text with a hairline rule; warm is a hand-inked outline in the tone's ink; playful is a chip of colour with a kolam flower on the corner. Busy badges breathe or turn, never in quiet or under reduced motion.
- **button** -- A native <button> or <a href>, unchanged, with the register's drawing laid over it: quiet is a hairline outline; warm is a hand-inked outline that boils gently on hover or focus; playful is a stamped chip that presses in and blooms an ink ring on release. Forced colours bring back the browser's own control.
- **chat-thread** -- A conversation as a list of messages a screen reader can read, instead of a screenshot. Phone numbers, emails and names are taken out at build time and replaced by a marker that says what was removed. Quiet is a ruled transcript like a court record; warm puts each message in a hand-inked bubble on paper; playful uses bright bubbles that bounce in as they scroll into view. Replies quote the earlier message ("Replying to:" for screen readers) and reactions are read once, as words.
- **check** -- A native checkbox that submits, validates and takes Space with or without JavaScript. Quiet is a hairline box with a crisp tick drawn by CSS; warm sketches the box in four pencil strokes whose corners cross and draws a heavy tick in by hand; playful is a little rubber-stamp block, and stamps a bold tick over its edge, printed through the stamp's ink texture. Indeterminate, and a "select all" box that goes checked, mixed or clear with its children. Forced colours bring back the system checkbox.
- **combobox** -- An input with suggestions. Without JavaScript it is the browser's own input list and datalist; with it, the ARIA APG editable combobox with a listbox popover, full keyboard support, and matching that finds places however people type them: without accents, by an older name, in another script, or spelled as heard. Warm writes it on the paper over the field's pencil rule, with a list ruled in pencil; playful is a stamped box with stamped chips.
- **connecting** -- A connection's state in words, read out as it changes. Quiet shows a static dot; warm and playful show fireflies that blink on their own while connecting and fall into step (Kuramoto coupling) only once connected. Offline, they dim.
- **date-range** -- Arrival and departure over two native date inputs that submit without JavaScript. With it, a two-month calendar that knows taken nights and turnover mornings from the booking kernels, moves like the APG date grid, feeds the kernels' reasons into native validation, and in warm and playful inks your stay under a season ribbon.
- **depth-photo** -- <sg-depth-photo>: a photograph (or a drawing) with a depth map, seen through a camera. The <img> inside is the picture and its alt is what a screen reader hears. Live (three.js): the focus racks by depth with a circle-of-confusion gather, the camera dollies with true parallax, and the water moves inside a mask. 2D (quiet, reduced motion, lite devices, no WebGL, three blocked): the same frame at rest, the focus still racking, nothing moving on its own. Implements the frame contract for exact-frame export.
- **dialog** -- A modal on the native <dialog>: showModal() traps focus and blocks the page, Escape closes it, focus returns to the opener. Any element with data-sg-dialog opens it; without JavaScript that element is a real link to a real page. Quiet is a plain dimmed backdrop; warm and playful are full-bleed with the Carepa surface behind a floating card, mounted only while open.
- **drawer** -- A panel sliding in from an edge (start, end, top or bottom), on the same native <dialog> contract as Dialog: showModal() traps focus, Escape closes, focus returns to the opener. Quiet is a hairline panel; warm is a paper panel with a deckled edge over the Carepa surface; playful is the same, brighter, with the slide timed to the Teental cycle's first beat.
- **empty** -- What a place shows before there is anything in it: your heading, sentence and action, named as a region. Quiet adds a hairline drawing; warm sets a scene (Paus, rain on a Goan window) beside the words, drifting slowly; playful lets you play with it. The scene loads only when a warm or playful page needs it.
- **event-card** -- One workshop, class, supper club or pop-up: the kind, the title, the date and time, the venue, what you'll do and eat, the price per person and a booking link. It reads the clock in the venue's own time zone and says whether the event is coming up, today, on now or over; a seats line shows only when seats-left is given, sold out only when it is 0, and a finished event stops offering its booking link and says why. Quiet is a ruled card; warm is a ticket with a stub on a perforated line; playful is the same ticket, and the stub tears away a little when you point at it.
- **event-list** -- A calendar of event cards that keeps itself honest: what is coming up is on top, soonest first; what has happened is put away in a closed "Before" drawer (a native details element); and when nothing is coming it says so in words, with your call to action beside it. When the clock passes an event while the page is open the card moves by itself, from a single timer that runs only while the list is on screen. Quiet is a plain ruled list; warm draws the empty state as a ticket with nothing printed on it yet; playful lets the hand show.
- **field** -- A label over a ruled line, for a line of text or a longer message, wrapping a native input or textarea that types, autofills, validates and submits without JavaScript. Quiet is the hairline rule under a writing well; warm writes on the paper itself, over a seeded pencil rule that inks from left to right on focus and under your words as you type, with a laterite exercise-book margin down a textarea; playful draws the same in accent ink with a thicker nib and wobbles on twos while you type. Counts characters near a maxlength, aloud only at 20, 10 and 0.
- **field-note** -- The note under a form field that says what is wrong and how to fix it. Follows constraint validation with its own wording (or shows a server message), never nags on the first try, wires aria-describedby and aria-invalid, focuses the first problem on submit. Quiet is small danger text with a mark; warm a margin note in the hand with a pencil arrow; playful inks it on and underlines it.
- **file-drop** -- A native file input you can also drop files onto. Without JavaScript it is the browser's own input; with it, the real input covers a drop zone, and the element checks accept, size and count, lists each file with a Remove button, and says every change in words. Quiet is a ruled zone; warm posts a letter into a pillar box; playful drops it in with a thunk.
- **folio-diagram** -- A diagram from a few lines of text (Guest -> Portal: books): boxes, arrows, flows with things moving along them, groups, and step-through. Drawn at build time as a static SVG with its text alternative from the same source, so it reads and prints without JavaScript. Loops back go round the side that meets no other box, each label sits beside its own line, and where one cannot, every connection carries its step number instead. <sg-diagram> adds the draw-in, the moving flows, step-through by buttons and keys, register changes, and turns a wide diagram downward on a narrow screen before its words would shrink below about 12 px. Quiet is a plain pen; warm and playful ink it by hand.
- **form** -- A native form the browser validates, which says what happens when you send it. Adds a field note to every field, summarises problems and focuses the first, and follows an sg-submit promise (or posts itself with fetch): Sending only while work is pending, then Sent or why it could not send, in one polite voice. Quiet is words only; warm and playful draw a Loader and a Stamp, and a failure is also a Toast. Without JavaScript it validates and submits natively.
- **link** -- A native <a href>, unchanged, with the register's underline drawn beneath it: quiet is a plain hairline underline; warm draws an ink line in on hover or focus and back out on leave; playful is the underline as a kolam line, one continuous wave with a small knotted loop. Forced colours bring back the browser's own underline.
- **loader** -- A polite status region that says in words what is loading, with a small drawing beside it: three pulsing dots in quiet, a light travelling round a kolam and lighting each dot in warm, a spinning bambaram in playful. It never claims how far along the work is.
- **menu** -- A menu and price list a small food business can run on a phone. The page's own semantic list (sections of dishes, each with a name, price in rupees, unit, sauce line, tags as words and an available, sold-out or ask-first status) reads fine with no script; with it, `orderable` adds a quantity stepper per dish (native buttons, one polite live total) and an sg-change event with the lines and the total. Quiet is a typeset price list with leader dots and tabular figures; warm a menu card with a hand-ruled double frame and script section heads; playful price pills and chips where the count settles once when a dish is added.
- **now-note** -- A short, dated note of what someone is up to right now, with the availability as a badge in words. It adds how long ago it was updated and, past a stale-after limit, says plainly that it may be out of date. Quiet is a dated line; warm is a sticky note in the hand; playful is a café chalkboard in a wooden frame.
- **otp** -- A one-time code entry. The native path is one input with autocomplete="one-time-code" and the number pad, which submits, takes SMS autofill and works without JavaScript. With JavaScript the same input lies transparently over a row of aria-hidden boxes: typing over a box replaces it, backspace works back across them, and a paste keeps just the digits. Quiet is plain boxes; warm stamp boxes that ink each digit; playful a stamp per digit.
- **player** -- The Susegad player: enhances a native video or audio element with a drawn scrubber, captions in our type, a poster that is a scene's still, WebGL video treatments (ink, halftone, duotone, riso) and timed ink annotations on the moving frame. Content sound plays only on its own play press.
- **popover** -- A trigger and a native [popover], unchanged: popovertarget opens, closes, focuses and light-dismisses it with or without JavaScript. Quiet is a hairline card; warm is an inland-letter card with a folded corner; playful adds a dashed postmark. Placement uses CSS anchor positioning where supported, and a pure, tested fallback elsewhere.
- **postcard** -- A card for a piece of work: title, where and when with a status badge beside them, the problem in a line, what was built and the outcome. The heading's link is stretched over the card, so each card is one tab stop with nothing nested. A rubber stamp for the status is opt-in (status-style="stamp"). Quiet is an index card; warm is the back of a picture postcard on deckled card stock with a printed postage square (a postmark on the stamp when there is one); playful is set down crooked and turns over on hover or focus, and lies flat on touch screens and under reduced motion.
- **progress** -- Enhances a native progress element. Quiet is the native bar as a pencil hairline; warm is a small kolam drawn exactly as far as the value, closing at 100%; playful is a cutting-chai glass that fills with tea. It moves only when the value moves, and without a value it says in words what is happening.
- **quote** -- A pull-quote or testimonial in a native figure: the words, who said them, their role and business, and an optional link to the source. Quiet sets the words beside a hairline with the name in small capitals; warm writes them in the hand as a margin note with a pencil bracket; playful sets them large under a hand-drawn quotation mark that inks in once.
- **radio** -- A real fieldset of native radios: arrow keys, one choice per name, required and submitting all stay the browser's, with or without JavaScript. Quiet is hairline circles drawn by CSS; warm draws pencil circles and circles the choice in ink, a leaning oval that runs past its start; playful turns the choice into a four-petalled kolam flower. Forced colours bring back the system radios.
- **reach** -- A contact block in an address: email and WhatsApp as real links (built by waLink and mailtoLink), a copy-the-number button that appears only where the clipboard works and says in words that it copied, and a line on reply times. Quiet is plain lines; warm is an inland letter that stays pale blue at night; playful is a rubber-stamped card with the stamp's own ink starvation on its frame.
- **scroll-section** -- A section whose content -- most often a child <sg-scene>'s progress -- advances as it travels through the viewport, following the Ghat plate's scroll arithmetic. An IntersectionObserver plus a scroll-event safety net (for a fast jump that could skip the observer's near zone) drive the numeric progress a scene needs, since only JavaScript can set an attribute; a genuinely CSS-only reveal layer (.sg-scroll-reveal) uses native animation-timeline: view() where the browser has it, with no JavaScript at all. Quiet and reduced motion never scrub: the section hands its scene straight back to the scene's own still.
- **select** -- The browser's own select, kept native: its keyboard, its screen-reader role and its place in the form are untouched. Where customizable select is supported, CSS draws the button, the caret and the picker: a hairline box and list in quiet; in warm the select is written on the paper, over the field's pencil rule, with a caret of two pencil strokes and ink over the rule under a chosen value; in playful a stamped box with an accent caret, and stamped chips.
- **signature** -- Sign by hand or by typing your name. The native path is a typed-name input that submits and works without JavaScript; with it, a pad takes a finger, pen or mouse, inks the stroke from the pen's pressure and speed, and submits the ink as SVG path data in a hidden input. Undo and start again are real buttons. Quiet is a plain line and a plain pen; warm a broad nib whose fresh ink dries into the paper; playful adds a flourish.
- **site-nav** -- A site header that works with no JavaScript: the page links sit in a native details, a Menu button on narrow screens and a row on wide ones, with the current page in aria-current. No dialog or drawer. Quiet is plain links over a hairline rule; warm writes them in the hand with a pencil line under the current page; playful makes them stamped tabs.
- **skeleton** -- A placeholder for a region whose content is on its way. The region is aria-busy and says what is loading, then announces the arrival once. Quiet is flat sunk blocks; warm is a pencil sketch whose outlines ink in when the content arrives; playful adds colour washes and a wobble on twos while waiting.
- **sound-switch** -- The one control that turns Susegad's sound switch on or off, site-wide, over a native checkbox with role=switch. Checking it is the user's own gesture, so switch.js can resume the audio context right there and play the switch's own confirmation. Without JavaScript the checkbox still works as a switch but has no effect, and a note says so. Quiet is the plain switch; warm draws a small speaker with a slash when off and two arcs when on; playful breathes those arcs gently while on.
- **stamp** -- A mark that something real has happened: held, received, paid. The words are text in a role="status" region, announced once when it lands. Quiet is a ruled rectangle; warm is a tilted block print with seeded ink starvation and an off-register ghost; playful presses down and the ink spreads.
- **stepper** -- A long form walked one step at a time. Without JavaScript every step is a visible fieldset with one submit. With it, Back and Next, focus on each step's legend, progress in words, and nothing typed ever lost. Quiet is numbered stations; warm is a walk on a survey map, the road found round the hills with A*; playful adds footprints.
- **tabs** -- A row of headed sections, read one at a time. Without JavaScript it is a table of contents: every section shows and each link jumps to its heading. With JavaScript it is the ARIA APG tabs pattern, automatic activation, and the selected tab is marked by an ink underline that travels to it: a static hairline in quiet, an eased line in warm, the same line with a bead in playful. Panel swaps use a same-document View Transition where the browser has one, else an instant swap.
- **tile-band** {border, divider, section-break} -- A band of hand-painted tiles for a border or a section divider: Goan azulejo, the blue-and-white tiles of the Portuguese-era houses and churches, with a majolica sister in cobalt, lemon yellow and leaf green. Four geometric and floral motifs (a rosette, a quatrefoil, quarter-circle corners, a vine) laid from a seed, painted once on a canvas and kept, crisp at any pixel ratio, running along the page or down it. Quiet is a cobalt hairline, flat; warm is a hand-painted glaze with brush variation and crackle; playful turns a tile a quarter when you touch it, and settles.
- **toast** -- Short messages that never take focus. A region holds two live regions (polite, and alert for errors) and a pile of letters: the newest in front, the rest peeking above, fanning out when pointed at or focused. Timing follows WCAG 2.2.1: reading time, no timeout for errors or actions, pause on hover, focus and hidden tab. Quiet is a ruled note; warm an inland letter that unfolds; playful adds a postmark that lands.
- **toggle** -- A native switch (a checkbox with role="switch") that submits and takes Space with or without JavaScript. Quiet is a plain track and thumb drawn by CSS; warm is the brass tower bolt from a Goan door, sliding into its keeper; playful is a clay diya that lights, its flame flickering only while lit and on screen. Forced colours bring back the system control.
- **tooltip** -- A trigger and its accessible description, always linked by aria-describedby so the text reaches assistive technology whether or not it is shown. Quiet is a plain small label; warm hand-letters it; playful adds a pencil leader line. Without JavaScript, CSS alone reveals it by opacity on hover and focus. With JavaScript it becomes a popover (hint where understood, else manual), positioned above the trigger and flipped below when there is little room, by a pure, tested placement().
- **veranda-stage** -- <sg-veranda-stage>: the drawn veranda staged in 3D through <sg-depth-photo>, with the page's words on a frosted pane inside it. The words stay real text; drag the grip (core's movable) to move the pane across the picture, PageUp and PageDown or the wheel to bring it forward or send it back, and things in front of it, read from the exact depth map, hide it. Focus follows the pane's depth, and the pane keeps itself readable and clear of every other set of words (the notes, the pot's pane) on release and whenever the camera, the lens or a note changes what is in front. Three.js loads only when the picture will move, from the smaller vendored build. In playful the pane becomes a lens on the veranda in the monsoon or at dusk. Notes stick to places (the door, the seat, the lamp), follow the camera and are found by the depth map under a drop; scrolling can walk the camera down the veranda, stopping at each note. A paragraph marked data-flow sits on its own glass pane at a clay pot that three.js turns on the balcao, the lines set round the pot's silhouette (a still on the 2D tier). Quiet and narrow screens keep the words flat.
- **voice-note** -- A voice message the way a phone shows it: a play button, a waveform you can seek along, the length, and the transcript always on show. It enhances a native audio element and plays only when its own button is pressed. The waveform comes from real loudness measured at build time, or is a seeded stand-in marked as one. Quiet is a hairline row with square bars; warm has pencil bars and an inked ring; playful is a bright pill whose button springs.
- **wa-order** -- The order composer for a small food business: it turns a menu selection into a pre-written WhatsApp message. It asks for the day (respecting a notice in hours), a time of day, delivery or pickup, the area, a name and any notes, shows the exact message ("This is what we'll send") and keeps the Send link's wa.me address equal to it. The plain wa.me link stays in the markup, so with no script it still opens WhatsApp. It never says an order is placed: the person sends the message themselves. Quiet is ruled fields, a plain bordered message and one ink-filled button; warm sets the message on ruled paper in the hand; playful is a speech bubble and a button that presses.
<!-- inventory:component:end -->

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
