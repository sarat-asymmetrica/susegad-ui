# Orient

*Orientation-aware words in a drawing: a text panel may turn, but it never turns out of the readable cone.*

A panel of real text whose supporting plane has an orientation, expressed as a unit quaternion. The orientation is soft-constrained toward the viewer: the panel may turn, but never past a readability cone around the reader, and outside that cone the orientation is projected back onto the cone's boundary rather than clamped per axis. It settles toward a target orientation with a damped, frame-rate independent shortest-path slerp, and the register changes the model's parameters rather than only its colour. It refuses two things. It never lets a plane leave the readable cone, and it never touches text. The metrics stay the type tier's business; the orientation is a composited transform on the text layer, so the words stay real, stay selectable, stay in the accessibility tree, and never reflow because of the turn.

```js
// The applier, beside a DOM text layer.
import { createOrient } from 'susegad/core/orient.js';

const turn = createOrient({ layer, register: 'warm', perspective: 900 });
turn.apply(aim({ pointer: [-0.5, 0] }, { params: params('warm') }));   // then it settles
turn.setRegister('playful');                                           // model params change, not just colour
turn.destroy();

// The pure core, in a renderer or a test, with no DOM at all.
import { params, aim, softConstrain, settle } from 'susegad/core/orient.core.js';

const p = params('warm', { reduced: false, lite: false, saveData: false, touch: false });
const qTarget = aim({ pointer: [-0.5, 0], turn: 1, params: p });
const { q, overDeg, clamped } = softConstrain(qTarget, IDENTITY, p.maxTiltDeg);
const { q: qNow, settled } = settle(IDENTITY, q, 1 / 60, { tau: p.tau });
```

## The prompt

Build a small, dependency-free orientation layer for words that sit inside a drawing. Put the maths in a pure module, `quat.core.js`: unit quaternions written `[x, y, z, w]`, right-handed with `w` last, a Hamilton product, a normaliser that returns identity when an input is degenerate, the geodesic angle between two orientations, axis-angle and Euler constructors, a 3x3 and a 4x4 matrix in column-major order ready for a CSS `matrix3d`, a vector rotation, a look-at, a shortest-path slerp that never takes the long way when the dot product is negative, and a damped settle implemented as slerp with `k = 1 - exp(-dt / tau)` so its rate does not depend on frame rate. Put the policy in a second pure module, `orient.core.js`: a readability cone of 35 degrees beyond which a plane reads as a picture rather than as text, a soft constraint that projects a target orientation back onto the cone's boundary using that geodesic angle rather than clamping pitch, yaw and roll separately, a damped settle with a deadband so the panel comes to rest without jitter and never overshoots in the quiet register, a deterministic seeded sway, and a function that writes a plain sentence for a polite status line. Let the register change the model, not the colour: quiet is zero maximum tilt and no sway, warm is 6 degrees of tilt with 1.2 degrees of sway and a 0.9 second settle, playful is 16 degrees with 3.5 and 0.45 seconds, and the register also decides whether the pointer may turn the plane at all. Make quiet, reduced motion, the 2D tier and a missing `matrix3d` support test all resolve to the identity orientation: the finished still, with no three.js and no transform churn. Drive the applier, `orient.js`, beside a DOM text layer: write the composited transform on that layer only, set `data-orient="on"` or `"off"`, set a transition only while the panel is moving and clear it at rest, arm pointer look only when the register's parameters say the pointer may turn it, and clear to identity when the register or the reader's motion setting says so. Never read or write text metrics here, because they stay the type tier's business: a turn is a composited transform on already-laid-out text, so line boxes, selection and the accessibility tree are exactly as they were before the turn and layout never changes. Degrade honestly: with no JavaScript the finished still is shown, unchanged and readable.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a plane may turn, but only inside the readable cone | the soft constraint | `softConstrain(qTarget, qView, maxTiltDeg)` in `orient.core.js` measures `qAngle` between the target and the viewer and projects the target back onto the cone's boundary when it is outside, returning `{ q, overDeg, clamped }`. Nothing is clamped per axis. |
| settles by slerp, at the same rate on any frame rate | damped settle | `damp(a, b, dt, tau)` in `quat.core.js` is a shortest-path slerp with `k = 1 - exp(-dt / tau)`, so 100 steps of 10 ms and one step of 1 s agree within 1e-3 rad. |
| comes to rest without jitter | deadband | `settle(qNow, qTarget, dt, { tau, deadbandDeg })` in `orient.core.js` stops once the geodesic angle is inside the deadband and reports `settled`. |
| the panel sways a little, always the same way | seeded sway | `sway(tSec, seed, { swayDeg, maxTiltDeg, qView })` in `orient.core.js` is deterministic for a seed, and returns identity when `swayDeg` is 0. |
| the register changes the model, not the colour | register parameter surface | `params(register, { reduced, lite, saveData, touch })` in `orient.core.js` returns `{ maxTiltDeg, swayDeg, tau, followsPointer, swayOn }`, and `setRegister()` re-reads it. |
| the pointer may turn it | pointer look | `aim({ pointer, turn, params })` builds the target orientation, and `orient.js` arms pointer look only when `params().followsPointer` is true. |
| quiet is the finished still | identity orientation | `params('quiet')` and any reduced-motion params carry `maxTiltDeg = 0` and `swayDeg = 0`, and `orient.js` clears the layer to identity with `apply(IDENTITY, { immediate: true })`. |
| says out loud that the words turned | polite status line | `tiltWords(q, qView)` in `orient.core.js` returns a plain sentence such as "The words face you." for a polite live region. |
| a turn without touching layout | composited transform | `cssMatrix3d(q)` from `quat.core.js` writes the transform on `layer` alone; `orient.js` never reads or writes text metrics, so line boxes and selection are unchanged. |
| turn off cleanly | teardown | `destroy()` in `orient.js` clears the transform and `data-orient`, and removes the pointer listener. |

