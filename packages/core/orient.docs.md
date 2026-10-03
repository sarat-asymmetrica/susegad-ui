# Orient

Give a block of words an orientation inside a drawing. The panel may turn with the pointer or sway on its own, but it is soft-constrained toward the reader: it never turns past a 35 degree readability cone, and it settles with a damped slerp that comes to rest without jitter. The words stay real DOM text with metrics owned by the type tier, so a turn never reflows anything.

The pure core is `quat.core.js` and `orient.core.js`. The browser applier is `orient.js`. Both cores run in Node with no DOM, no three.js and no Pretext.

## Use

There are two ways to use it, depending on who owns the text.

**The pure core alone, in a renderer.** Import from `orient.core.js`, drive it with your own loop, and read the quaternion. Nothing here touches the DOM.

```js
import { params, aim, softConstrain, settle, tiltWords } from 'susegad/core/orient.core.js';

const p = params('warm', { reduced: false, lite: false, saveData: false, touch: false });
const qTarget = softConstrain(aim({ pointer: [-0.5, 0], turn: 1, params: p }), qView, p.maxTiltDeg).q;
let q = qView;
function frame(dt) {
  const step = settle(q, qTarget, dt, { tau: p.tau });
  q = step.q;
  // draw with q, and say tiltWords(q, qView) in a polite live region
}
```

**The applier beside a DOM text layer.** This is the common case. `createOrient` writes one composited transform on the layer you pass, and nothing else.

```js
import { createOrient } from 'susegad/core/orient.js';

const turn = createOrient({ layer, register: 'warm', perspective: 900 });
turn.apply(q);                          // immediate: true skips the transition, for a still or a teardown
turn.setRegister('playful');            // model parameters change, not just the colour
turn.setReduced(true);                  // clears to identity and stops
turn.state();                           // { q, transformed, overDeg }
turn.destroy();
```

`orient.js` sets `data-orient="on"` or `"off"` on the layer, sets a transition only while the panel is moving and clears it at rest, and arms pointer look only when the register says the pointer may turn it.

## Registers

| Register | maxTiltDeg | swayDeg | tau | followsPointer | swayOn |
|---|---|---|---|---|---|
| quiet | 0 | 0 | none | false | false |
| warm | 6 | 1.2 | 0.9 | true | true |
| playful | 16 | 3.5 | 0.45 | true | true |
| any, with reduced motion | 0 | 0 | none | false | false |
| any, lite or Save-Data | one register down (playful steps to warm, warm steps to quiet) | | | | |

`READABLE.limitDeg` is 35 and `SETTLE.deadbandDeg` is 0.25 for every register. Reduced motion always wins over the register, and the lite step down is applied after it.

## Accessibility

- **The words stay real.** A turn is a composited transform on text that was already laid out. Measured line boxes are identical before and after a turn, the words stay selectable DOM text, and they stay in the accessibility tree.
- **Selection is preserved.** Selecting across the lines yields the words, because the layer holds real text nodes rather than an image or a canvas.
- **The status line is polite.** `tiltWords(q, qView)` returns a plain sentence such as "The words face you." Write it into a `role="status"` region, so a screen reader hears the orientation only when it changes and never on every frame.
- **Reduced motion is a finished still.** With `prefers-reduced-motion`, and in quiet, the layer sits at the identity orientation.
- **Theatre carries no meaning.** Nothing about the content depends on the angle. The words read the same at identity.

## Where it fits

- **The veranda's pane.** The pane already hosts words at a depth and settles them readable. `orient.js` adds the missing degree of freedom, the pane's orientation, so a panel can turn inside the drawing instead of staying parallel to the picture. The pane keeps its own settle and mask behaviour.
- **An existing depth stage.** Orient does not require the three.js tier and does not load it. Where a depth stage is already running, read the viewer's orientation from it and pass that as `qView`, so the readability cone is measured against the real camera rather than the identity.
- **Without any drawing.** It works on its own against a plain text layer, which is how the self-contained demo page proves it.

## Limits

- It orients a plane. It does not move it, scale it, or set its depth.
- It owns no text metrics and never reads them. Line breaking and font sizing stay with the type tier, so a turn cannot fix an unfit line.
- It does not carry camera slerp paths, the stroke engine, or sound coupling.
- Pointer look needs a pointer. On a touch device the register's own decision stands, and quiet or reduced motion leaves the panel still.
- A page without JavaScript shows the finished still: plain, laid-out text at the identity orientation.