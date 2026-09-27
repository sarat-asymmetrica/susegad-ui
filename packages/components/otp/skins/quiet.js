// Quiet: plain boxes with a hairline, the digit set in the body face, and a
// caret in the current box. Digits appear; nothing lands.

import { boxes } from './boxes.js';

export const mount = (host, ctx) => boxes(host, ctx);