## Registers

| Register | maxTiltDeg | swayDeg | tau | followsPointer | swayOn |
|---|---|---|---|---|---|
| quiet | 0 | 0 | none | false | false |
| warm | 6 | 1.2 | 0.9 | true | true |
| playful | 16 | 3.5 | 0.45 | true | true |
| any, with reduced motion | 0 | 0 | none | false | false |
| any, lite or Save-Data | one register down (playful steps to warm, warm steps to quiet) | | | | |

`READABLE.limitDeg` is 35 and `SETTLE.deadbandDeg` is 0.25 for every register. Reduced motion always wins over the register, and the lite step down is applied after it.

## Degradation

- **No JavaScript:** the text layer is plain DOM text in its laid-out position, at the identity orientation, with no transform and no `data-orient`. The panel reads exactly as static text.
- **Reduced motion:** identity orientation, `maxTiltDeg = 0` and `swayDeg = 0`, and the layer stays identity across the whole settle window. A version that animates must fail the check.
- **Quiet:** identity orientation, no pointer look, no sway, no transition. The finished still, with no request for three.js.
- **The 2D tier:** the same identity orientation and no three.js. The tier choice happens before any orientation work.
- **Lite device or Save-Data:** parameters step down one register, so a playful page settles and sways like warm, and a warm page sits still like quiet.
- **`matrix3d` unsupported:** the applier fails its support test once and leaves the layer at identity, so the words are the plain text they would have been without the turn.

## Invariants

1. Pure cores stay pure: `quat.core.js` and `orient.core.js` import nothing and run in Node, and the tests prove it.
2. Every exported quaternion is unit-norm within 1e-9, and `qNorm` is the only way out of a degenerate input.
3. Slerp is shortest-path and geodesic: `qAngle(slerp(a, b, t), a)` grows monotonically to `t = 1`, and slerp never takes the long way when `qDot < 0`.
4. Settle is frame-rate independent: `damp(a, b, 0.01, tau)` applied 100 times equals `damp(a, b, 1, tau)` within 1e-3 rad.
5. The cone is never crossed: `softConstrain`'s result is at most `maxTiltDeg` from `qView`, over a seeded sweep of targets, for every register.
6. Quiet and reduced motion are identity: their params carry `maxTiltDeg = 0` and `swayDeg = 0`, and `sway` returns identity for them.
7. Determinism: the same seed and time give the same quaternion, in this process and the next.
8. Text stays real: measured line boxes are identical before and after a turn, and the words stay selectable DOM text in the accessibility tree.
9. No new heavy dependency: pure maths only, with no three.js, no Pretext and no library in these files.
10. Budgets hold: `quat.core.js` and `orient.core.js` together sit inside decision 0010's 12 KB pure-core allowance, and `orient.js` sits inside 12 KB, or 16 KB with a one-line reason.

## Budget

`quat.core.js` and `orient.core.js` together stay within decision 0010's 12 KB pure-core allowance, and the card declares what each weighs once they are built. `orient.js` is budgeted apart from the pure core: 12 KB, or 16 KB with a one-line reason recorded in the manifest. Nothing here loads three.js, and a page in quiet, under reduced motion or on a lite device downloads none of it.