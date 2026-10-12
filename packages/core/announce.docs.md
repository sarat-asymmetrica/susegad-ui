# Announce

`announce(text, { priority, from })` says one sentence to a screen reader and does nothing else. Use it for a change that a sighted person sees happen, such as a total going from "2 people, ₹3,000" to "3 people, ₹4,500". The sentence should also be on the page as text; announcing is never the only way to know.

```js
import { announce } from 'susegad/core/announce.js';
import { rupees } from 'susegad/core/intl.core.js';

announce(`${n} people, ${rupees(n * price)}`, { from: plusButton });
announce('That slot was just taken. Pick another.', { priority: 'assertive' });
```

## How it speaks

- Where the browser has `ariaNotify()`, the sentence goes to `from.ariaNotify()` if you passed an element that has it, else `document.ariaNotify()`. Polite is `normal` priority and assertive is `high`. No hidden element is made.
- Everywhere else, one live region speaks it. It is created the first time you announce, kept visually hidden (1 px, clipped, set through the CSSOM so a strict style CSP is happy) and reused. Polite uses `role="status"`. An assertive region (`role="alert"`) is made only the first time someone asks for one.
- If `from` sits inside an open modal dialog (even through a shadow root), the fallback region is made inside that dialog, because the rest of the page is inert while it is open. With no `from`, an open modal dialog still gets the region. The region is emptied five seconds after it speaks, so it is never stray text.

## A burst is read once

Presses are collected for 250 ms after the last one, so three presses in a second say the last total once. Nothing waits longer than a second, so someone holding the button still hears the total now and then. Polite sentences replace each other. An assertive sentence is never replaced by a polite one, and goes first. The same polite sentence twice within two seconds is said once; an assertive sentence always speaks, so a retry that fails again is heard again. `flushAnnouncements()` says what is waiting now, for a page that is about to move on.

The choice of path and the coalescing are pure, in `announce.core.js`: `pickPath`, `notifyPriority` and `createCoalescer`, tested in Node with a hand-driven clock.

## What the check hears

`announce.check.mjs` replaces `ariaNotify` with a recorder for one run, removes it for another, and watches the region's text with a mutation observer. Three quick presses on the demo's + button produce exactly one spoken sentence, "5 people, ₹7,500", on either path. Run it with `SG_ENGINE=webkit` or `SG_ENGINE=firefox` as well. `--break` swaps `announce()` for a no-op and the listening checks must go red.
