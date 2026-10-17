// Browser checks for <sg-consent>. Not a unit test (npm test runs the pure core); run it by hand:
//
//   node packages/components/consent/consent.check.mjs        (SG_ENGINE=webkit | firefox for the others)
//
// Checks: the notice is a named group with its six lines in order and a native required checkbox that is
// never ticked; sending without the tick shows the note, marks the box, moves focus to it and sends nothing;
// ticking it sends the form with consent=yes; a value the site left out is a visible, marked placeholder and
// says so once in the console, while a complete notice says nothing; the notice written ahead of time works
// with no script at all (the box is native and blocks the form); Konkani follows the page's lang in both
// scripts; the three registers draw their own frame and keep it off the words and out of the way of a
// click; the box and its label are a thumb's size; no sideways scroll at 390 px; axe on the demo (open and
// error states too) and on the notice as plain HTML. The press, focus and reduced-motion contract is
// tools/touch.check.mjs.

import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';
import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { readFileSync } from 'node:fs';
import { renderConsent } from './consent.core.js';

const { browser, check, open, openHtml, axe, done } = await harness();
const DEMO = '/packages/components/consent/demo.html';
const HEAD = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/packages/tokens/tokens.css"><link rel="stylesheet" href="/packages/components/consent/consent.css">';

// ── the demo's form carries its notice as plain HTML, and it is what renderConsent writes ──
{
  const src = readFileSync(new URL('./demo.html', import.meta.url), 'utf8');
  const at = src.indexOf('<sg-consent id="form-notice"'), block = src.slice(at, src.indexOf('</sg-consent>', at) + 13);
  const want = renderConsent({ lang: 'en', id: 'form-notice', values: { site: 'Sample Tiatr Night', fields: 'your name and your email address', purpose: 'reserve your seat and tell you if the time changes', period: '30 days after the show', contact: 'seats@tiatr.example', complain: 'If you are not satisfied with our answer, tell the Sample Tiatr Night committee at the same address.' } });
  const flat = h => h.split('\n').map(l => l.trim()).join('\n');
  check('the demo’s written-ahead notice is exactly what renderConsent writes', flat(block) === flat(want), 'run the one-liner in the comment above it to write it again');
}

