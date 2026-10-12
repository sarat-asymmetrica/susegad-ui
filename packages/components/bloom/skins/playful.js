// Playful: the zendu grows from the heart outward, and a press gives the outer ring a small shiver.
import { mountHead } from './head.js';

export const mount = (host, ctx) => mountHead(host, ctx, { mode: 'zendu', grow: true, shiver: true });
