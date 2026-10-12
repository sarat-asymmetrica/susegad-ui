// Playful: the same hand-ruled frame, a little livelier, with block-print studs
// on the corners and the middle of each side. The frame draws itself on once
// when it is first seen; reduced motion shows it finished. The modules are
// exactly the quiet ones.

import { framed } from './warm.js';

export const mount = (host, ctx) => framed(host, ctx, { ornament: true, draw: true });
