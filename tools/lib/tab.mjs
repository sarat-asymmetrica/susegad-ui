// Tab, as far as the engine can press it.
//
// WebKit's default leaves links out of the tab order (Safari reaches them with Option+Tab, and Playwright's
// Alt+Tab does not do that: docs/BROWSERS.md, action-menu). A check that presses Tab to reach a link
// therefore finds nothing in WebKit, and a walk that expects links in it never sees them. These helpers
// keep the question the check asks and change only how the engine is asked:
//
//   tab(page)                  one Tab press. Where links are tab stops, exactly page.keyboard.press('Tab').
//                              Where they are not, and the next stop (by the HTML sequential-focus order,
//                              read from the DOM) is a link, focus that link instead: Option+Tab's job.
//                              Where the next stop is not a link, a real Tab is pressed AND must land on
//                              the stop the DOM order promised, or this throws. So the stand-in is held
//                              to the engine's own Tab for everything else.
//   tabTo(page, sel, max)      Tab until the focused element matches `sel`: the press count, or 0.
//   tabWalk(page, n, read)     the n elements Tab visits in turn, read through `read(element)`.
//   tabsToLinks(browser)       the engine's answer, asked once of a scratch page of its own.
//
// A stand-in is printed once per process as a `skip` line (unsupportedIn), never silently. A target that
// is not a tab stop (tabindex="-1", no href, hidden, disabled) is never reached by either route, so a
// probe built on these still reads red against a broken control: tools/lib/tab.check.mjs shows it.

import { engineName, unsupportedIn } from './engine.mjs';

const answers = new WeakMap();

/** Does Tab stop at links in this engine? Asked of a scratch page: Tab moves the sequential-focus point, so it must not be a page under test. */
export async function tabsToLinks(browser) {
  if (!answers.has(browser)) {
    answers.set(browser, (async () => {
      const ctx = await browser.newContext();
      const probe = await ctx.newPage();
      await probe.setContent('<a href="#x">x</a><button>b</button>');
      await probe.keyboard.press('Tab');
      const yes = await probe.evaluate(() => document.activeElement.localName === 'a');
      await ctx.close();
      return yes;
    })());
  }
  return answers.get(browser);
}

let said = false;
function saySubstitution() {
  if (said) return;
  said = true;
  unsupportedIn(engineName(), 'Tab to a link', 'links are not tab stops in this engine by default (Safari: Option+Tab), so a link is focused where Tab would arrive and every other stop is still pressed with a real Tab');
}

// Runs in the page. The tab stops in sequential-focus order, the focused one's place among them, and
// (when asked) focus on the link that is next. Not modelled: shadow roots, iframes, modal dialogs; the
// pages a walk crosses use none of them, and tab() throws if the real Tab disagrees with this order.
function inPage({ focusNextLink }) {
  const sel = 'a[href], area[href], button, input, select, textarea, summary, [tabindex], [contenteditable]:not([contenteditable="false"]), audio[controls], video[controls]';
  const live = e => e.tabIndex >= 0 && !e.disabled && !e.closest('[inert]') && !(e.localName === 'input' && e.type === 'hidden')
    && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const cand = [...document.querySelectorAll(sel)].filter(live);
  const group = new Map(); // one stop per radio group: the checked radio, else the first
  const all = cand.filter(e => {
    if (!(e.localName === 'input' && e.type === 'radio' && e.name)) return true;
    const key = `${e.name}|${e.form ? [...document.forms].indexOf(e.form) : -1}`;
    if (!group.has(key)) { const g = cand.filter(r => r.type === 'radio' && r.name === e.name && r.form === e.form); group.set(key, g.find(r => r.checked) ?? g[0]); }
    return group.get(key) === e;
  });
  const stops = [...all.filter(e => e.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex), ...all.filter(e => e.tabIndex === 0)];
  const here = stops.indexOf(document.activeElement); // -1 on the body: the first stop is next
  // Not predicted: the page scrolled with nothing focused (the engine starts Tab from where it was scrolled to), or focus on something that
  // is not a stop (a tabindex=-1 element: the engine starts from where it sits in the document, which the stop list does not hold).
  const el = document.activeElement, atRest = !el || el === document.body || el === document.documentElement;
  const unknownStart = here === -1 && (window.scrollY !== 0 || !atRest);
  const next = unknownStart ? undefined : stops[here + 1];
  const isLink = e => !!e && e.matches('a[href], area[href]');
  if (focusNextLink && isLink(next)) next.focus();
  const name = e => !e ? null : (e.id ? `#${e.id}` : e.localName) + (e.getAttribute('href') ? `[${e.getAttribute('href')}]` : '');
  const multi = e => !!e && e.localName === 'input' && ['date', 'time', 'datetime-local', 'month', 'week'].includes(e.type); // one element, several stops inside it
  return { here, nextIsLink: isLink(next), next: name(next), count: stops.length, focused: focusNextLink && isLink(next), unknownStart, inside: multi(document.activeElement) };
}

/** One Tab press, as far as the engine can press it. Resolves 'tab', or 'focus' when a link was focused in Tab's place. */
export async function tab(page) {
  const browser = page.context().browser();
  if (!browser || await tabsToLinks(browser)) { await page.keyboard.press('Tab'); return 'tab'; }
  const plan = await page.evaluate(inPage, { focusNextLink: true });
  if (plan.focused) { saySubstitution(); return 'focus'; }
  await page.keyboard.press('Tab');
  if (plan.next === null || plan.unknownStart) return 'tab'; // past the last stop, or a start the DOM cannot place: the engine's own Tab is the answer
  const landed = await page.evaluate(inPage, { focusNextLink: false });
  const stayedInside = landed.here === plan.here && landed.inside; // a date field's own day, month and year take a Tab each
  if (landed.here !== plan.here + 1 && !stayedInside) throw new Error(`tab(): the DOM order promised ${plan.next} after stop ${plan.here}, but a real Tab landed on stop ${landed.here}`);
  return 'tab';
}

/** Tab until the focused element matches `sel`. The number of presses, or 0 if it was not reached within `max`. */
export async function tabTo(page, sel, max = 12) {
  for (let i = 0; i < max; i++) {
    await tab(page);
    if (await page.evaluate(s => document.activeElement?.matches(s), sel)) return i + 1;
  }
  return 0;
}

/** The elements Tab visits in turn, `n` of them, each read through `read(element)` (a function with no closure). */
export async function tabWalk(page, n, read) {
  const out = [];
  for (let i = 0; i < n; i++) {
    await tab(page);
    const focused = await page.evaluateHandle(() => document.activeElement);
    out.push(await focused.evaluate(read));
    await focused.dispose();
  }
  return out;
}
