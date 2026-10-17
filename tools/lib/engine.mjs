// Which Playwright engine a check runs in. Chromium is the default everywhere
// (npm run check, and every *.check.mjs run by hand); WebKit and Firefox are
// opt-in through SG_ENGINE, so `npm run check` and the CI workflow can each
// run the whole suite three times without any check file knowing the
// difference.
//
//   node packages/components/loader/loader.check.mjs            (chromium)
//   SG_ENGINE=webkit node packages/components/loader/loader.check.mjs
//   node tools/checks.mjs --engine=firefox                       (every check)
//
// Browsers for the other two engines are not installed by default:
// `npx playwright install webkit firefox`.

import { chromium, firefox, webkit } from 'playwright';

const ENGINES = { chromium, firefox, webkit };

function normalise(name) {
  const key = (name || 'chromium').trim().toLowerCase();
  if (!(key in ENGINES)) throw new Error(`Unknown engine "${name}". Use chromium, firefox or webkit.`);
  return key;
}

/** @param {string} [name] defaults to SG_ENGINE, then "chromium" */
export function pickEngine(name = process.env.SG_ENGINE) {
  return ENGINES[normalise(name)];
}

/** The current engine's name ("chromium", "firefox" or "webkit"), never the browser object. */
export function engineName(name = process.env.SG_ENGINE) {
  return normalise(name);
}

export const ENGINE_NAMES = Object.keys(ENGINES);

// Named permission grants (browserContext.newContext's `permissions` option)
// that only Chromium's CDP-backed implementation recognises. Firefox and
// WebKit throw "Unknown permission" for either of these -- confirmed against
// real WebKit 26.6 and Firefox 155 (2026-09-28), not a guess. Grow this set
// only once an engine is confirmed to reject a given permission.
const CHROMIUM_ONLY_PERMISSIONS = new Set(['clipboard-read', 'clipboard-write']);

// Context options a real run showed one engine rejects. isMobile: Playwright's
// own docs say it "isn't supported in Firefox" (confirmed: newContext throws).
const UNSUPPORTED_CONTEXT_OPTIONS = { firefox: new Set(['isMobile']) };

/**
 * A browserContext.newContext() options object, safe for `engine`: strips
 * permissions only Chromium understands and context options an engine is
 * known to reject, rather than letting newContext() throw before a check
 * gets to run a single assertion.
 * @param {string} engine engineName()'s return value
 * @param {object} opts the options you would pass Chromium
 */
export function contextOptions(engine, opts = {}) {
  const out = { ...opts };
  if (out.permissions) {
    const kept = engine === 'chromium' ? out.permissions : out.permissions.filter(p => !CHROMIUM_ONLY_PERMISSIONS.has(p));
    if (kept.length) out.permissions = kept; else delete out.permissions;
  }
  for (const key of UNSUPPORTED_CONTEXT_OPTIONS[engine] ?? []) delete out[key];
  return out;
}

/**
 * Launch args, safe for `engine`. Every flag a check passes here is a Chromium switch (the GPU
 * ones above all: --use-angle=d3d11 and friends), and WebKit refuses to start on one it does not
 * know ("Cannot parse arguments: Unknown option --use-angle=d3d11"), so Firefox and WebKit get none.
 * @param {string} engine engineName()'s return value
 * @param {string[]} args the args you would pass Chromium
 */
export function launchArgs(engine, args = []) {
  return engine === 'chromium' ? args : [];
}

/**
 * The environment to launch a browser with, so its own interface locale is the one the check says it is
 * testing. `locale: 'en-IN'` on a context only changes what pages are told (navigator.language, Intl);
 * the order of a native date field's day and month comes from the browser's process locale, which on a
 * Linux runner is C or en_US, so typing 04102026 into a date field reads 4 October on a machine set to
 * India and 10 April on a runner (confirmed on Chromium and Firefox in WSL Ubuntu, 12 October 2026).
 * LC_ALL is read by both, with no locale files installed. Use: `pickEngine().launch({ env: localeEnv() })`.
 * @param {string} [posix] a POSIX locale name, en_IN by default
 */
export function localeEnv(posix = 'en_IN') {
  return { ...process.env, LC_ALL: posix };
}

