// What a tool points at: a scene through the harness, or any page by path.
// Pure; tested in target.test.mjs.

export const REGISTERS = ['quiet', 'warm', 'playful'];
export const THEMES = ['light', 'dark'];

/** Scenes that live in tools/fixtures rather than packages/scenes. */
export const FIXTURES = {
  fixture: { module: '/tools/fixtures/fixture-scene/index.js', element: 'sg-fixture-scene' },
};

/**
 * Git Bash on Windows rewrites an argument that starts with "/" into a Windows path, so
 * `--url /packages/x/demo.html` arrives as `C:/Program Files/Git/packages/x/demo.html`, the
 * server answers 404, and axe and the matrix judge an empty error page (this cost a review
 * on 25 Sep 2026). Take the rewrite back off; refuse any other drive path plainly.
 * @param {string} url
 */
export function unmangleUrl(url) {
  if (!/^[A-Za-z]:[\\/]/.test(url)) return url;
  const m = url.replace(/\\/g, '/').match(/^[A-Za-z]:\/(?:.*?\/)?Git(?:\/usr)?(\/.*)$/i);
  if (m) return m[1];
  throw new Error(`--url must be a path inside the repo, like /packages/x/demo.html, not a drive path (${url}). In Git Bash, set MSYS_NO_PATHCONV=1 or leave off the leading slash.`);
}

/**
 * Build the path (no origin) a tool should open.
 * @param {{ scene?: string, url?: string, register?: string, theme?: string, palette?: string,
 *   seed?: string|number, params?: Record<string, string>, content?: boolean, freeze?: number|string }} t
 */
export function targetPath(t) {
  if (!!t.scene === !!t.url) throw new Error('give exactly one of --scene <name> or --url <path>');
  if (t.scene && t.noJs) throw new Error('--no-js needs a page (--url); a scene cannot run without JavaScript');
  if (t.register && !REGISTERS.includes(t.register)) throw new Error(`register must be one of ${REGISTERS.join(', ')}`);
  if (t.theme && !THEMES.includes(t.theme)) throw new Error(`theme must be one of ${THEMES.join(', ')}`);
  if (t.url) {
    const url = unmangleUrl(t.url);
    // register, theme and palette ride along as query params, which pages built on
    // tools/harness/demo.js read before first paint; other pages ignore them.
    const u = new URL(url.startsWith('/') ? url : '/' + url, 'http://x');
    for (const k of ['register', 'theme', 'palette']) if (t[k]) u.searchParams.set(k, t[k]);
    return u.pathname + u.search + u.hash;
  }
  if (!/^[a-z0-9-]+$/.test(t.scene)) throw new Error(`bad scene name "${t.scene}"`);
  const q = new URLSearchParams();
  q.set('name', t.scene);
  const fx = FIXTURES[t.scene];
  if (fx) { q.set('module', fx.module); q.set('element', fx.element); }
  if (t.register) q.set('register', t.register);
  if (t.theme) q.set('theme', t.theme);
  if (t.palette) q.set('palette', t.palette);
  if (t.seed !== undefined && t.seed !== '') q.set('seed', String(t.seed));
  if (t.content) q.set('content', '1');
  if (t.freeze !== undefined && t.freeze !== '') q.set('freeze', String(t.freeze));
  for (const [k, v] of Object.entries(t.params || {})) q.set(k, v);
  return `/tools/harness/scene.html?${q}`;
}

/** A filesystem-safe name for a target: "kolam" or "apps-docs-index". */
export function targetSlug(t) {
  if (t.scene) return t.scene;
  return t.url.replace(/^\/+/, '').replace(/\?.*$/, '').replace(/\.html?$/, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'root';
}

/** Target options shared by every tool's argument spec. */
export const TARGET_SPEC = {
  scene: 'string', url: 'string', register: 'string', theme: 'string', palette: 'string',
  seed: 'string', param: 'kv', content: 'bool', 'no-js': 'bool',
};

/** Pull the target fields out of parsed opts (the positional name counts as --scene). */
export function targetFrom(opts, positional = []) {
  const scene = opts.scene ?? (opts.url ? undefined : positional[0]);
  if (scene && opts['no-js']) throw new Error('--no-js needs a page (--url); a scene cannot run without JavaScript');
  return {
    scene, url: opts.url && unmangleUrl(opts.url), register: opts.register, theme: opts.theme, palette: opts.palette,
    seed: opts.seed, params: opts.param || {}, content: !!opts.content, noJs: !!opts['no-js'],
  };
}
