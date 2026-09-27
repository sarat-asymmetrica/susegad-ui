// Warm: a pencilled signing line with a small cross, and ink with a body.
// The pen's pressure and speed set the width; fresh ink is glossy and dark,
// then dries into the paper's grain over a second and a half.

import { painter } from './paint.js';

export const mount = (host, ctx) => painter(host, ctx, { grain: 0.5, dry: true, line: 'pencil', flourish: false });
