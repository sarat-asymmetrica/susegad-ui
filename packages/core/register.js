// The register: quiet, warm or playful. Set on :root or any element with
// `data-register`; a `register` attribute on an element beats its ancestors.
// Reduced motion always wins over the register; Save-Data and low-power
// devices step down one register.
//
// Pure resolution first (runs in Node), then the DOM edge.

export const REGISTERS = ['quiet', 'warm', 'playful'];
export const DEFAULT_REGISTER = 'warm';
const ATTRS = ['register', 'data-register'];

/** @param {unknown} v @returns {'quiet'|'warm'|'playful'|null} */
export const normalizeRegister = v => {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return REGISTERS.includes(s) ? /** @type {any} */ (s) : null;
};

/** One register quieter: playful → warm → quiet → quiet. */
export const stepDown = r => REGISTERS[Math.max(0, REGISTERS.indexOf(r) - 1)] || 'quiet';

/** Pure resolution. `ancestors` are nearest first; invalid values are skipped. */
export function resolveRegister({ own = null, ancestors = [], reducedMotion = false, saveData = false, lowPower = false } = {}) {
  let declared = DEFAULT_REGISTER;
  for (const v of [own, ...ancestors]) { const r = normalizeRegister(v); if (r) { declared = r; break; } }
  const register = saveData || lowPower ? stepDown(declared) : declared;
  return { declared, register, reducedMotion: !!reducedMotion, saveData: !!saveData };
}

/** How much a piece may move: 'still' | 'state' | 'ambient' | 'full'. Components in quiet get 'state' (transitions under 200ms); scenes get 'still'. */
export function resolveMotion(register, { reducedMotion = false, forScene = true } = {}) {
  if (reducedMotion) return 'still';
  if (register === 'quiet') return forScene ? 'still' : 'state';
  return register === 'playful' ? 'full' : 'ambient';
}

// ── DOM edge ──────────────────────────────────────────────────────────────

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
const mq = q => (hasDOM && window.matchMedia ? window.matchMedia(q) : null);
const reducedMQ = mq('(prefers-reduced-motion: reduce)');
const conn = () => (hasDOM ? navigator.connection : null);
const env = () => ({
  reducedMotion: !!reducedMQ?.matches,
  saveData: !!conn()?.saveData,
  lowPower: hasDOM && (navigator.deviceMemory ?? 8) <= 1,
});

const own = el => el.getAttribute?.('register') ?? el.getAttribute?.('data-register') ?? null;
/** Walk up through shadow roots to the document, nearest first. */
function chain(el) {
  const out = [];
  for (let n = el; n; ) {
    const p = n.parentNode;
    n = p && p.nodeType === 11 ? p.host : p; // 11: a shadow root (or fragment)
    if (n && n.nodeType === 1) out.push(n);
  }
  return out;
}
const snapshot = el => resolveRegister({ own: own(el), ancestors: chain(el).map(own), ...env() });

/** The element's effective register, after Save-Data. */
export const readRegister = el => snapshot(el).register;

export function effectiveMotion(el, { forScene = true } = {}) {
  const s = snapshot(el);
  return resolveMotion(s.register, { reducedMotion: s.reducedMotion, forScene });
}

// One shared observer for every subscriber: register attributes anywhere in
// the element's root chain, the theme, reduced motion and Save-Data.
const subs = new Set();
let mo = null;
const observed = new WeakSet();
const key = s => `${s.register}|${s.reducedMotion}|${s.saveData}|${s.theme}`;
const theme = () => (hasDOM ? `${document.documentElement.getAttribute('data-theme') || ''}${mq('(prefers-color-scheme: dark)')?.matches ? 'D' : 'L'}` : '');
/** Everything a scene needs at once: { register, declared, motion, reducedMotion, saveData, theme }. */
export function registerState(el) { const s = snapshot(el); return { ...s, theme: theme(), motion: resolveMotion(s.register, { reducedMotion: s.reducedMotion }) }; }
const state = registerState;
function check() {
  for (const sub of subs) {
    sub.watchRoots();
    const s = state(sub.el), k = key(s);
    if (k !== sub.last) { sub.last = k; sub.cb(s); }
  }
}
function start() {
  mo = new MutationObserver(check);
  reducedMQ?.addEventListener('change', check);
  mq('(prefers-color-scheme: dark)')?.addEventListener('change', check);
  conn()?.addEventListener?.('change', check);
}

/** cb(registerState(el)) whenever the effective register, motion or theme changes, ancestors included. Returns an unsubscribe. */
export function observeRegister(el, cb) {
  if (!hasDOM) return () => {};
  if (!mo) start();
  const sub = {
    el, cb, last: key(state(el)),
    watchRoots() {
      for (let root = el.getRootNode(); root; root = root.host?.getRootNode()) {
        const target = root.nodeType === 9 ? root.documentElement : root;
        if (target && !observed.has(target)) {
          observed.add(target);
          mo.observe(target, { attributes: true, subtree: true, attributeFilter: [...ATTRS, 'data-theme'] });
        }
        if (root.nodeType === 9) break;
      }
    },
  };
  sub.watchRoots();
  subs.add(sub);
  return () => subs.delete(sub);
}