// ── the markup ──
{
  const warns = [];
  const { ctx, page, errors } = await open(DEMO);
  page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await settle(page);
  const n = await page.evaluate(() => {
    const el = document.getElementById('n-tiatr'), box = el.querySelector('input[type="checkbox"]'), label = box.closest('label');
    return {
      role: el.getAttribute('role'), name: document.getElementById(el.getAttribute('aria-labelledby'))?.textContent, level: el.querySelector('.sg-consent-heading').localName,
      parts: [...el.querySelectorAll('.sg-consent-line')].map(p => p.dataset.part),
      box: { type: box.type, name: box.name, required: box.required, checked: box.checked, inLabel: !!label, labelText: label.textContent.replace(/\s+/g, ' ').trim() },
      allUnticked: [...document.querySelectorAll('sg-consent input[type="checkbox"]')].every(c => !c.checked),
      count: document.querySelectorAll('sg-consent').length,
    };
  });
  check('a named group, headed "What we do with your details"', n.role === 'group' && n.name === 'What we do with your details' && n.level === 'h3', `${n.role} | ${n.name} | ${n.level}`);
  check('six lines, in order: collect, why, how long, ask, withdraw, complain', n.parts.join() === 'collect,why,howLong,ask,withdraw,complain', n.parts.join());
  check('the box is a native required checkbox named consent, in its label, never pre-ticked', n.box.type === 'checkbox' && n.box.name === 'consent' && n.box.required && !n.box.checked && n.box.inLabel, JSON.stringify(n.box));
  check('the label says what the visitor agrees to', n.box.labelText === 'I have read this, and I agree that Sample Tiatr Night may use my details in this way.', n.box.labelText);
  const aria = await page.locator('#n-tiatr input').ariaSnapshot();
  check('the box’s accessible name is the visible label', aria.includes('I have read this, and I agree that Sample Tiatr Night may use my details in this way.'), aria);
  check('no box on the page starts ticked', n.allUnticked && n.count === 9, `${n.count} notices`);
  const blanks = await page.evaluate(() => ({
    event: { incomplete: document.getElementById('n-event').hasAttribute('data-incomplete'), blanks: [...document.querySelectorAll('#n-event .sg-consent-blank')].map(b => `${b.textContent}|${b.lang}`) },
    feast: document.getElementById('n-feast').hasAttribute('data-incomplete'), tiatr: document.getElementById('n-tiatr').hasAttribute('data-incomplete'), form: document.getElementById('form-notice').hasAttribute('data-incomplete'),
  }));
  const flow = await page.evaluate(() => { const w = document.querySelector('#n-event .sg-consent-words'), b = w.querySelector('.sg-consent-blank'); return { words: Math.round(w.getBoundingClientRect().width), blank: Math.round(b.getBoundingClientRect().width), lines: Math.round(w.getBoundingClientRect().height / parseFloat(getComputedStyle(w).lineHeight)) }; });
  check(`a placeholder inside the box’s label stays in the sentence (${flow.blank} px wide, in ${flow.lines} lines), not a column of its own`, flow.blank > 60 && flow.words > 200 && flow.lines <= 3, JSON.stringify(flow));
  check('the conclave’s notice shows its three open values as marked placeholders, in English for a screen reader', blanks.event.incomplete && blanks.event.blanks.length === 3 && blanks.event.blanks.every(b => b.endsWith('|en')), JSON.stringify(blanks.event.blanks));
  check('a complete notice is not flagged', !blanks.feast && !blanks.tiatr && !blanks.form, JSON.stringify(blanks));
  check('the console says once that a notice still has placeholders', warns.filter(w => w.startsWith('sg-consent: this notice still has')).length === 1, warns.join(' | '));
  check('no console errors or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── a form: send without the tick, then with it ──
{
  const { ctx, page } = await open(DEMO);
  await page.click('#enquiry .send');
  await page.waitForTimeout(150);
  const s = await page.evaluate(() => {
    const box = document.querySelector('#form-notice input'), note = document.querySelector('#form-notice sg-field-note');
    return { status: document.getElementById('status').textContent, note: note.textContent.trim(), invalid: box.getAttribute('aria-invalid'), focus: document.activeElement === box, describedby: box.getAttribute('aria-describedby') === note.id };
  });
  check('sent without the tick: nothing is sent', s.status === '', JSON.stringify(s));
  check('the note says what is missing, in words', s.note === 'Error: Please tick the box if you are happy to go on. We cannot use your details without it.', s.note);
  check('the box is marked invalid, points at the note, and has focus', s.invalid === 'true' && s.describedby && s.focus, JSON.stringify(s));
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const cleared = await page.evaluate(() => ({ note: document.querySelector('#form-notice sg-field-note').textContent.trim(), invalid: document.querySelector('#form-notice input').getAttribute('aria-invalid'), checked: document.querySelector('#form-notice input').checked, status: document.getElementById('status').textContent }));
  check('Space ticks it and the note goes at once, and ticking sends nothing by itself', cleared.checked && cleared.note === '' && cleared.invalid === null && cleared.status === '', JSON.stringify(cleared));
  await page.click('#enquiry .send');
  await page.waitForFunction(() => document.getElementById('status').textContent !== '');
  check('ticked: the form is sent with consent=yes', (await page.textContent('#status')) === 'Sent to nobody: a demo. Consent: yes.', await page.textContent('#status'));
  const events = await page.evaluate(() => new Promise(r => { const b = document.querySelector('#n-feast input'); addEventListener('sg-consent', e => r(e.detail), { once: true }); b.click(); }));
  check('ticking sends sg-consent with the state', events.checked === true && events.id === 'n-feast', JSON.stringify(events));
  const tab = await page.evaluate(async () => {
    document.getElementById('email').focus();
    return true;
  });
  await page.keyboard.press('Tab');
  const reached = await page.evaluate(() => document.activeElement.closest('sg-consent')?.id + ':' + document.activeElement.type);
  check('Tab goes from the email field to the box', tab && reached === 'form-notice:checkbox', reached);
  await ctx.close();
}

// ── the notice written ahead of time works with no script at all ──
{
  const html = `<!doctype html><html lang="en-IN"><head>${HEAD}<title>Plain</title></head><body><main>
    <form id="f"><label for="n">Your name</label> <input id="n" name="name" value="Maria"> ${renderConsent({ lang: 'en', id: 'plain', values: { fields: 'your name', purpose: 'reserve your seat', period: '30 days after the show', contact: 'seats@tiatr.example', site: 'Sample Tiatr Night', complain: 'Tell the committee at the same address.' } })} <button>Send</button></form></main></body></html>`;
  const { ctx, page } = await openHtml('consent-plain', html);
  const r = await page.evaluate(() => {
    const f = document.getElementById('f'), box = f.querySelector('input[name="consent"]');
    const tick = f.querySelector('.sg-consent-tick');
    const label = box.closest('label').getBoundingClientRect();
    return { valid: f.checkValidity(), msg: box.validationMessage !== '', text: document.querySelector('sg-consent').innerText.includes('We keep them until 30 days after the show, then we delete them.'), upgraded: !!customElements.get('sg-consent'), tick: tick?.getBoundingClientRect().height > 0, labelH: Math.round(label.height), labelW: Math.round(label.width) };
  });
  check('as plain HTML: the words are there, with no component loaded', r.text && !r.upgraded, JSON.stringify(r));
  check('as plain HTML: the form is not valid until the box is ticked (the browser itself says so)', !r.valid && r.msg, JSON.stringify(r));
  check(`as plain HTML: the label is a thumb’s height (${r.labelH} px)`, r.labelH >= 24 && r.tick);
  const v = await axe(page);
  check('axe on the notice as plain HTML: 0 violations', !v.length, v.join('; '));
  await ctx.close();
}

// ── Konkani follows the page's language, in both scripts ──
{
  const { ctx, page } = await open(DEMO);
  const k = await page.evaluate(() => ['n-deva', 'n-latn'].map(id => {
    const el = document.getElementById(id);
    return { id, heading: el.querySelector('.sg-consent-heading').textContent, check: el.querySelector('label').textContent.trim().slice(0, 40), blanks: [...el.querySelectorAll('.sg-consent-blank')].map(b => `${b.lang || '-'}`).join(), needed: el.querySelector('sg-field-note').getAttribute('data-value-missing').slice(0, 30), text: el.textContent };
  }));
  check('Devanagari: the heading and the box are the deck’s Konkani', k[0].heading === 'तुमच्या तपशीलांचें आमी कितें करतात' && k[0].check.startsWith('म्हज्या तपशीलांचो'), `${k[0].heading} | ${k[0].check}`);
  check('Romi: the heading and the box are the deck’s Romi, with no Devanagari anywhere', k[1].heading === 'Tumchea topxilanchem ami kitem kortat' && !/[ऀ-ॿ]/.test(k[1].text), `${k[1].heading}`);
  check('the Konkani notice’s placeholders are all English and marked lang="en", the complaint line included', k[0].blanks.length > 0 && k[0].blanks.split(',').every(b => b === 'en'), k[0].blanks);
  check('the Konkani "please tick" message is carried by the note', k[0].needed.startsWith('पुडें वचपाक') && k[1].needed.startsWith('Pudem vachpak'), `${k[0].needed} | ${k[1].needed}`);
  await ctx.close();
}

// ── the three registers: what is drawn, where, and that a click gets through it ──
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}`, { width: 390, height: 900, touch: true });
  await page.waitForFunction(r => document.getElementById('r-' + r)?.dataset.skin === r && (r === 'quiet' || document.querySelector('#r-' + r + ' .sg-consent-deco svg')), register, { timeout: 8000 }).catch(() => {}); // the skin is a lazy import: wait for it, not for the clock
  await settle(page);
  const m = await page.evaluate(id => {
    const el = document.getElementById(id); el.scrollIntoView({ block: "center" }); const r = e => { const x = e.getBoundingClientRect(); return { top: +x.top.toFixed(1), bottom: +x.bottom.toFixed(1), left: +x.left.toFixed(1), right: +x.right.toFixed(1), w: +x.width.toFixed(1), h: +x.height.toFixed(1) }; };
    const host = r(el), tick = r(el.querySelector('.sg-consent-tick')), label = r(el.querySelector('label')), box = el.querySelector('input'), deco = el.querySelector('.sg-consent-deco');
    const frame = el.querySelector('.sg-consent-frame'), ticket = el.querySelector('.sg-consent-ticket');
    const c = label; const hit = document.elementFromPoint(c.left + c.w / 2, c.top + c.h / 2);
    return {
      skin: el.dataset.skin, host, tick, label, deco: !!deco, decoHidden: deco?.getAttribute('aria-hidden') === 'true', frame: frame ? r(frame) : null, ticket: ticket ? r(ticket) : null,
      paths: el.querySelectorAll('.sg-consent-deco path').length, bites: [...(ticket?.querySelectorAll('circle') ?? [])].map(x => [+x.getAttribute('cx'), +x.getAttribute('cy')]),
      perf: ticket?.querySelector('.perf')?.getAttribute('d'), clickThrough: !!hit && !hit.closest('.sg-consent-deco') && (!deco || getComputedStyle(deco).pointerEvents === 'none'), boxPx: Math.round(box.getBoundingClientRect().width),
    };
  }, `r-${register}`);
  check(`${register}: its skin is mounted`, m.skin === register, m.skin);
  check(`${register}: the drawing, if there is one, is hidden from assistive technology`, !m.deco || m.decoHidden);
  check(`${register}: the drawing lets a click through, and a click in the middle of the label reaches the label`, m.clickThrough);
  check(`${register}: the label is a thumb’s height (${m.label.h} px) and spans the notice (${m.label.w} of ${m.host.w} px)`, m.label.h >= 44 && m.label.w >= m.host.w - 80);
  if (register === 'quiet') check('quiet: no drawing, a hairline', !m.frame && !m.ticket);
  if (register === 'warm') check(`warm: four pencil strokes drawn over the notice, the frame as big as the notice (${m.frame?.w} by ${m.frame?.h} of ${m.host.w} by ${m.host.h})`, m.paths === 4 && m.decoHidden && Math.abs(m.frame.w - m.host.w) <= 1 && Math.abs(m.frame.h - m.host.h) <= 1);
  if (register === 'playful') {
    const y = m.bites[0]?.[1];
    check(`playful: a bite out of each side at the tear line (y ${y}), which sits between the words and the box (words end above ${m.tick.top - m.host.top}, the tear at ${y})`, m.paths === 2 && m.bites.length === 2 && y > 0 && y < m.tick.top - m.host.top + 1 && y > m.tick.top - m.host.top - 24 && m.bites[0][0] === 0 && m.bites[1][0] === Math.round(m.host.w), JSON.stringify(m.bites));
    check('playful: the perforation runs between the bites', /^M13 [\d.]+ H\d+$/.test(m.perf), m.perf);
  }
  const over = await sidewaysScroll(page, 390);
  check(`${register}: no sideways scroll at 390 px (${over.overflow} px)`, over.overflow === 0);
  await ctx.close();
}

// ── reduced motion: nothing is animating ──
for (const register of ['warm', 'playful']) {
  const { ctx, page } = await open(`${DEMO}?register=${register}`, { reduced: true });
  const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  check(`${register}, reduced motion: no animation runs, the notice is simply drawn`, running === 0, `${running} running`);
  await ctx.close();
}
{
  // and with motion, the drawing arrives once
  const { ctx, page } = await open(`${DEMO}?register=warm`);
  const fresh = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.dataset.register = 'warm';
    host.innerHTML = '<sg-consent id="fresh" fields="x" purpose="y" period="z" contact="c" site="s" complain="k"></sg-consent>';
    document.body.prepend(host);
    const el = host.firstElementChild;
    await new Promise(r => el.addEventListener('sg-skin', r, { once: true }));
    // the strokes start when the notice is seen (an observer says so, a moment later): wait on that, not on the clock
    let n = 0;
    for (let i = 0; i < 40 && n < 4; i++) { await new Promise(r => setTimeout(r, 50)); n = Math.max(n, el.getAnimations({ subtree: true }).length); }
    host.remove();
    return n;
  });
  check('warm: the four strokes are drawn in when a notice first comes into view', fresh >= 4, `${fresh} animations`);
  await ctx.close();
}

// ── axe: the demo in both themes and every register, with the error showing, ──
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
  await page.click('#enquiry .send');
  await page.waitForTimeout(200);
  const open1 = await axe(page);
  check(`axe, ${theme}, with the "please tick" note showing: 0 violations`, !open1.length, open1.join('; '));
  check(`${theme}: no page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

await done();
