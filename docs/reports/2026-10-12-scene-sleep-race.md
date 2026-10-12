# The sg-scene sleep race (12 October 2026)

Verdict: a real bug in `packages/core/scene-element.js`, not an artefact of virtual frames. Virtual frames only make
it certain instead of rare.

## Mechanism (line numbers are the code before the fix)

- `#invalidate()` (229-232) returns at once when `#lp.playing`, on the reasoning "the next tick will draw".
- `#draw()` (234-250) runs inside that tick. If `data.settled` flips true there, line 243 sets `#sleeping = true` and
  calls `#sync()`, which computes `run = false` (216) and calls `#lp.pause()` (217). `loop.pause()` cancels the rAF
  that `tick` had already queued (`caf(id)`, engine/src/loop.js).
- So: a renderer that calls `ctx.invalidate()` inside the same `render()` that settles the scene (layer N of M just
  painted, M-N to go) has its ask dropped by line 230, and the tick it counted on is cancelled by line 217. Nothing
  is queued and nothing wakes it: `#wake` is only called by `set`, `reseed`, pointer, keys and `advance`.
- The same hole opens with any other stop between the ask and the next tick: `pause()`, the IntersectionObserver
  leaving the viewport, a hidden tab (all go through `#sync`). Scrolling back or un-hiding restarts the loop, which
  repaints, so those heal themselves. Settle and `pause()` do not.
- A resize does not rescue it either, where the stage width does not change: the ResizeObserver does not fire.
  (When it does fire, `#measure` calls `#invalidate`, which works once the loop is paused; I did not need that path.)

## Why the real clock hides it

Shet paints its layers in time slices and finishes them from promises and idle callbacks, which land between
ticks, when the loop is already asleep and `#lp.playing` is false, so `#invalidate` queues its frame. On virtual
frames the slices run inside the stepped rAF callbacks, so they land inside the tick that settles. The window is
"a layer finishes in the same tick as settle". On a real page that is a coincidence of timing, most likely on a
fast machine with a warm cache. The effect for a user would be a half-painted still that stays so until something
wakes it (a param, the pointer, a register change); sg-ready would also be late or never, since it waits on the
renderer's `ready`, which needs the last layer. I did not catch it happening on the real clock (see limits).

## Proof

- `packages/core/scene-element.test.js` drives the real `SgScene` in Node under a fake DOM, a fake rAF queue and a
  hand-stepped clock. Red on the old code: "all layers painted (drew 1 times): 1 !== 3" and "the pending layer is
  still painted while paused: 1 !== 2". Green after.
- shet on virtual frames, `progress=0.2`, `year.js` aborted (the check's `visit` with its real-clock exception removed,
  as a scratch copy): old code `FAIL ready ... no sg-ready in 40 s`; fixed code ready in 2.2 s.

## The fix

One flag, `#dirty`. `#invalidate()` records the ask when the loop is playing instead of discarding it; `#draw()`
clears it before rendering (an invalidate during `render()` sets it again); `#sync()` hands a pending ask back to
`#invalidate()` whenever it stops the loop. A scene that is still running costs one boolean write per draw. Nothing
else changes.

## For tools/lib/virtual-time.mjs

The helper is now safe to use on held scenes, and the check's real-clock exception for `progress` (shet.check.mjs,
`visit`) can be dropped. Keep stepping rAF only at frame boundaries and settle microtasks and message-channel tasks between
steps, as it does; that is the closest match to the browser's order, and this bug showed it is the right thing to
test against rather than around.

## Limits

I did not reproduce the lost frame on the real clock. The real-clock ordering above is inferred from Shet's
slicing, not measured. The `tools/lib/mutants.test.mjs` failure in `npm run gates`
(`shet.check.mjs:43`, an unlisted `.replace(from, to)`) is on main at c08dd03 too, and is not from this change.
