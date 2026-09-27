// Playful: the letter drops in with a thunk. The box gives a little as it
// lands, and three short marks say so. Only when files are really kept.

import { mountPost } from './post.js';

export const mount = (host, ctx) => mountPost(host, ctx, { thunk: true });
