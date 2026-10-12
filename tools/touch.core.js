// The microinteraction check's pure half (docs/contributing/touch-contract.md):
// which components are interactive, and what a component's own files say about
// a press state, a :focus-visible style and a reduced-motion still. No file or
// browser access here, so it runs and is tested in Node (touch.core.test.mjs).
// tools/touch.check.mjs reads the files, calls this, and then proves the press
// state in a browser, because a static scan can be fooled by a rule that
// changes nothing.

/** Declarations that change how a thing looks or where it sits. `transition` alone does not count. */
const VISUAL = /^(translate|scale|rotate|transform|filter|opacity|color|fill|stroke|outline(-color|-width|-style)?|box-shadow|background(-color|-image)?|border(-[a-z]+)*|text-decoration(-color)?)$/;
const NOTHING = /^(none|unset|initial|inherit|revert)?$/;

/**
 * A small CSS reader: every style rule with its selector, declarations and the at-rules around it.
 * @param {string} css
 * @returns {{ selector: string, decls: [string, string][], at: string[] }[]}
 */
export function parseRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  const skipBlock = () => { let depth = 1; while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; } };
  const readBlock = at => {
    while (i < src.length) {
      let j = i;
      while (j < src.length && src[j] !== '{' && src[j] !== '}' && src[j] !== ';') j++;
      if (j >= src.length || src[j] === '}') { i = j + 1; return; }
      if (src[j] === ';') { i = j + 1; continue; } // @import, @charset
      const prelude = src.slice(i, j).trim();
      i = j + 1;
      if (prelude.startsWith('@')) {
        if (/^@(media|supports|layer|container|scope)/.test(prelude)) readBlock([...at, prelude]);
        else skipBlock(); // @keyframes, @font-face: not style rules
      } else {
        const start = i;
        let depth = 1;
        while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
        const body = src.slice(start, i - 1);
        const decls = body.split(';').map(d => d.trim()).filter(d => d && !d.includes('{')).map(d => {
          const k = d.indexOf(':');
          return k < 0 ? null : [d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()];
        }).filter(Boolean);
        out.push({ selector: prelude, decls, at });
      }
    }
  };
  readBlock([]);
  return out;
}

const splitSelectors = sel => {
  const parts = []; let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && !depth) { parts.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
};

/** A selector asks for the state itself, not for "not that state". */
const asks = (selector, pseudo) => splitSelectors(selector).some(s => s.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '').includes(pseudo));
const inReduce = r => r.at.some(a => /prefers-reduced-motion\s*:\s*reduce/.test(a));
const visual = r => r.decls.some(([k, v]) => (VISUAL.test(k) && !NOTHING.test(v)) || (k.startsWith('--') && v));

/**
 * What a component's CSS says about the three contract items.
 * @param {string} css the component's stylesheet(s), joined
 * @param {string} js the component's behaviour and skins, joined (source text)
 */
