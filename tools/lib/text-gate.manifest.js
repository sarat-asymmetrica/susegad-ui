// Where the library puts words in a drawn shape, as data the text gate can walk (tools/text-gate.mjs).
//
// Each use says which copy it lays (a key into packages/type/fixtures/gate-copy.js), how to build its shape in Node
// from the scene's PURE model (never a browser), and what a surface must do at each viewport. Its `run` calls the real
// type-tier functions (setBlocks, layIntoShape, labelBox) on the layout it is handed, with the same arguments the
// scene's own words.js / render.js / matka-view.js pass; where a scene's code is not importable (it is DOM code) the
// call is copied here and the file and line it mirrors are named, so a change there is a change to find here.
//
// The expectation rule (written once, kept by tools/lib/text-gate.test.mjs):
//   A language may not do worse than English. At a viewport where English holds the words on the surface, every
//   language must hold them; where English falls back to the flat reading by design, the others may too. The
//   expectations below are English's outcomes as they stand today ('holds' / 'may-fall-back'); a viewport the
//   scene never lays at (stacked or flat) is a string saying why, and is not judged.
//
// Viewports are host widths. The demo pages the scenes are checked on set `main { max-width: 1240px; padding: 0 16px }`
// (packages/scenes/*/world.html), so a scene is min(viewport, 1240) - 32 CSS px wide, and scale = that / 1200
// (both Tinto and Vad draw on a 1200 x 800 plate). 'zoom-200' is the browser's text-only 200%: the root font is 32 px
// and the page is otherwise 1280 wide (the same case the scenes' own words.check.mjs runs).

import { slateOf, boardSizes, minSizes as tintoMin, SHOPS, PLAQUE_H } from '../../packages/scenes/tinto/model.js';
import { model as vadModel, layMoment, skyShape, skySizes, minSizes as vadMin, SKY } from '../../packages/scenes/vad/model.js';
import { surfacePoints, toScreen, extentIn, flowShape, quantise, columnAt } from '../../packages/scenes/veranda/matka.core.js';
import { arch } from '../../packages/type/layout.core.js';

export const PLATE_W = 1200;
const hostWidth = vw => Math.min(vw, 1240) - 32;
const vp = (name, vw, rootPx = 16) => ({ name, vw, rootPx, hostW: hostWidth(vw), phone: vw <= 480 });
export const VIEWPORTS = [vp('phone-390', 390), vp('desktop-1100', 1100), vp('desktop-1280', 1280), vp('zoom-200', 1280, 32)];

const collapse = s => s.replace(/\s+/g, ' ').trim();
const fmt1 = n => (Math.round(n * 10) / 10).toString();
const word = t => collapse(t).split(' ').slice(0, 2).join(' ');

/** The blocks setBlocks builds at one size (mirrors packages/type/layout.core.js setBlocks' `build`), for explaining a fall-back. */
function blocksAt(layout, specs, size, { family, weight = 400, leading = 1.22, gap = 0.5, align = 'center' }) {
  return specs.map((s, i) => {
    const px = +(size * (s.ratio ?? 1)).toFixed(2);
    return { tag: s.tag, px, prepared: layout.prepare(s.text, `${weight} ${px}px ${family}`), lineHeight: +(px * leading).toFixed(2), gap: i ? size * gap : 0, align };
  });
}

/** Why setBlocks gave the words back: no legible size, or at the smallest one what ran out (room, or a word wider than its band). */
function whyNot(layout, specs, shape, o) {
  if (!o.sizes.length) return { kind: 'no-size', text: `no legible size at this scale: the words would have to be set under ${o.minBody} px, so they stay in the flat reading` };
  const size = o.sizes.at(-1), blocks = blocksAt(layout, specs, size, o);
  const probe = layout.layIntoShape(blocks, shape, o);
  const laidChars = blocks.map((_, i) => collapse(probe.lines.filter(l => l.block === i).map(l => l.text).join('')).length);
  const total = specs.map(s => collapse(s.text).length);
  const cut = specs.findIndex((s, i) => laidChars[i] < total[i]);
  // a line that ends mid-word: neither it nor the next line has a space at the break
  const broke = probe.lines.find((l, i) => { const n = probe.lines[i + 1]; return n && n.block === l.block && !/\s$/u.test(l.text) && !/^\s/u.test(n.text); });
  if (broke) return { kind: 'broke-word', text: `at the smallest size, ${size} px, a word is wider than its band and breaks ("${broke.text.slice(-12).trim()}...")` };
  if (cut < 0 && !probe.fits) {
    // every word is laid but layIntoShape asked for one more line of room before it asked whether any text was left
    const lh = blocks.at(-1).lineHeight / o.scale, spare = o.bottom - probe.bottom;
    return { kind: 'spare-line', text: `at the smallest size, ${size} px, all ${total.reduce((a, b) => a + b, 0)} characters are laid in ${probe.lines.length} lines, ending ${fmt1(spare)} units above the bottom; layIntoShape needs one more line of room (${fmt1(lh)} units) before it can tell that the text has ended` };
  }
  if (cut >= 0) return { kind: 'height', text: `at the smallest size, ${size} px, the room runs out: ${laidChars.reduce((a, b) => a + b, 0)} of ${total.reduce((a, b) => a + b, 0)} characters fit, from "${word(specs[cut].text.slice(laidChars[cut]))}..." on` };
  return { kind: 'other', text: `at the smallest size, ${size} px, the lines do not fit` };
}

