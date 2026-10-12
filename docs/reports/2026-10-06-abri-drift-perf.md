# Abri's drift, measured (perf at a moment)

Rasika's review of the abri calm-zone fix (docs/reviews/2026-10-06-abri-calm.md, "should fix" 1) said the pack's perf run (0.99x Paus) was a claim about the first 6 s, the drops stage with no words, and not about the drift with words slotted. `tools/perf.mjs --at` now measures the moment that matters.

## How the moment is reached

The scene element has no seek, and abri walks a simulation forward as it plays, so a jump would skip the work. `tools/warp.core.js` wraps `requestAnimationFrame` and plays the frames back to back with a stepped timestamp and no vsync wait (33 s of scene time in about 20 to 40 s of wall time on this machine), then hands the clock back with a constant offset. The output prints the scene's stage and `u` at the window's start and end.

Fail-first (the control that could have shown the old blind spot): without `--at`, playful with words, the window is `stage drops, u 0.1 to 3.15`, abri holds 16.7 ms (0.63x Paus). With `--at 33` the same command's window is `stage drift, u 33.1 to 36.4`.

## Results

Playful, words slotted unless marked, desktop 1280 px, Paus measured in the same run at the same moment (same warp), 3 s window, vsync-capped. The machine was busy with other agents' work throughout (62 to 100% CPU busy, 4 x Intel N100), so Paus itself read 20 to 28 ms; read the ratio, not the milliseconds.

| window | abri frame mean by second (ms) | ratio to Paus (mean, p95) |
|---|---|---|
| no `--at` (drops, u 0.1 to 3.2), words | 16.7 16.7 16.7 | 0.63x, 0.50x |
| drift, governor as it runs, words, run 1 | 63.5 63.5 66.7 | 2.17x, 2.50x |
| drift, governor as it runs, words, run 2 | 70.0 73.8 75.6 | 2.61x, 2.50x |
| drift, governor as it runs, no words, run 1 | 78.2 87.5 98.3 | 3.40x, 3.00x |
| drift, governor as it runs, no words, run 2 | 78.2 78.2 95.4 | 4.29x, 3.00x |
| drift, `--quality low`, words, run 1 | 31.3 33.9 39.7 | 1.69x, 2.00x |
| drift, `--quality low`, words, run 2 | 34.5 38.3 42.0 | 1.68x, 2.00x |
| drift, `--quality low`, no words, run 1 | 32.8 38.5 46.2 | 1.48x, 2.49x |
| drift, `--quality low`, no words, run 2 | 27.2 37.8 45.5 | 1.76x, 2.49x |

An earlier set of the same configurations, overlapped by a second copy of my own script (so about double the load), agreed within roughly 10%: 2.7 to 2.8x full, 1.4 to 1.5x low, with words; 3.2 to 3.6x full, 1.8x low, without. With `--throttle 4 --quality low` and words, both sides slower: 1.24 to 1.25x (the control also loses frames at 4x, so the ratio narrows).

What it says:

1. The drift is the expensive moment. It costs 2.2 to 2.6x Paus at full quality with words, against 0.63x in the first seconds. The pack's 0.78 to 0.99x never touched it.
2. The calm-zone change is not what makes it expensive. The same drift with no words costs more (3.4 to 4.3x), so the held zone saves work rather than adding it. Rasika's worry (a `Path2D` per colour plus a second clipped fill near the words) does not show up as a net cost at this size. I did not measure the pre-fix commit against it; that would settle "did the fix change the drift cost at all".
3. Low quality helps a great deal (about 2x lower frame time) and `--quality low` took effect: without it the frame time at the same moment is 63 to 76 ms. It does not bring the drift under the 10% budget. At its lowest, on this loaded machine, abri's drift is still about 1.5 to 1.8x Paus and the frame mean climbs through the 3 s window (27 to 31 ms at the start, 40 to 46 ms at the end), the stage getting heavier as the drift proceeds.
4. The governor does not get low quality in time on its own. In the first run the frames are 64 to 78 ms from the first second; the governor needs 60 slow frames per quarter step, and the drift lasts about 6 s of scene time. On a device that is fast through the comb (so the governor sits at full), the drift arrives at full quality and runs slow for the first stretch of it. This is a finding for the scene's owner, not a pass or fail of this slice. A separate request is the place for it (suggested name: "abri drift cost at full quality").

Caveats: headless Chromium, CPU-rendered, a machine under load from other agents; one 3 s window per run, two runs per condition. `--quality low` steers the governor by feeding it 34 ms frames while warping; it cannot read the governor's level (the scene exposes none), so the proof it took effect is the 2x difference above, not a readout. A fast machine climbs back after about 4 s of calm frames, so only short windows are honest.

## Commands

```
node tools/perf.mjs --scene abri --register playful --content --seconds 3 --rounds 1                           # no --at: the blind spot
node tools/perf.mjs --scene abri --register playful --content --at 33 --seconds 3 --rounds 1                   # drift, governor as it runs
node tools/perf.mjs --scene abri --register playful --content --at 33 --quality low --seconds 3 --rounds 1     # drift, governor at its floor
node tools/perf.mjs --scene abri --register playful --at 33 --seconds 3 --rounds 1                             # drift, no words
node tools/perf.mjs --scene abri --register playful --content --at 33 --quality low --throttle 4 --seconds 3 --rounds 1
```

`--at 33` is scene seconds; playful's pace is 1, so `u` is about 33. Warm runs the tray at 0.75, so its drift is at `--at 44`.
