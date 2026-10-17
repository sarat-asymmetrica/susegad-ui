// Browser checks for <sg-ticket>. Not a unit test (npm test runs the pure core); run it by hand:
//
//   node packages/components/ticket/ticket.check.mjs        (SG_ENGINE=webkit | firefox for the others)
//
// Checks: the card is a named group with the deck's labels and an IST time in words; the QR holds the id and
// nothing else, and the matrix the page drew decodes to the id beside it; registering makes the id on the
// device, keeps it (and no email), shows the card, moves focus to its heading and says one sentence, once; a
// reload shows it again quietly; storage that is missing, blocked or full does not break it; Save as picture
// downloads a real PNG named for the ticket, and that PNG decodes to the same id (the picture and the text
// agree); a picture that cannot be made says so in place and keeps the button; Konkani follows the page's
// lang in both scripts; the three registers draw their own card and the tear sits between the facts and the
// stub, down the card on a wide screen and across it on a phone; the finishing moment settles a new ticket and
// not a shown one, and nothing moves under reduced motion; axe on the demo and on the open state. The press,
// focus and reduced-motion contract is tools/touch.check.mjs.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import jsQR from 'jsqr';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';
import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { contextOptions } from '../../../tools/lib/engine.mjs';

const { browser, engine, server, check, open, openHtml, axe, done } = await harness();
const DEMO = '/packages/components/ticket/demo.html';
const JSQR = await readFile(createRequire(import.meta.url).resolve('jsqr/dist/jsQR.js'), 'utf8');

/** Decode a matrix of '0' and '1' rows the way a camera would see it, with an independent decoder. */
function decodeRows(rows) {
  const px = 8, quiet = 4, n = rows.length, side = (n + quiet * 2) * px, data = new Uint8ClampedArray(side * side * 4).fill(255);
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '1') return;
    for (let dy = 0; dy < px; dy++) for (let dx = 0; dx < px; dx++) { const o = (((y + quiet) * px + dy) * side + (x + quiet) * px + dx) * 4; data[o] = data[o + 1] = data[o + 2] = 0; }
  }));
  return jsQR(data, side, side)?.data;
}

