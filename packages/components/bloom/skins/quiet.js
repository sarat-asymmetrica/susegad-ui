// Quiet: a single-ink head, florets as dots in the text colour on the paper. Still.
import { mountHead } from './head.js';

export const mount = (host, ctx) => mountHead(host, ctx, { mode: 'dots', grow: false });