/** Can `engine` grant this permission at all? For a check that must skip an assertion, not just proceed without it. */
export function grantsPermission(engine, permission) {
  return engine === 'chromium' || !CHROMIUM_ONLY_PERMISSIONS.has(permission);
}

/**
 * A check that depends on something only some engines provide (a codec, an
 * API surface) calls this instead of silently passing: prints one line
 * naming what was skipped and why. Never counted as a pass or a fail, so
 * the run's totals stay honest about what was actually measured.
 */
export function unsupportedIn(engine, thing, reason) {
  console.log(`skip  ${thing} is not measurable in ${engine}${reason ? `  (${reason})` : ''}`);
  return true;
}

// "ResizeObserver loop completed with undelivered notifications." is the
// spec's own safety-valve notice (ResizeObserver §13.4), fired whenever a
// page's observers can't all be delivered inside one frame -- routine on any
// page with several ResizeObservers and a big reflow, such as a viewport
// resize to phone width, and not a sign anything looped forever. Verified
// directly (2026-09-28): the exact same page, at the exact same viewport,
// produces no console message of any kind in Chromium and a real `pageerror`
// in WebKit -- an engine reporting-channel difference, not a page bug.
const BENIGN_PAGE_ERRORS = [/^ResizeObserver loop completed with undelivered notifications\.$/];

/** Drop only known-benign, engine-specific notices from a collected error list; everything else stays. */
export function dropBenignErrors(errors) {
  return errors.filter(e => !BENIGN_PAGE_ERRORS.some(re => re.test(e)));
}

/**
 * Does a page in this browser have something? `expression` is JavaScript that is true when it does
 * (`typeof AudioContext === 'function'`), asked of a blank page in a context of its own. A check whose
 * assertions would pass for want of the thing (no AudioContext, so "no context was made before the
 * gesture" is trivially true) asks first and calls `unsupportedIn` for the whole group, so a gate that
 * did not run is not counted as one that passed.
 */
export async function pageHas(browser, expression) {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.setContent('<!doctype html><title>probe</title>');
    return await page.evaluate(`(() => { try { return !!(${expression}); } catch { return false; } })()`);
  } finally {
    await ctx.close();
  }
}

const keyActive = new WeakMap();
/**
 * Does holding Space on a focused button put it in `:active` in this engine? Asked of a bare page with one button and one
 * `:active` rule, read from the computed style (not `matches(':active')`, which says false in every engine here).
 * Playwright's Firefox answers no: the button stays at rest while Space is held, though a mouse press styles it. A check
 * that wants "the keyboard press is styled, and nothing moves" asks first and, where the engine does not, asks only the part it can.
 */
export async function keyHeldActivates(browser) {
  if (!keyActive.has(browser)) {
    keyActive.set(browser, (async () => {
      const ctx = await browser.newContext();
      try {
        const page = await ctx.newPage();
        await page.setContent('<!doctype html><title>probe</title><style>button:active { outline: 7px solid rgb(1, 2, 3); }</style><button>b</button>');
        await page.focus('button');
        await page.keyboard.down('Space');
        const lit = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(getComputedStyle(document.querySelector('button')).outlineWidth === '7px')))));
        await page.keyboard.up('Space');
        return lit;
      } finally { await ctx.close(); }
    })());
  }
  return keyActive.get(browser);
}

const clickFocus = new WeakMap();
/**
 * Does a mouse click give a button keyboard focus in this engine? Safari's long-standing answer is no (WebKit leaves focus where it
 * was), so after a click "focus returns to / stays on the button" has nothing to return to. Asked of a bare page with one button.
 * A check that wants to know where focus goes asks this first, and in an engine that says no asks the same question from the keyboard
 * (focus the button, press Enter), which is how a person who then reaches for the keyboard gets there.
 */
export async function clickFocusesButtons(browser) {
  if (!clickFocus.has(browser)) {
    clickFocus.set(browser, (async () => {
      const ctx = await browser.newContext();
      try {
        const page = await ctx.newPage();
        await page.setContent('<!doctype html><title>probe</title><button>b</button>');
        await page.click('button');
        return await page.evaluate(() => document.activeElement?.localName === 'button');
      } finally { await ctx.close(); }
    })());
  }
  return clickFocus.get(browser);
}