/** A page of our own, with a stub for ariaNotify (so we can count what is said) and optional storage trouble. */
async function own({ width = 1000, height = 800, init = '', reduced = false, lang = 'en-IN', body = '' } = {}) {
  const errors = [], path = `/__check/ticket-${Math.random().toString(36).slice(2)}.html`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/packages/tokens/fonts.css"><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/qr/qr.css"><link rel="stylesheet" href="/packages/components/ticket/ticket.css"></head><body style="margin:0;background:var(--sg-surface)"><main style="padding:16px">${body || '<sg-ticket id="t" event="Mandovi Conclave" at="2026-11-21T09:30"></sg-ticket>'}<p><a id="after" href="#after">after</a></p></main><script type="module">import '/packages/components/ticket/ticket.js'; await customElements.whenDefined('sg-ticket'); window.__ready = true;</script></body></html>`;
  const ctx = await browser.newContext(contextOptions(engine, { viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference', acceptDownloads: true, ...(width < 500 ? { hasTouch: true, isMobile: true } : {}) }));
  await ctx.addInitScript(`window.__said = []; Document.prototype.ariaNotify = Element.prototype.ariaNotify = function (t) { window.__said.push(t); };${init}`);
  await ctx.route(`**${path}`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const goto = () => page.goto(`${server.url}${path}`).then(() => page.waitForFunction(() => window.__ready === true));
  return { ctx, page, errors, goto };
}

// ── what a shown ticket says ──
{
  const { ctx, page, errors } = await open(DEMO);
  await settle(page);
  const t = await page.evaluate(() => {
    const el = document.getElementById('t-event'), qr = el.querySelector('sg-qr');
    return {
      role: el.querySelector('.sg-ticket-card').getAttribute('aria-labelledby') && document.getElementById(el.querySelector('.sg-ticket-card').getAttribute('aria-labelledby')).textContent,
      facts: [...el.querySelectorAll('.sg-ticket-fact')].map(f => [f.querySelector('dt').textContent, f.querySelector('dd').textContent.trim()]),
      time: el.querySelector('time')?.getAttribute('datetime'),
      qrValue: qr.getAttribute('value'), qrLabel: qr.getAttribute('label'), qrText: [...qr.querySelectorAll('.sg-qr-text p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()).join(' '),
      rows: qr.symbol?.rows, version: qr.symbol?.version,
      done: el.querySelector('.sg-ticket-done').textContent, offline: el.querySelector('.sg-ticket-offline').textContent, local: el.querySelector('.sg-ticket-local').textContent,
      shown: !el.hidden, count: document.querySelectorAll('sg-ticket:not([hidden])').length,
    };
  });
  check('the card is a group named "Your ticket"', t.role === 'Your ticket', t.role);
  check('the facts carry the deck’s labels and the time in words, read in IST', JSON.stringify(t.facts) === JSON.stringify([['Name', 'Maria Fernandes'], ['Event', 'Mandovi Conclave'], ['Time (IST)', 'Saturday 21 November, 9:30 am']]), JSON.stringify(t.facts));
  check('the time is a <time> with its IST datetime', t.time === '2026-11-21T09:30', t.time);
  check('the code’s value is the id and nothing else', t.qrValue === 'K7QD-M3PX', t.qrValue);
  check('the code is named, and says it holds the id and nothing else', t.qrLabel === 'QR code for ticket K7QD-M3PX. It holds the ticket id and nothing else.', t.qrLabel);
  check('the words beside the code are the id and what to do at the door', t.qrText === 'Ticket id K7QD-M3PX Show this code at the door. If it will not scan, read out the ticket id beside it.', t.qrText);
  check('the matrix the page drew decodes to the id beside it (an independent decoder)', t.rows && decodeRows(t.rows) === 'K7QD-M3PX', `version ${t.version}`);
  check('the closing line, the offline line and the "kept on this device" line are on the card', t.done === 'You are on the list. See you there.' && t.offline.startsWith('After you have opened this page once') && t.local === 'This ticket is kept on this device only. Nothing was sent to a server.', `${t.done} | ${t.local}`);
  check('no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── registering: the id is made on the device, kept, shown, and said once ──
{
  const { ctx, page, errors, goto } = await own();
  await goto();
  check('with nothing kept, the element is hidden and takes no room', await page.evaluate(() => document.getElementById('t').hidden && getComputedStyle(document.getElementById('t')).display === 'none'));
  const r = await page.evaluate(async () => { const el = document.getElementById('t'); const done = el.issue('  Maria   Fernandes '); const sync = { shown: !el.hidden, anims: el.querySelector('.sg-ticket-card').getAnimations().length }; return { ...sync, result: await done }; });
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => ({
    id: document.querySelector('.sg-ticket-id').textContent, name: document.querySelector('.sg-ticket-name dd').textContent,
    focus: document.activeElement?.className, stored: localStorage.getItem('sg-ticket'), said: window.__said.slice(),
  }));
  check('the ticket appears at once, with a name tidied of extra spaces', r.shown && s.name === 'Maria Fernandes', JSON.stringify([r.shown, s.name]));
  check('the id is made on the device in the shape XXXX-XXXX', /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(s.id), s.id);
  check('it is kept in localStorage with the four facts and no email address', (() => { try { const o = JSON.parse(s.stored); return o.id === s.id && o.name === 'Maria Fernandes' && o.event === 'Mandovi Conclave' && o.at === '2026-11-21T09:30' && !/@/.test(s.stored) && Object.keys(o).sort().join() === 'at,event,id,issued,name,v'; } catch { return false; } })(), s.stored);
  check('focus is on the ticket’s heading', s.focus === 'sg-ticket-heading', s.focus);
  check('one sentence is said, once: the closing line and the id a character at a time', s.said.length === 1 && s.said[0] === `You are on the list. See you there. Ticket id: ${[...s.id.split('-')[0]].join(' ')}, ${[...s.id.split('-')[1]].join(' ')}.`, JSON.stringify(s.said));
  await page.reload();
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(400);
  const again = await page.evaluate(() => ({ shown: !document.getElementById('t').hidden, id: document.querySelector('.sg-ticket-id')?.textContent, said: window.__said.length, anims: document.querySelector('.sg-ticket-card')?.getAnimations().length, focus: document.activeElement?.className }));
  check('after a reload the same ticket shows again, quietly: nothing said, no settle, focus not taken', again.shown && again.id === s.id && again.said === 0 && again.anims === 0 && again.focus !== 'sg-ticket-heading', JSON.stringify(again));
  check('no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}
{
  // a name, an event and a time are all needed
  const { ctx, page, goto } = await own();
  await goto();
  const none = await page.evaluate(async () => [await document.getElementById('t').issue('   '), document.getElementById('t').hidden, localStorage.length]);
  check('no name: no ticket, nothing kept', none[0] === null && none[1] === true && none[2] === 0, JSON.stringify(none));
  await ctx.close();
}

// ── storage that is missing, blocked or full ──
for (const [name, init] of [
  ['blocked', "Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); }, configurable: true });"],
  ['full', "Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); };"],
]) {
  const { ctx, page, errors, goto } = await own({ init });
  await goto();
  const r = await page.evaluate(async () => { const el = document.getElementById('t'); const out = await el.issue('Maria Fernandes'); return { kept: out.kept, shown: !el.hidden, id: document.querySelector('.sg-ticket-id')?.textContent }; });
  check(`storage ${name}: the ticket still shows, and says it was not kept`, r.kept === false && r.shown && !!r.id, JSON.stringify(r));
  check(`storage ${name}: no errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── Save as picture ──
{
  const { ctx, page, goto } = await own();
  await goto();
  await page.evaluate(() => document.getElementById('t').issue('Maria Fernandes', { id: 'K7QD-M3PX', issued: 1 }));
  await page.waitForFunction(() => !!document.querySelector('.sg-ticket-save'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('.sg-ticket-save')]);
  const file = await download.createReadStream();
  const chunks = []; for await (const c of file) chunks.push(c);
  const bytes = Buffer.concat(chunks);
  // by keyboard too: the button is a native button, so Enter does what a press does
  await page.focus('.sg-ticket-save');
  const [byKey] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  check('Save as picture works from the keyboard (Enter on the focused button downloads the same file)', byKey.suggestedFilename() === 'ticket-K7QD-M3PX.png', byKey.suggestedFilename());
  check('the picture is downloaded as ticket-<id>.png', download.suggestedFilename() === 'ticket-K7QD-M3PX.png', download.suggestedFilename());
  check('it is a real PNG', bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && bytes.length > 5000, `${bytes.length} bytes`);
  await page.waitForFunction(() => document.querySelector('.sg-ticket-status').textContent !== '');
  check('the status says it saved, in words', (await page.textContent('.sg-ticket-status')) === 'Saved. Look for it in your downloads or photos.', await page.textContent('.sg-ticket-status'));
  // the picture and the text agree: decode the saved PNG with an independent decoder, in the page
  await page.addScriptTag({ content: JSQR });
  const read = await page.evaluate(async b64 => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}`; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, text: window.jsQR(d.data, c.width, c.height)?.data ?? null };
  }, bytes.toString('base64'));
  check(`the saved picture (${read.w} by ${read.h} px) holds a code that decodes to the id beside it`, read.text === 'K7QD-M3PX', JSON.stringify(read.text));
  check('the picture is 1200 px wide (600 at 2x) and taller than wide', read.w === 1200 && read.h > 1200, `${read.w}x${read.h}`);
  // a picture that cannot be made says so, in place, and keeps the button
  await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = function (cb) { cb(null); }; });
  await page.click('.sg-ticket-save');
  await page.waitForFunction(() => document.querySelector('.sg-ticket-status').textContent.startsWith('The picture did not save'));
  const failed = await page.evaluate(() => ({ text: document.querySelector('.sg-ticket-status').textContent, enabled: !document.querySelector('.sg-ticket-save').disabled }));
  check('a picture that cannot be made says what happened and what to do, in place, and keeps the button', failed.text === 'The picture did not save. Try again, or take a screenshot of this page.' && failed.enabled, JSON.stringify(failed));
  await ctx.close();
}

// ── the picture, in Konkani ──
for (const [lang, want] of [['gom-Deva', 'तुमचें तिकीट'], ['gom-Latn', 'Tumchem tikit']]) {
  const { ctx, page, goto } = await own({ lang });
  await goto();
  await page.evaluate(() => document.getElementById('t').issue('Maria', { id: 'K7QD-M3PX' }));
  await page.waitForFunction(() => !!document.querySelector('.sg-ticket-save'));
  await page.addScriptTag({ content: JSQR });
  const r = await page.evaluate(async () => {
    const { ticketToPng } = await import('/packages/components/ticket/ticket.png.js');
    const blob = await ticketToPng(document.getElementById('t').ticket, { lang: document.documentElement.lang, root: document.body });
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height);
    return { code: window.jsQR(d.data, c.width, c.height)?.data, heading: document.querySelector('.sg-ticket-heading').textContent, time: document.querySelector('.sg-ticket-time dd').textContent, labels: [...document.querySelectorAll('.sg-ticket-fact dt')].map(x => x.textContent), local: [document.querySelector('.sg-ticket-local').textContent, document.querySelector('.sg-ticket-local').lang] };
  });
  check(`${lang}: the heading, the labels and the time follow the page, and the saved picture still decodes to the id`, r.heading === want && r.code === 'K7QD-M3PX', JSON.stringify([r.heading, r.code]));
  check(`${lang}: the time is the library's Konkani date with the part of the day`, r.time === (lang === 'gom-Deva' ? 'शेनवार 21 नोव्हेंबर, सकाळीं 9:30' : 'Sonvar 21 Novembr, sokallim 9:30'), r.time);
  check(`${lang}: the "kept on this device only" line is in the page's language, not marked English`, r.local[1] === '' && r.local[0] === (lang === 'gom-Deva' ? 'हें तिकीट फकत ह्याच उपकरणार सांबाळ्ळां. सर्व्हराक कांयच धाडलें ना.' : 'Hem tikit phokot hyach upkoronar sambollam. Serverak kainch dhadlem na.'), JSON.stringify(r.local));
  await ctx.close();
}

// ── the three registers: what is drawn, and where the tear runs ──
for (const [width, orient] of [[1000, 'down the card'], [390, 'across the card']]) for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}`, { width, height: 900, touch: width < 500 });
  await settle(page);
  const m = await page.evaluate(id => {
    const el = document.getElementById(id); el.scrollIntoView({ block: 'center' });
    const r = e => { const x = e.getBoundingClientRect(); return { top: +x.top.toFixed(1), left: +x.left.toFixed(1), right: +x.right.toFixed(1), bottom: +x.bottom.toFixed(1), w: +x.width.toFixed(1), h: +x.height.toFixed(1) }; };
    const card = el.querySelector('.sg-ticket-card'), facts = el.querySelector('.sg-ticket-facts'), stub = el.querySelector('.sg-ticket-stub'), plate = el.querySelector('.sg-qr-plate'), save = el.querySelector('.sg-ticket-save');
    const deco = el.querySelector('.sg-ticket-deco'), pencil = el.querySelector('.sg-ticket-pencil'), shape = el.querySelector('.sg-ticket-shape');
    return {
      skin: el.dataset.skin, card: r(card), facts: r(facts), stub: r(stub), plate: r(plate), save: r(save), decoHidden: deco?.getAttribute('aria-hidden') === 'true', decoEvents: getComputedStyle(deco).pointerEvents,
      pencil: pencil ? { paths: pencil.querySelectorAll('path').length, tearD: pencil.querySelector('.tear')?.getAttribute('d'), box: r(pencil) } : null,
      shape: shape ? { bites: [...shape.querySelectorAll('circle')].map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]), perf: shape.querySelector('.perf')?.getAttribute('d') } : null,
    };
  }, `r-${register}`);
  const wide = m.stub.left > m.facts.left + 4;
  check(`${register} at ${width} px: its skin is mounted`, m.skin === register, m.skin);
  check(`${register} at ${width} px: the stub is ${wide ? 'beside' : 'below'} the facts (${orient})`, wide === (width > 500), `facts ${m.facts.left}-${m.facts.right} top ${m.facts.top}-${m.facts.bottom}, stub left ${m.stub.left} top ${m.stub.top}`);
  check(`${register} at ${width} px: the QR plate is a scannable size (${m.plate.w} px) and inside the card`, m.plate.w >= 120 && m.plate.right <= m.card.right && m.plate.left >= m.card.left, JSON.stringify(m.plate));
  check(`${register} at ${width} px: Save as picture is a thumb's height (${m.save.h} px)`, m.save.h >= 44);
  check(`${register} at ${width} px: the drawing is hidden from assistive technology and lets clicks through`, m.decoHidden && m.decoEvents === 'none');
  if (register === 'warm') {
    const at = m.pencil?.tearD?.match(/^M([\d.]+) ([\d.]+)/);
    const tear = at ? (wide ? +at[1] : +at[2]) : NaN, edge = wide ? m.stub.left - m.card.left : m.stub.top - m.card.top;
    check(`warm at ${width} px: four pencil strokes and one tear line, the tear ${Math.abs(tear - edge).toFixed(1)} px from the stub's edge`, m.pencil?.paths === 5 && Math.abs(tear - edge) <= 4 && Math.abs(m.pencil.box.w - m.card.w) <= 1.5 && Math.abs(m.pencil.box.h - m.card.h) <= 1.5, JSON.stringify(m.pencil));
  }
  if (register === 'playful') {
    const [a, b] = m.shape?.bites ?? [], edge = wide ? m.stub.left - m.card.left : m.stub.top - m.card.top;
    const at = wide ? a?.[0] : a?.[1];
    check(`playful at ${width} px: a bite at each end of the tear (${wide ? 'top and bottom' : 'left and right'}), the tear ${Math.abs(at - edge).toFixed(1)} px from the stub's edge`, m.shape?.bites.length === 2 && Math.abs(at - edge) <= 12 && (wide ? a[1] === 0 && Math.abs(b[1] - m.card.h) <= 1 : a[0] === 0 && Math.abs(b[0] - m.card.w) <= 1), JSON.stringify(m.shape));
  }
  const over = await sidewaysScroll(page, width);
  check(`${register} at ${width} px: no sideways scroll (${over.overflow} px)`, over.overflow === 0);
  await ctx.close();
}

