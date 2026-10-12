# Tween

Bake and reflow for motion: work out the curve once, then every frame is arithmetic.

An easing is a decision made up front. The Kantar curtain falls on a cubic, the tokens ship three cubic-béziers and two springs, and each frame only needs to know "how far along am I, eased?". `bake()` evaluates the curve into a table of samples (plain JSON, so a build can hold it and CI can read it). `tween()` is the per-frame half: one lookup and one multiply, no solving, no powers, no DOM.

```js
import { bake, tween, still, mix } from './tween.core.js';

// once: the curtain's curve, or any CSS easing the tokens write
const curve = bake('cubic-bezier(0.22, 1, 0.36, 1)');      // motion.easings.out
//  also: bake(easeOutCubic)  bake({ spring: 0.72 })  bake(registers.playful.easeSpring)

// every frame: t is 0..1, the result is the eased progress
const x = mix(0, 240, tween(curve, elapsed / duration));   // slide 240px
```

This does not replace the easings that already exist. Nothing is rewritten, and every existing call site keeps working. It gives them a second form: the same curve as data.

## How close is it

The table has 256 samples (`bake(easing, { samples })` to change) and `tween` is linear between them. Against the maths each curve came from, at 20,001 values of t:

| curve | largest difference |
|---|---|
| Kantar `easeOutCubic`, `easeInCubic` (and so `curtainAt`) | 1.5e-5 |
| token `out`, `in-out`, `ink` (against a dense parametric reference) | 2.9e-5 |
| the closed-form spring, ζ 0.72 and 0.48 | 1.5e-4 and 3.3e-4 |

A spring rings faster the lower its damping ratio, so `bake({ spring: ζ })` takes more samples for a lower ζ (256 for 0.72 and 0.48, 1200 for 0.1, 2400 for 0.05) and stays within 4e-4 of its closed form down to ζ = 0.05. Pass `samples` to choose your own.

A spring settles to within about 0.2% at t = 1 and the tokens' own `springEasing()` snaps that to exactly 1; `bake` does the same, so the last sample interval carries that residual and nothing else does. A `linear()` string is baked as the browser draws it, straight lines between its points.

`tween` treats a `t` that is not a number (NaN, undefined) as 0, the start. `bake` throws a `RangeError` if an easing function gives a value that is not a number, rather than store it.

## Reduced motion

`still(cache)` is where the motion ends, and `tween(cache, t, { reducedMotion: true })` returns it whatever `t` is. A component that honours `prefers-reduced-motion` paints the still and does not run the clock.

## Springs and overshoot

A spring leaves 0..1 on the way (warm by 3.8%, playful by 17.9%). `overshoot(cache)` says by how much, so a caller can leave room.

## Files

- `tween.core.js`: `bake`, `tween`, `still`, `mix`, `overshoot`, `spring`. Pure; runs in Node.
- Tests live next to it (`tween.core.test.js`); they check every curve above against the maths it came from.
