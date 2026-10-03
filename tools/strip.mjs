// A contact sheet of a scene (or page) in motion: N evenly spaced frames on one PNG, each cell
// labelled with its time and how much of the picture changed since the cell before it.
//
//   node tools/strip.mjs <scene> -n 12 --from 0 --to 8 [options]
//   node tools/strip.mjs --url /packages/scenes/tinto/world.html?only=glass [options]
//
//   -n N, --n N          how many frames (default 12), both ends included
//   --from S --to S      the span in seconds of the scene's clock (default 0 to 8)
//   --facts              print where motion happens, and flag frozen spans and jumps (see below)
//   --json               print JSON only: per cell its time, mean luminance, changed-pixel share and
//                        box against the cell before; with --facts, the facts too
//   --real               use the real clock instead of the frozen one (a page by --url always does)
//   --still S            seconds of no change, while playing, that count as frozen (default 1.5)
//   --threshold D        per-pixel colour distance, 0..1, above which a pixel counts as changed (0.02)
//   --cols N --cell-width PX   layout (default 4 columns for 12 cells, 320 px cells)
//   --frames             also save every frame as its own PNG beside the sheet
//   --out DIR            where to save (default .shots/strip)
//   target and view options as shot.mjs: --register --theme --palette --seed --param k=v --content
//   --width --height --dpr --reduced --selector --allow-errors
//
// A scene runs on the harness's frozen clock, played by hand a 1/60 s tick at a time, so the same
// seed gives the same frames byte for byte, and a frame at 40 s costs the time to draw it, not 40 s
// of waiting. The header says which clock a sheet used. The clock is the scene's own, counted from
// when it mounted; a cell before the scene's sg-ready shows the first moment it can be seen, and
// says so.
//
// --facts is sampled at the strip's spacing. A frozen span is a run of cells with no change while
// the scene's `playing` is true; the same run while it is not playing is listed as at rest. A jump
// is a step that changes far more than the steps round it, the usual sign of a stage cut or a pop.
// A freeze or jump shorter than one step can hide between two cells: raise -n to look closer.

import { run } from './lib/motion-cli.mjs';

process.exit(await run('strip', process.argv.slice(2)));
