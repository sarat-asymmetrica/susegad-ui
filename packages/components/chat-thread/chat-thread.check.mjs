// Browser checks for <sg-chat-thread>: axe with and without JavaScript, that
// redaction leaves nothing behind, that every message names its speaker to
// assistive technology, and that the playful bounce respects reduced motion.
// Each probe also runs on a deliberately broken page, to show it can fail.
//
//   node packages/components/chat-thread/chat-thread.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { unsupportedIn } from '../../../tools/lib/engine.mjs';
import { renderThread } from './chat-thread.core.js';

const { check, open, openHtml, axe, axeNoJs, done, engine } = await harness();
const DEMO = '/packages/components/chat-thread/demo.html';

// ── axe: the demo shows all three registers at once ──
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  const v = await axe(page);
  check(`axe, ${theme}, all three registers: 0 violations`, !v.length, v.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}
{
  const v = await axeNoJs(DEMO);
  check('axe without JavaScript: 0 violations', !v.length, v.join('; '));
}

// ── redaction: the secrets go in at build time and must not come out anywhere ──
const SECRETS = ['98765 43210', '9876543210', 'Rohan', 'rohan@example.com'];
const leaks = page => page.evaluate(secrets => {
  const where = [];
  const html = document.documentElement.outerHTML;
  for (const s of secrets) {
    if (html.includes(s)) where.push(`${s} in the DOM`);
    if (document.body.innerText.includes(s)) where.push(`${s} on screen`);
  }
  return where;
}, SECRETS);
const page = body => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title>
  <link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/chat-thread/chat-thread.css"></head>
  <body><main>${body}</main><script type="module">import '/packages/components/chat-thread/chat-thread.js';</script></body></html>`;
{
  const built = renderThread([
    { day: '2026-03-04' },
    { from: 'them', who: 'Maya', text: 'Call Rohan on +91 98765 43210 or 9876543210, or mail rohan@example.com', time: '2026-03-04T10:12' },
  ], { redact: { names: ['Rohan'] } });
  const { ctx, page: p } = await openHtml('redacted', page(built));
  await p.waitForFunction(() => customElements.get('sg-chat-thread'));
  const found = await leaks(p);
  const shown = await p.evaluate(() => [...document.querySelectorAll('.sg-redacted')].map(m => m.textContent));
  check('redaction: built with renderThread, none of the secrets are in the DOM or on screen', !found.length && shown.length === 4, `${found.join(', ') || 'none leaked'}; markers: ${shown.join(' | ')}`);
  await ctx.close();
}
{
  // broken on purpose: the number is "redacted" with CSS, so it is still in the page
  const { ctx, page: p } = await openHtml('redacted-broken', page(`<sg-chat-thread><ol aria-label="x"><li data-from="them"><p class="sg-chat-text">Call <span class="sg-redacted" style="color:transparent">+91 98765 43210</span></p></li></ol></sg-chat-thread>`));
  const warned = [];
  p.on('console', m => { if (m.type() === 'warning') warned.push(m.text()); });
  await p.reload();
  await p.waitForFunction(() => customElements.get('sg-chat-thread'));
  await p.waitForTimeout(50);
  const found = await leaks(p);
  check('control: a number hidden with CSS is caught by the same probe, and the element warns', found.length > 0 && warned.some(w => w.includes('redaction marker')), `${found.join(', ')}; warnings ${warned.length}`);
  await ctx.close();
}

// ── every message names its speaker to assistive technology ──
const speakers = p => p.evaluate(() => [...document.querySelectorAll('sg-chat-thread li[data-from]')].map(li => {
  const who = li.querySelector('.sg-chat-who');
  const cs = who && getComputedStyle(who);
  return { run: li.dataset.run || '', named: !!who && cs.display !== 'none' && cs.visibility !== 'hidden' && who.textContent.trim().length > 0, box: who ? Math.round(who.getBoundingClientRect().width) : 0 };
}));
{
  const { ctx, page: p } = await open(DEMO);
  await settle(p);
  const s = await speakers(p);
  const hidden = s.filter(x => x.run === 'continue');
  check('every message names its speaker to a screen reader, including the second of a run', s.length === 15 && s.every(x => x.named), `${s.filter(x => x.named).length}/${s.length} named`);
  check('warm and playful hide a repeated name only visually (1 px box), quiet shows it', hidden.length === 3 && hidden.filter(x => x.box <= 1).length === 2, JSON.stringify(hidden));
  await p.addStyleTag({ content: 'sg-chat-thread li[data-run="continue"] .sg-chat-who { display: none !important }' });
  const broken = await speakers(p);
  check('control: hiding the repeated name with display:none turns the probe red', broken.some(x => !x.named), `${broken.filter(x => !x.named).length} unnamed`);
  await ctx.close();
}

// ── the playful bounce: real motion when allowed, none under reduced motion ──
for (const reduced of [false, true]) {
  const { ctx, page: p } = await open(DEMO, { reduced });
  const count = await p.evaluate(async () => {
    const thread = document.querySelector('[data-register="playful"] sg-chat-thread');
    thread.scrollIntoView();
    await new Promise(r => setTimeout(r, 250));
    return thread.getAnimations({ subtree: true }).length;
  });
  if (reduced) check('playful under reduced motion: no bounce at all', count === 0, `${count} animations`);
  else check('playful: messages bounce in as they come into view (the probe sees real animations)', count >= 3, `${count} animations`);
  await ctx.close();
}

// ── replies and reactions: what assistive technology reads, and nothing overlaps ──
// Chromium's own accessibility tree (CDP), not Playwright's aria snapshot, which
// prints an image's child text even when a screen reader would not get it.
async function heard(page, sel) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byId = new Map(nodes.map(n => [n.nodeId, n]));
  const root = await page.locator(sel).first().evaluate(el => { el.dataset.axProbe = '1'; return el.outerHTML.length; });
  // find the DOM node's AX node by backendDOMNodeId
  const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: doc.nodeId, selector: '[data-ax-probe="1"]' });
  const { node } = await cdp.send('DOM.describeNode', { nodeId });
  await page.locator('[data-ax-probe]').evaluate(el => delete el.dataset.axProbe);
  const start = nodes.find(n => n.backendDOMNodeId === node.backendNodeId);
  const out = [];
  const walk = n => { if (!n) return; if (!n.ignored && n.name?.value && !['InlineTextBox'].includes(n.role?.value)) out.push(`${n.role?.value}: ${n.name.value}`); (n.childIds || []).forEach(id => walk(byId.get(id))); };
  walk(start);
  await cdp.detach();
  void root;
  return out;
}
// heard() reads Chromium's own accessibility tree over CDP, which only
// Chromium exposes (Playwright's aria snapshot over-reports image children
// instead, the reason this probe exists at all -- see the comment above
// heard()). Firefox and WebKit skip what depends on it rather than fail on
// a CDP session Playwright never offers them.
if (engine !== 'chromium') {
  unsupportedIn(engine, "Chromium's accessibility tree (CDP Accessibility.getFullAXTree)", 'reply-quote and reaction wording are unverified here');
} else {
  {
    const { ctx, page } = await open(DEMO);
    await settle(page);
    for (const reg of ['quiet', 'warm', 'playful']) {
      const t = await heard(page, `[data-register="${reg}"] li:has(.sg-chat-reply)`);
      const said = t.filter(x => x.startsWith('StaticText')).map(x => x.slice(12)).join(' ').replace(/\s+/g, ' ');
      check(`${reg}: the reply is a quote that says what it is and whom it quotes`, /^Studio Replying to: Maya, Aldona Organics Can we move the shoot to Friday\?/.test(said), said.slice(0, 120));
      const all = await heard(page, `[data-register="${reg}"] sg-chat-thread`);
      const hearts = all.filter(x => x === 'image: Reacted with a heart').length, emoji = all.filter(x => x.startsWith('StaticText') && x.includes('❤')).length;
      check(`${reg}: the heart is read once, as words, and the emoji itself is not read`, hearts === 1 && emoji === 0, `label ${hearts}, emoji ${emoji}`);
    }
    await ctx.close();
  }
  {
    // broken on purpose: a reaction with no role and a reply with no prefix, and no element to fix them
    const { ctx, page } = await openHtml('reply-broken', `<!doctype html><html lang="en"><head><title>t</title></head><body>
      <ol aria-label="x" id="t"><li><blockquote class="sg-chat-reply"><span class="sg-chat-reply-who">Maya</span> <span>Can we move the shoot?</span></blockquote><p>Friday.</p>
      <span class="sg-chat-reaction" aria-label="Reacted with a heart">❤️</span></li></ol></body></html>`);
    const t = await heard(page, '#t li');
    const said = t.filter(x => x.startsWith('StaticText')).map(x => x.slice(12)).join(' ');
    const hearts = t.filter(x => x === 'image: Reacted with a heart').length, emoji = t.filter(x => x.startsWith('StaticText') && x.includes('❤')).length;
    check('control: a reply with no prefix and an unlabelled emoji fail the same probes', !/Replying to:/.test(said) && !(hearts === 1 && emoji === 0), `${said} | label ${hearts}, emoji ${emoji}`);
    await ctx.close();
  }
}
// Reactions sit on their bubble's edge: never over another message, the time or the words.
const overlaps = page => page.evaluate(() => {
  const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
  const out = [];
  for (const r of document.querySelectorAll('.sg-chat-reaction')) {
    const rr = r.getBoundingClientRect(), li = r.closest('li');
    const others = [...li.parentElement.children].filter(x => x !== li).map(x => x.getBoundingClientRect());
    const own = [...li.querySelectorAll('.sg-chat-text, .sg-chat-time, .sg-chat-reply, .sg-chat-who')].map(x => x.getBoundingClientRect());
    if (others.some(o => hit(rr, o)) || own.some(o => hit(rr, o))) out.push(`${li.closest('[data-register]').dataset.register}: ${r.getAttribute('aria-label')}`);
  }
  return out;
});
for (const width of [1280, 390]) {
  const { ctx, page } = await open(DEMO, { width, touch: width < 500 });
  await settle(page);
  const o = await overlaps(page);
  check(`at ${width} px no reaction overlaps another message, its time, its words or its reply`, !o.length, o.join('; ') || '6 reactions clear');
  if (width === 390) {
    await page.addStyleTag({ content: 'sg-chat-thread[data-skin] li:has(> .sg-chat-reaction) { margin-bottom: 0 !important } sg-chat-thread[data-skin] > ol { gap: 2px !important } sg-chat-thread li.sg-chat-day { margin: 0 !important }' });
    await page.waitForTimeout(50);
    const b = await overlaps(page);
    check('control: without the room under a reacted bubble, the same probe finds the overlap', b.length > 0, b.join('; '));
  }
  await ctx.close();
}

// ── no JavaScript: every message reads, as the quiet transcript ──
{
  const { ctx, page: p } = await open(DEMO, { js: false });
  const r = await p.evaluate(() => [...document.querySelectorAll('sg-chat-thread li')].map(li => li.getBoundingClientRect().height));
  check('without JavaScript every message and divider is on screen', r.length === 21 && r.every(h => h > 10), `${r.filter(h => h > 10).length}/${r.length}`);
  await ctx.close();
}

// ── phone width: nothing scrolls sideways ──
{
  const { ctx, page: p } = await open(DEMO, { width: 390 });
  await settle(p);
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  check('at 390 px the page does not scroll sideways', w <= 390, `${w}`);
  await ctx.close();
}

await done();
