# The Kantar interlude

*The curtain drops, a line plays in the spotlight while the real work happens, and it rises on the next step.*

```js
import { runKantar } from 'susegad/transitions/kantar/kantar.js';

await runKantar(stageEl, {
  work: submitStep(),
  lines: ['Checking your dates…'],
  swap: () => showStepTwo(),
  register: 'warm',
});
```

## The prompt

Build a curtain interlude for the wait between two steps of a form or flow, after the tiatr stage: its principle, not its painted set — but still a curtain a person can recognise, not a coloured box. Run it as a three-phase timeline — the curtain falling, a line playing in the spotlight while the curtain stays fully down, the curtain rising — where the middle phase is not a fixed song length but genuinely lasts exactly as long as the real asynchronous work behind it takes, with one small floor (300ms, KB1: large enough only to rescue truly instant work, never large enough to hold up real work that already took any noticeable time) so even an instant response still gets one readable beat, never longer than that unless the caller explicitly asks for more. Draw the curtain itself on a canvas, every frame, phase-driven and never touching a timer of its own: vertical folds that drift slowly, a hem that ripples with a damped travelling wave the moment it lands (heavy velvet settling, not stopping dead), a gold pelmet trim standing in for the proscenium's valance, and a warm spotlight pool that fades in once the wait begins. In the playful register only, put a simple standing silhouette in that spotlight, swaying gently, as if someone were singing there; keep the quieter warm register to the curtain and the pool alone. Always show a skip control; pressing it before the real work has finished should move the curtain on without pretending the work is done, so the caller can decide what happens next rather than being lied to. Swap the content behind the curtain exactly once, the moment the wait ends and while the curtain is still fully closed, inside a same-document View Transition, so it costs nothing extra and stays consistent with the rest of the site's transitions. Give the interlude three registers, but not equally: an auditor-facing quiet page gets no curtain at all, only a plain, honestly-timed status line; warm and playful get the theatre, in their own ink. Reduced motion takes the same plain path as quiet, in every register. Make no sound of its own.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a three-phase timeline … genuinely lasts exactly as long as the real work takes | pure state machine | `kantar.core.js`'s `waitIsOver({ workDone, msInPhase, minWaitMs })` is the one predicate deciding whether the middle phase may end; it is a function of a boolean and two numbers, not of a Promise, so it is trivial to test every combination in Node. |
| one small floor … never longer than that unless the caller explicitly asks | honest motion | `minWaitMs` defaults to 300ms and is the only thing that can hold the wait open past the real work's own completion. There is no ceiling on the other side: a slow `work` genuinely gets a longer wait, because that is not the interlude adding delay, it is the interlude telling the truth about how long the delay already was. |
| pressing it before the real work has finished … without pretending the work is done | honest motion | `kantar.js` only calls `swap()` when `workDone` is true. A skip pressed earlier still moves the curtain to "up", but `swapped` comes back `false` in the result, so the caller's own code decides what a premature exit means, rather than the interlude silently faking a result nobody computed. |
| exactly once … while the curtain is still fully closed … inside a same-document View Transition | reuse | The same `sameDocumentTransition()` from `packages/transitions/page.js` that Tabs uses for its own panel swap. The curtain hides the swap visually either way; the transition is there for free consistency (a persistent element elsewhere on the page still gets its continuity), not because this swap needs to be seen happening. |
| not equally … no curtain at all [in quiet] | register discipline | `runKantar` branches on `register === 'quiet'` (and on reduced motion) before ever building the curtain DOM: `runPlain()` is a separate, much smaller code path, not the curtain's animation merely sped up or hidden. |
| costs it never touches `host`'s other children | separation | The overlay is `append()`-ed to `host` and `remove()`-d on its own when done; the caller's own step content lives in a sibling element inside the same `host`. An earlier draft used `replaceChildren()` on `host`, which meant a caller's `swap` (itself replacing the same host's children) tore out the still-running overlay mid-animation — the fix, and the reason `host` is documented as "append yours, and mine lives beside it," not "hand me the whole element." |
| a hem that ripples with a damped travelling wave the moment it lands | pure geometry | `kantar.core.js`'s `hemWave(xFrac, curtain, landedSec)`, ported as arithmetic from the plate's own `curtain()`: while still moving, a gentle wave scaled by how much motion is happening (zero at both fully open and fully closed); once landed, an amplitude that decays exponentially with `landedSec`. `kantar.js` tracks the one timestamp (`landedAt`) this needs and hands the rest to the pure function every frame. |
| a simple standing silhouette … swaying gently | pure geometry, register discipline | `singerSilhouette(sway)` returns a closed polygon in figure-relative units, the plate's own 21-point figure (shoulders, a raised arm, a hand) verbatim, not a redrawn simplification; `kantar.js` scales and positions it, and only calls it at all when `register === 'playful'`, so warm keeps the pool without the figure. A second draft here had quietly simplified the figure to 16 points, dropping exactly the shoulder-and-arm detail Volume III's own second round added to stop the singer reading as a peg doll — Rasika's Wave 5 review, S3 round 1, caught it reading as a plain cone again, and it also caught the line crossing the figure's head, since both were centred on the same box by construction; the line now anchors to a caption band below the stage floor instead, so the two boxes never touch regardless of how the figure sways. |
| a head, a hair bun, a mic and stand | pure geometry, evidence | The body's 21 points are only the plate's `singerShape()`; the plate's `singer()` separately draws a head and bun onto the same path and a mic beside it, which S3 round 1 never ported, leaving the figure headless at the shoulders. `singerHead(sway)` and `singerBun(sway)` return the same ellipse `singer()` draws (`hx, hy` is exactly `singerPoint(2, 212, sway)`, the body's own sway law evaluated at the neck), `singerMic()` the same three unswayed points. The S3 clearance check was rewritten to include the head and bun's own top edge (`cy - ry`), not only the body polygon's points, so "no overlap" is checked against the figure a person actually sees, not the part the first check happened to look at. |
| a canvas … never touching a timer of its own | separation, native first | The canvas is sized by a `ResizeObserver` and redrawn from the same `lastPaint` frame data on every resize (a canvas clears itself on resize, so a stale frame left undrawn would flash empty); the drawing function itself (`drawCurtain`) takes only numbers — `curtain`, `tSec`, `landedSec`, `spotAmt`, `playful` — and never reads the clock or a phase name directly, so it is exactly as testable in isolation as the geometry it calls. |

