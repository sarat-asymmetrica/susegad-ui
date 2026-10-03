// The frames of a movement blended onto one PNG, older frames fainter, so its path and its easing
// show in a single image: evenly spaced ghosts are constant speed, ghosts crowding at one end are an ease.
//
//   node tools/onion.mjs <scene> --from 2 --to 6 -n 6 [options]
//
//   -n N, --n N          how many frames (default 6, at least 2), both ends included
//   --from S --to S      the span in seconds of the scene's clock (default 0 to 8)
//   --diff               show only the pixels that change: each step's changed pixels in vermilion
//                        over a faded last frame, older steps fainter
//   --json, --facts, --real, --threshold, --frames, --out (default .shots/onion), and the target
//   and view options: exactly as tools/strip.mjs, which explains the clock
//
// The blend keeps the scene's still background exact (the per-pixel median of the frames) and lays
// each frame's moving pixels over it, oldest first, at rising opacity. Where a thing moves through
// most of the frames the median is the thing itself, so for a picture that changes everywhere (a
// growing tree, a season) use a strip to read the order, and --diff to see where it changes: newer
// steps paint over older ones, and the older show as a paler rim.

import { run } from './lib/motion-cli.mjs';

process.exit(await run('onion', process.argv.slice(2)));
