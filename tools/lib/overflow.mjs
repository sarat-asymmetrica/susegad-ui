// How far a page scrolls sideways, measured against an honest yardstick.
//
// Not window.innerWidth: in a Playwright context with isMobile: true, Chromium widens innerWidth
// to fit overflowing content (a 700 px child on a 390 px phone reads innerWidth 700), so
// `scrollWidth <= innerWidth` passes whatever the page does. And not documentElement.clientWidth
// alone either: a page with no `width=device-width` meta viewport gets a 980 px layout viewport
// on a phone, and clientWidth follows it.
//
// The yardstick when the caller says the width it set: min(width, clientWidth), so a classic
// scrollbar takes its share. When it does not: clientWidth on a page with no touch, and
// min(clientWidth, screen.width) on a touch page (screen.width stays at the phone's own width;
// on desktop Firefox it is the real monitor, 1366, which would false-red a fitting 1440 page).
//
// Clipping is not fitting. overflow-x: hidden (or clip) on html and body together hides a wide
// child from documentElement.scrollWidth, and for WCAG 1.4.10 content the page clips is content
// the person has lost. So when html or body clips, the width is the larger of the two
// scrollWidths, `overflow` counts it, and `clipped` says it came through a clip. A check that
// really means to clip (a decorative bleed, say) passes { allowClipped: 'the reason' } and the
// clipped part is left out.
//
// What 0 does NOT say: content that is position: fixed past the edge does not scroll the page, so
// it reads 0 and is still out of reach. Look for it with the element list in tools/viewport-sweep.mjs.

/**
 * Runs in the page.
 * @param {{ width?: number, allowClipped?: string }} [opts]
 * @returns {{ scrollWidth: number, viewWidth: number, overflow: number, clipped: boolean, metaViewport: boolean }}
 *   overflow in px, never negative; clipped is true when a clip on html or body hides width
 *   beyond the view; metaViewport is whether the page declares width=device-width (without it
 *   a phone lays the page out at 980 px, which is itself a phone bug)
 */
export function measureOverflow(opts = {}) {
  const de = document.documentElement, body = document.body;
  const touch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const viewWidth = opts.width ? Math.min(opts.width, de.clientWidth) : (touch ? Math.min(de.clientWidth, screen.width) : de.clientWidth);
  const clips = el => /^(hidden|clip)$/.test(getComputedStyle(el).overflowX);
  const clipping = clips(de) || clips(body);
  const seen = de.scrollWidth;
  const behind = clipping && body ? body.scrollWidth : 0;
  const scrollWidth = opts.allowClipped ? seen : Math.max(seen, behind);
  const meta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
  return {
    scrollWidth, viewWidth, overflow: Math.max(0, scrollWidth - viewWidth),
    clipped: !opts.allowClipped && clipping && behind > viewWidth,
    metaViewport: /width\s*=\s*device-width/i.test(meta),
  };
}

/**
 * @param {import('playwright').Page} page
 * @param {number} [width] the viewport width the check set; leave out to measure the page's own view
 * @param {{ allowClipped?: string }} [opts] allowClipped: why this page may clip (a reason, not a flag)
 */
export function sidewaysScroll(page, width, opts = {}) {
  if (opts.allowClipped !== undefined && !String(opts.allowClipped).trim()) throw new Error('sidewaysScroll: allowClipped needs a reason');
  return page.evaluate(measureOverflow, { width, allowClipped: opts.allowClipped });
}