// ── text holds its contrast on every card (found by measuring: the closing line was 3.72:1 in dark playful) ──
{
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const worst = {};
  for (const theme of ['light', 'dark']) for (const register of ['quiet', 'warm', 'playful']) {
    const { ctx, page } = await open(`${DEMO}?theme=${theme}&register=${register}`);
    await settle(page);
    const c = await page.evaluate(register => {
      const el = document.getElementById(`r-${register}`), cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const rgb = css => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = css; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data.slice(0, 3)]; };
      const bg = rgb(getComputedStyle(el.querySelector('.sg-ticket-card')).backgroundColor), col = s => rgb(getComputedStyle(el.querySelector(s)).color);
      return { bg, parts: { value: col('.sg-ticket-name dd'), label: col('.sg-ticket-name dt'), done: col('.sg-ticket-done'), notes: col('.sg-ticket-offline'), id: col('.sg-ticket-id'), beside: col('.sg-ticket-beside') } };
    }, register);
    for (const [k, v] of Object.entries(c.parts)) { const r = ratio(v, c.bg); if (!(k in worst) || r < worst[k][0]) worst[k] = [r, `${theme} ${register}`]; }
    await ctx.close();
  }
  const low = Object.entries(worst).filter(([, [r]]) => r < 4.5);
  check(`every line of text on the card holds 4.5:1 in every register and theme (lowest: ${Object.entries(worst).map(([k, [r, w]]) => `${k} ${r.toFixed(2)} in ${w}`).sort((a, b) => parseFloat(a.split(' ')[1]) - parseFloat(b.split(' ')[1]))[0]})`, !low.length, low.map(([k, [r, w]]) => `${k} ${r.toFixed(2)} ${w}`).join('; '));
}

