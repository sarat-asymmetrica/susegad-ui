// Warm: the zendu in its own colours, lit from the upper left. Still.
import { mountHead } from './head.js';

export const mount = (host, ctx) => mountHead(host, ctx, { mode: 'zendu', grow: false });
