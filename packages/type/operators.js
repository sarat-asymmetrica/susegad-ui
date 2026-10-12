// The named operators for the live tier (decision 0029): the lazy door a scene
// or component opens when it needs one, so index.js does not carry them.
//
//   const ops = await import('../../type/operators.js');
//   const got = ops.fit(text, shape, { family, minPx, maxPx, top, bottom });
//
// fit, clampLines, predictHeight and layZones (text zones, layout.zones.js) are bound to the default Pretext layout
// (the same prepared-text cache as index.js); pack, place and distribute are
// pure. layout.operators.js is the pure core with the real code; this file
// reaches measure.js through index.js, so cores never import it (a guard in
// boundary.test.js).

import * as layout from './index.js';
import { fit as fitOp, clampLines as clampOp, predictHeight as predictOp } from './layout.operators.js';
import { layZones as layZonesOp } from './layout.zones.js';

export { pack, place, distribute } from './layout.operators.js';
export const fit = (text, shape, opts) => fitOp(layout, text, shape, opts);
export const clampLines = (lines, n, opts) => clampOp(layout, lines, n, opts);
export const layZones = (zones, texts, opts) => layZonesOp(layout, zones, texts, opts);
export const predictHeight = (text, font, width, lineHeight) => predictOp(layout, text, font, width, lineHeight);