// ── resize text: at 200 percent on a phone nothing runs off the screen (the QR plate did) ──
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}`, { width: 320, height: 800, touch: true });
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.waitForTimeout(300);
  const over = await sidewaysScroll(page, 320);
  const plate = await page.evaluate(() => { const p = document.querySelector('#r-' + document.documentElement.dataset.register + ' .sg-qr-plate') ?? document.querySelector('.sg-qr-plate'); const r = p.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right), units: p.style.getPropertyValue('--sg-qr-units') }; });
  check(`${register} at 320 px with text at 200 percent: no sideways scroll (${over.overflow} px) and the QR plate is inside the screen (${plate.w} px wide, right edge ${plate.right})`, over.overflow === 0 && plate.right <= 320, JSON.stringify(plate));
  await ctx.close();
}

// ── the same ticket on every language's page: matched by the event's id, not its name ──
{
  const body = name => `<sg-ticket id="t" event="${name}" event-id="mandovi-conclave" at="2026-11-21T09:30"></sg-ticket>`;
  const first = await own({ body: body('Mandovi Conclave') });
  await first.goto();
  const made = await first.page.evaluate(() => document.getElementById('t').issue('Maria Fernandes').then(r => r.ticket.id));
  // another page of the same site, in another language, with the event written differently: same storage, same ticket
  const url = first.page.url();
  const other = await first.ctx.newPage();
  const html = (await first.page.content()).replace('event="Mandovi Conclave"', 'event="मांडवी कॉन्क्लेव्ह"').replace('lang="en-IN"', 'lang="gom-Deva"');
  await first.ctx.route('**/__check/second.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html.replace(/<sg-ticket id="t"[\s\S]*?<\/sg-ticket>/, body('मांडवी कॉन्क्लेव्ह')) }));
  await other.goto(url.replace(/\/__check\/[^/]+$/, '/__check/second.html'));
  await other.waitForFunction(() => window.__ready === true);
  const s = await other.evaluate(() => ({ shown: !document.getElementById('t').hidden, id: document.querySelector('.sg-ticket-id')?.textContent, event: document.querySelector('.sg-ticket-event dd')?.textContent.trim(), heading: document.querySelector('.sg-ticket-heading')?.textContent }));
  check('a ticket made on one page shows on the same event’s page in another language, with the event in that language and the same id', s.shown && s.id === made && s.event === 'मांडवी कॉन्क्लेव्ह' && s.heading === 'तुमचें तिकीट', JSON.stringify(s));
  // and a different event id is not this event's ticket
  await first.ctx.route('**/__check/third.html', r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html.replace(/<sg-ticket id="t"[\s\S]*?<\/sg-ticket>/, '<sg-ticket id="t" event="Mandovi Conclave" event-id="another-event" at="2026-11-21T09:30"></sg-ticket>') }));
  await other.goto(url.replace(/\/__check\/[^/]+$/, '/__check/third.html'));
  await other.waitForFunction(() => window.__ready === true);
  check('a ticket for another event id is not shown, even with the same name', await other.evaluate(() => document.getElementById('t').hidden));
  await first.ctx.close();
}

// ── forget: remove it from the device ──
{
  const { ctx, page, goto, errors } = await own();
  await goto();
  await page.evaluate(() => document.getElementById('t').issue('Maria Fernandes'));
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => ({ btn: document.querySelector('.sg-ticket-forget')?.textContent, said: window.__said.length, stored: localStorage.getItem('sg-ticket') !== null }));
  check('the card has a Forget this ticket button', before.btn === 'Forget this ticket' && before.stored, JSON.stringify(before));
  await page.focus('.sg-ticket-forget');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.getElementById('t').hidden);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ stored: localStorage.getItem('sg-ticket'), said: window.__said.slice(), focus: document.activeElement?.id, hidden: document.getElementById('t').hidden }));
  check('forgetting removes it from the device, hides the card, says so once, and moves focus on', after.stored === null && after.hidden && after.said.length === 2 && after.said[1] === 'Forgotten. The ticket is no longer on this device.' && after.focus === 'after', JSON.stringify(after));
  await page.reload();
  await page.waitForFunction(() => window.__ready === true);
  check('after a reload there is no ticket', await page.evaluate(() => document.getElementById('t').hidden));
  check('no errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── expiry: seven days after the event's day, read in IST, the ticket is deleted when the page next looks for it ──
for (const [now, gone] of [['2026-11-27T23:00:00+05:30', false], ['2026-11-28T00:30:00+05:30', true]]) {
  const { ctx, page, goto } = await own();
  await goto();
  await page.evaluate(() => document.getElementById('t').issue('Maria Fernandes', { issued: 1 }));
  await page.waitForTimeout(300);
  await page.clock.install({ time: new Date(now) });
  await page.reload();
  await page.waitForFunction(() => window.__ready === true);
  const r = await page.evaluate(() => ({ hidden: document.getElementById('t').hidden, stored: localStorage.getItem('sg-ticket') !== null }));
  check(`at ${now.slice(0, 16)} IST the ticket for 21 November is ${gone ? 'deleted from the device' : 'still kept'}`, gone ? r.hidden && !r.stored : !r.hidden && r.stored, JSON.stringify(r));
  await ctx.close();
}

// ── motion: a new ticket settles; a shown one does not; reduced motion draws no animation ──
{
  const { ctx, page, goto } = await own({ body: '<div data-register="playful"><sg-ticket id="t" event="Mandovi Conclave" at="2026-11-21T09:30"></sg-ticket></div>' });
  await goto();
  await page.waitForTimeout(500);
  const n = await page.evaluate(async () => { const el = document.getElementById('t'); const p = el.issue('Maria Fernandes'); await new Promise(r => setTimeout(r, 30)); const n = el.querySelector('.sg-ticket-card').getAnimations().length; await p; return n; });
  check('playful: a new ticket settles (an animation runs on the card)', n >= 1, `${n} animations`);
  await ctx.close();
}
{
  const { ctx, page, goto } = await own({ reduced: true, body: '<div data-register="playful"><sg-ticket id="t" event="Mandovi Conclave" at="2026-11-21T09:30"></sg-ticket></div>' });
  await goto();
  await page.waitForTimeout(400);
  const n = await page.evaluate(async () => { const el = document.getElementById('t'); const p = el.issue('Maria Fernandes'); await new Promise(r => setTimeout(r, 30)); const n = document.getAnimations().filter(a => a.playState === 'running').length; await p; return n; });
  check('reduced motion: nothing animates when a ticket is made', n === 0, `${n} running`);
  await ctx.close();
}

// ── axe: the demo in both themes and every register, and with a ticket just made ──
for (const theme of ['light', 'dark']) {
  const { ctx, page, errors } = await open(`${DEMO}?theme=${theme}`);
  await settle(page);
  for (const register of ['quiet', 'warm', 'playful']) {
    await page.evaluate(r => document.documentElement.setAttribute('data-register', r), register);
    await page.waitForTimeout(250);
    await settle(page);
    const v = await axe(page);
    check(`axe, ${theme}, ${register}: 0 violations`, !v.length, v.join('; '));
  }
  await page.evaluate(() => document.getElementById('t-main').issue('Maria Fernandes'));
  await page.waitForTimeout(500);
  await settle(page);
  const made = await axe(page);
  check(`axe, ${theme}, with a ticket just made and its heading focused: 0 violations`, !made.length, made.join('; '));
  check(`${theme}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

await done();