## Accessibility

- The song line and the plain fallback are both a polite `role="status"` region.
- The curtain drawing is `aria-hidden`; the phase itself carries no meaning that isn't also in the DOM (the panel behind it really is hidden, or really has changed, once `swap` has run).
- Skip is a real, focusable `<button>`.
- No sound plays on its own; any sound is the Wave 4 vocabulary, behind the global switch (decision 0015).

## Credit

*After:* the sketchbook's Kantar plate, a tiatr stage — a singer performs a short song in front of the curtain while the set changes behind it, so the audience is never left staring at a stagehand.
*What we took:* the interlude as a structure (a curtain, a spotlight moment, a skip), and, from the plate's own drawing, the curtain's folds, its hem's damped ripple on landing, a pelmet standing in for the proscenium, the spotlight pool, and (playful only) the plate's own singer's silhouette, point for point.
*What we left:* the plate's full painted sets and the pit band — a principle taken from the likeness, not the likeness itself (HOMAGE rule 1). Three drafts, three review rounds: the first took the structure only and drew a flat coloured box; the second brought the drawing back but simplified the singer down to a cone and let the spotlight line cross straight through its head; the third restored the body's full 21 points and moved the line clear, but still left the figure headless, since the plate's head, bun and mic are a separate part of `singer()`, not the body outline. All fixed on review: the craft is back, canvas-drawn from pure, tested geometry, a whole figure, and the line clear of all of it.

The demo's song lines are English placeholders, marked for a Konkani ear (HOMAGE rule 7) before they, or anything built from them, leave the repo.
