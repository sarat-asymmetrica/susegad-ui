# The Kantar interlude

A curtain between two steps of a long flow, so waiting becomes part of the show instead of a stall.

## Usage

```html
<div class="stage" id="stage"><!-- position: relative; the interlude overlays it -->
  <div id="step-slot"><!-- your step content lives here, not directly in #stage --></div>
</div>
```

```js
import { runKantar } from 'susegad/transitions/kantar/kantar.js';

const result = await runKantar(document.getElementById('stage'), {
  work: submitStep(),                    // a Promise: the real wait
  lines: ['Checking your dates…'],        // placeholders; review with a Konkani ear before shipping (HOMAGE rule 7)
  swap: () => showStepTwo(),              // called once, when the real work is done
  register: 'warm',
  label: 'Holding your dates',
});
```

- `host` (here, `#stage`) must be `position: relative` with room for the overlay (`.sg-kantar { position: absolute; inset: 0 }`). `runKantar` **appends** its overlay to `host` and removes only that overlay when it finishes — it never touches `host`'s other children. Keep your step content in a sibling element inside `host` (`#step-slot` above), not scattered directly in `host` itself, so your own DOM updates (in `swap`) can't collide with the overlay.
- `work` is the real thing being waited for. The interlude's "wait" phase lasts exactly as long as `work` takes, plus one small floor (`minWaitMs`, default 300ms; small on purpose -- see "Timing options" below) so even an instant response gets one readable beat, and nothing about real work is held past its own completion.
- `swap` runs exactly once, right as the wait ends (curtain still fully closed), wrapped in a same-document View Transition (`packages/transitions/page.js`) — invisible in practice, since the curtain covers it, but free continuity if anything outside the curtain also uses named persistent elements.
- The skip button is always present. Skipping before `work` finishes moves the curtain on **without** calling `swap` (there is nothing finished to show yet) — check `result.swapped` and decide: most flows just `await work` themselves afterward and call `swap()` when it resolves, or show an error if the user left before it did.

## The result

`runKantar` resolves to `{ skipped, workDone, swapped }`:

| | |
|---|---|
| `skipped` | the visitor pressed Skip |
| `workDone` | `work` had resolved (successfully or not — either counts as "done") by the time the interlude ended |
| `swapped` | whether `swap()` ran |

## The registers

- **Quiet:** no curtain theatre at all — a plain `role="status"` line, honestly held open for exactly as long as `work` takes. The charter's register table gives quiet no ornament; a tiatr curtain is not for an auditor.
- **Warm:** the curtain, in its own ink.
- **Playful:** the same curtain, in the playful palette (laterite through kokum).

Reduced motion takes the same plain path as quiet, in every register.

## Timing options

| Option | Default | |
|---|---|---|
| `minWaitMs` | 300 | the floor: `work` finishing sooner never ends the wait before this |
| `curtainDown` | 700 | how long the curtain takes to fall |
| `curtainUp` | 300 | how long it takes to rise |
| `msPerLine` | 2200 | how long each line of `lines` shows before the next, cycling if the wait runs long |

`minWaitMs` is small by design (Sutradhar review, 25 Sep, KB1): its only job is to keep genuinely instant work from flashing past before anyone can read it. It is measured from when the "wait" phase itself began, so once real work has taken any noticeable time, `work` resolving and the swap happening are effectively the same moment — nothing about a real wait is stretched. An earlier draft used 900ms for both `minWaitMs` and `curtainUp`, which could add several hundred milliseconds after 1-to-2-second work had already finished; a check now asserts the time from `work` resolving to the next step's heading being focused stays at or under 300ms.

## Accessibility

- The song line and the plain fallback are both `role="status"`, so the spoken update is heard once, not lost.
- The curtain itself is `aria-hidden`; nothing about the phase (down, waiting, rising) is shown only in the drawing.
- Skip is a real `<button>`, reachable and operable by keyboard, always present.
- No sound plays on its own (decision 0015). Any sound is the Wave 4 vocabulary, under the global switch.

## After, what we took, what we left

*After* the sketchbook's Kantar plate: a tiatr stage where a singer stands in
front of the curtain and sings while the set changes behind it, so the
audience is never left staring at a stagehand.

*What we took*: the interlude as a structure, a three-phase timeline (down,
wait, rise) where the middle phase is not a fixed song length — it genuinely
tracks the real wait, and a skip always moves the show on. From the plate's
own drawing, we took the curtain's folds and its hem's damped travelling
ripple when it lands (`hemWave`, ported as arithmetic from the plate's
`curtain()`), a gold pelmet trim standing in for the painted proscenium, the
spotlight pool, and — in playful only — a singer's silhouette standing in it
(`singerSilhouette`, the plate's own point-for-point figure, not a redrawn
likeness). A first draft of this component left all of that out and drew a
flat coloured box instead (Sutradhar review, 25 Sep, KS1); it is back now,
canvas-drawn every frame from these pure functions, phase-driven like
everything else here. A second draft's own simplification of the figure
(16 points instead of the plate's 21) quietly lost the shoulder, arm and
hand detail that was Volume III's own second-round fix for "the singer
read as a peg doll" — restored verbatim (Rasika's Wave 5 review, S3 round
1), along with moving the spotlight line to a caption band below the stage
floor, since the line and the figure's head shared the same centred anchor
by construction and the line crossed the head every time. That fix still
left the figure headless: the plate's `singer()` draws a head and a hair
bun onto the same path as the body, a mic and stand, a blurred shadow
thrown on the curtain, and a warm rim where the spot catches the edge —
none of which the body's own 21 points include on their own. Restored
verbatim in round 2 (`singerHead`, `singerBun`, `singerMic`), and the S3
clearance check now measures the head and bun's own extent too, not only
the body polygon, so "no overlap" means the whole figure, not part of it.

*What we left*: the plate's full painted sets (the fields, hills and river
behind the proscenium arch), and the tabla and the trumpet in the pit. This
is a curtain, a pelmet, a spotlight and (in playful) the plate's own
singer's silhouette — a stage implied, not fully built. A fuller staging
remains a later, explicit decision.

The lines this demo ships are English placeholders, marked for review by a
Konkani ear before anything using them leaves the repo (HOMAGE rule 7). The
tiatr itself, and the singers and stage painters who kept it going for more
than a century, are named here as a tradition, not a person; whether any one
of its patrons can be named directly is for the Goan reviewer to say (rule 4).
