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