export function analyseCss(css, js = '') {
  const rules = parseRules(css);
  const press = rules.filter(r => asks(r.selector, ':active') && !inReduce(r));
  const pressVisual = press.filter(visual);
  const focus = rules.filter(r => asks(r.selector, ':focus-visible') && r.decls.some(([k]) => /^(outline|box-shadow|border|background|text-decoration)/.test(k)));
  const reducedCss = rules.some(inReduce) || /prefers-reduced-motion/.test(css);
  // A skin that reads ctx.motion is held still centrally (componentMotion, 'still' under reduced motion).
  const reducedJs = /\.motion\b|reducedMotion|prefers-reduced-motion/.test(js);
  const moves = rules.some(r => r.decls.some(([k]) => /^(transition|animation)/.test(k))) || /@keyframes/.test(css) || /\.animate\(|\banimate\(/.test(js);
  return {
    press: { rules: press.length, withVisual: pressVisual.length, selectors: pressVisual.map(r => r.selector) },
    focus: { rules: focus.length },
    reduced: { css: reducedCss, js: reducedJs, moves },
  };
}

/** The sentences a failure is made of, empty when the component keeps the contract. */
export function missing(a, { pressable = true } = {}) {
  const why = [];
  if (!pressable) { /* text entry only: focus is its press */ }
  else if (!a.press.rules) why.push('no :active rule (a press state)');
  else if (!a.press.withVisual) why.push('its :active rule changes nothing visible (no translate, scale, colour, border, shadow or fill)');
  if (!a.focus.rules) why.push('no :focus-visible style (an outline, ring or underline)');
  if (a.reduced.moves && !a.reduced.css && !a.reduced.js) why.push('moves, but has no reduced-motion handling (a prefers-reduced-motion block, or a skin that reads ctx.motion)');
  return why;
}

const CONTROLS = String.raw`button|input(?![^>]*type\s*=\s*["']?hidden)|select|textarea|summary|a\s[^>]*href|[a-z][\w-]*\s[^>]*tabindex|[a-z][\w-]*\s[^>]*role\s*=\s*["'](?:button|tab|switch|radio|checkbox|option|link|menuitem)["']`;

/**
 * Is a component interactive, from its demo markup and its scripts? A button in a demo's
 * own controls does not count: only what sits inside the component's tag, what its scripts
 * create, and a tabindex it sets on itself.
 * @param {string} tag e.g. "sg-tabs"
 * @param {string} demoHtml
 * @param {string} js behaviour and skins, joined
 * @returns {{ reasons: string[], pressable: boolean }} why it is interactive (empty: it is not), and whether
 *   any of it is pressed rather than typed into (a code or text field has no press: focus is its press)
 */
export function interactiveReasons(tag, demoHtml, js) {
  const reasons = [];
  let pressable = false;
  const esc = tag.replace(/-/g, '\\-');
  const inner = new RegExp(`<${esc}\\b[^>]*>([\\s\\S]*?)</${esc}>`, 'g');
  const found = new Set();
  for (const m of demoHtml.matchAll(inner)) {
    for (const hit of m[1].matchAll(new RegExp(`<(${CONTROLS})[^>]*`, 'gi'))) {
      found.add(hit[1].split(/s/)[0].toLowerCase());
      const type = hit[0].match(/types*=s*["']?([a-z-]+)/i)?.[1]?.toLowerCase();
      if (!/^input/i.test(hit[1]) || /^(checkbox|radio|button|submit|reset|file|range|image)$/.test(type ?? '')) pressable = true;
    }
  }
  if (found.size) reasons.push(`its demo markup holds ${[...found].join(', ')}`);
  const made = new Set();
  // createElement('button'), and the small builders a component keeps for itself: mk('button', …), h('a', …)
  for (const m of js.matchAll(/\b(?:createElement|createElementNS|mk|h|el|make|html|node|tag)\(\s*(?:[^,()'"]*,\s*)?['"](button|a|input|select|summary|textarea)['"]/g)) made.add(m[1]);
  for (const m of js.matchAll(/<(button|summary|select|textarea)\b/g)) made.add(m[1]);
  if (made.size) { reasons.push(`its scripts make ${[...made].join(', ')}`); if ([...made].some(t => t !== 'input')) pressable = true; }
  if (/setAttribute\(\s*['"]tabindex['"]|\.tabIndex\s*=/.test(js)) reasons.push('its scripts set a tabindex');
  return { reasons, pressable };
}

/** The properties a press, or a focus, may change on an element. */
export const WATCHED = ['translate', 'scale', 'transform', 'filter', 'opacity', 'color', 'background-color', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'box-shadow', 'outline-style', 'outline-width', 'outline-color', 'fill', 'stroke', 'text-decoration-color', 'text-decoration-line'];
const MOVEMENT = new Set(['translate', 'scale', 'transform']);

/**
 * Compare two style snapshots ({ node: { prop: value } }) and say what changed.
 * @returns {{ changed: string[], moved: string[] }} "node prop" entries; moved is the movement subset
 */
export function diffSnapshots(a, b) {
  const changed = [], moved = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    for (const p of WATCHED) {
      if (a[key]?.[p] !== b[key]?.[p]) { changed.push(`${key} ${p}`); if (MOVEMENT.has(p) && a[key] && b[key]) moved.push(`${key} ${p}`); }
    }
  }
  return { changed, moved };
}