const blocksUse = {
  /** run() for a use that sets blocks on a shape with setBlocks. Subclasses pass the scene's shape and options. */
  make({ layout, entry, lang, shape, opts, family, weight = 400, ratioOf, scale, minBody }) {
    const specs = entry.blocks[lang].map(b => ({ ...b, ratio: ratioOf(b) }));
    const laid = layout.setBlocks(specs, shape, opts);
    const fontOf = l => `${weight} ${laid.blocks[l.block].px}px ${family}`;
    return {
      laid, scale, fontOf, bandAt: l => shape(l.y, l.y + l.h),
      ...(laid ? {} : (r => ({ reason: r.text, reasonKind: r.kind }))(whyNot(layout, specs, shape, { ...opts, family, weight, minBody }))),
    };
  },
};

// ── 1. The chalkboard outside the Taverna (packages/scenes/tinto/words.js layBoard) ──
export const makeTintoBoard = ({ slate = slateOf() } = {}) => ({
  id: 'tinto.board', copy: 'tinto.board', onUnfit: 'falls-back', stack: 'sg-font-hand',
  legible: (v, tag) => (tag === 'p' ? tintoMin(v.rootPx).body : tintoMin(v.rootPx).heading),
  viewports: {
    // English: the plate is drawn at 0.30 of its size on a phone, so 21 units are 6 px: no legible size, the panel stays
    'phone-390': { expect: 'may-fall-back' },
    'desktop-1100': { expect: 'holds' },
    'desktop-1280': { expect: 'holds' },
    // 200% text doubles every minimum (28 px body) and the largest size the plate allows is 21 px: flat by design
    'zoom-200': { expect: 'may-fall-back' },
  },
  run({ layout, entry, lang, vp, cssStack }) {
    const family = cssStack('sg-font-hand'), scale = vp.hostW / PLATE_W, sl = slate, shape = arch(sl.x, sl.y, sl.w, sl.h, sl.rise, sl.pad);
    const opts = { sizes: boardSizes(scale, vp.rootPx), family, top: sl.y + sl.pad * 0.6, bottom: sl.y + sl.h - sl.pad, scale, minWidth: 30 };
    return blocksUse.make({ layout, entry, lang, shape, opts, family, scale, minBody: tintoMin(vp.rootPx).body, ratioOf: b => (b.tag === 'p' ? 1 : 1.45) });
  },
});

// ── 2. The shops' plaques (tinto/words.js update -> junctions.js measure -> labelBox) ──
const tintoPlaques = {
  id: 'tinto.plaques', copy: 'tinto.plaques', onUnfit: 'falls-back', stack: 'sg-font-body', weight: 500,
  legible: (v) => tintoMin(v.rootPx).label,
  flatOnPhone: true, // the labels' own minimum is 0.75rem; the junction list takes over before a phone would see them
  viewports: {
    'phone-390': { expect: 'may-fall-back' },
    'desktop-1100': { expect: 'holds' },
    'desktop-1280': { expect: 'holds' },
    'zoom-200': { expect: 'may-fall-back' },
  },
  run({ layout, entry, lang, vp, cssStack }) {
    const scale = vp.hostW / PLATE_W, min = tintoMin(vp.rootPx);
    const px = Math.max(min.label, 17 * scale), family = cssStack('sg-font-body'), font = `500 ${px}px ${family}`;
    const labels = entry.labels[lang];
    const boxes = SHOPS.map((s, i) => {
      const { w, h } = layout.labelBox(labels[i], font, px, { target: min.target });
      return { shop: s, text: labels[i], box: { x: s.at[0] - w / scale / 2, y: s.at[1], w: w / scale, h: h / scale } };
    });
    const bad = boxes.find(b => b.box.w > b.shop.room || b.box.h > PLAQUE_H);
    const laid = bad ? null : {
      size: px, blocks: [{ tag: 'label', px, lineHeight: px * 1.2 }],
      lines: boxes.map(b => ({ block: 0, text: b.text, ...b.box, room: b.shop.room })),
    };
    return {
      laid, scale, checkSource: false, exactWidth: false, fontOf: () => font, // a plaque's box is its words plus padding
      bandAt: l => { const s = SHOPS[laid.lines.indexOf(l)]; return { x: s.at[0] - s.room / 2, w: s.room }; },
      reason: bad ? `the "${bad.text}" plaque is ${Math.round(bad.box.w)} units wide but the ${bad.shop.id} shop has room for ${bad.shop.room}, so the shops become a list` : null,
    };
  },
};

// ── 3. The sky beside the banyan (packages/scenes/vad/render.js surface.update) ──
const SEEDS = [1, 2, 3];
const vadSky = {
  id: 'vad.sky', copy: 'vad.sky', onUnfit: 'falls-back', stack: 'sg-font-hand',
  legible: (v, tag) => (tag === 'p' ? vadMin(v.rootPx).body : vadMin(v.rootPx).heading),
  variants: () => SEEDS.map(seed => ({ id: `seed ${seed}`, seed })),
  viewports: {
    'phone-390': { expect: 'may-fall-back' },
    'desktop-1100': { expect: 'holds' },
    'desktop-1280': { expect: 'holds' },
    'zoom-200': { expect: 'may-fall-back' },
  },
  run({ layout, entry, lang, vp, variant, cssStack }) {
    const family = cssStack('sg-font-hand');
    // the settled, finished canopy is the narrowest sky the words ever have (it only grows), so it is the case to gate
    const data = vadModel({ seed: variant.seed, register: 'warm', params: { progress: 1, words: 'world' } });
    const lm = layMoment(data.local, data.endTime), shape = skyShape(data.tree, lm, 560);
    const scale = vp.hostW / PLATE_W;
    const opts = { sizes: skySizes(scale, vp.rootPx), family, top: SKY.top, bottom: 420, scale, minWidth: 60, valign: 'top', align: 'left' };
    return blocksUse.make({ layout, entry, lang, shape, opts, family, scale, minBody: vadMin(vp.rootPx).body, ratioOf: b => (b.tag === 'p' ? 1 : 1.4) });
  },
};

// ── 4. The paragraph round the clay pot (packages/scenes/veranda/matka-view.js lay) ──
// The silhouette is matka.core.js's own projection of the pot's surface points (the 2D tier and the layout use it; the
// live three.js tier lays against the same pose). The pot's size on the page depends on the camera, so the gate tries
// three sizes (layScale 0.7, which is the floor, 1 and 1.5) at all 16 poses the layout is quantised to, and keeps the worst.
const LEADING = 1.4, STEPS = 16, TAU = Math.PI * 2;
const verandaMatka = {
  id: 'veranda.matka', copy: 'veranda.matka', onUnfit: 'falls-back', // matka-view.js grows the column (x1.6 up to x8) until the words fit; if the grown card cannot stay inside the picture frame, the stage stacks and the paragraph is the flat reading
  stack: 'sg-font-body',
  legible: null,           // the scene declares no minimum, so nothing is judged; softMin makes the gate say so out loud
  softMin: 14,
  flatOnPhone: true,
  variants: () => [0.7, 1, 1.5].flatMap(s => Array.from({ length: STEPS }, (_, k) => ({ id: `pot scale ${s}, pose ${k}/${STEPS}`, s, k }))),
  viewports: {
    // under 560 px the stage is 'stacked': the paragraph is flat below the picture (stage-element.js #flowOn)
    'phone-390': 'stacked below 560 px: the paragraph is flat below the picture',
    'desktop-1100': { expect: 'holds' },
    'desktop-1280': { expect: 'holds' },
    'zoom-200': 'the column grows here (gated above at the scene own growth); whether the grown card still fits the picture frame, and so whether the stage stacks, is a layout fact of the frame that needs a browser: veranda/quads.check.mjs reads it at 200% and 400%',
  },
  run({ layout, entry, lang, vp, variant, cssStack }) {
    const size = 0.9 * vp.rootPx;   // .flow-card font-size: .9rem
    const scale = variant.s, hq = scale * 78, px = size * scale;
    const th = quantise(variant.k / STEPS * TAU, STEPS);
    const pot = toScreen(surfacePoints(th), 0, 0, hq);
    const family = cssStack('sg-font-body'), font = `400 ${px.toFixed(2)}px ${family}`;
    const text = collapse(entry.blocks[lang].map(b => b.text).join(' '));
    const lh = px * LEADING;
    // the scene's own growth (matka-view.js lay): a taller column until the words fit, at most eight times the pot's
    let grow = 1, col, shape, r;
    for (;;) {
      col = columnAt(hq, grow);
      shape = flowShape(col, (top, bottom) => extentIn(pot, top, bottom), Math.max(8, hq * 0.2));
      r = layout.layIntoShape([{ prepared: layout.prepare(text, font), lineHeight: lh, gap: 0 }], shape, { top: col.y, bottom: col.y + col.h, scale: 1, minWidth: px * 4 });
      if (r.fits || grow >= 8) break;
      grow *= 1.6;
    }
    const laid = { size: px, blocks: [{ tag: 'p', px, lineHeight: lh }], lines: r.lines };
    return {
      laid: r.fits ? laid : null, scale: 1, fontOf: () => font, bandAt: l => shape(l.y, l.y + l.h),
      checkSource: false,
      reason: `the paragraph does not fit round the pot even in a column ${grow.toFixed(1)} times taller: ${r.lines.length} lines laid, ${collapse(r.lines.map(l => l.text).join('')).length} of ${text.length} characters, so the scene stacks and shows the flat reading`,
    };
  },
};

export const MANIFEST = [makeTintoBoard(), tintoPlaques, vadSky, verandaMatka];
