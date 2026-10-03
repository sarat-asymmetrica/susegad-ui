// Browser checks for the file drop: the no-JavaScript path, the keyboard, drops,
// what gets turned away and why, and that the form really sends the files.
//
//   node packages/components/file-drop/file-drop.check.mjs [--shots]

import fs from 'node:fs';
import { pickEngine } from '../../../tools/lib/engine.mjs';
import { startServer } from '../../../tools/serve.mjs';

const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots/file-drop', { recursive: true });
const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const PAGE = reg => `${server.url}/packages/components/file-drop/demo.html?register=${reg}`;
const pdf = (name, size = 2048) => ({ name, mimeType: 'application/pdf', buffer: Buffer.alloc(size, 37) });
const jpg = (name, size = 4096) => ({ name, mimeType: 'image/jpeg', buffer: Buffer.alloc(size, 255) });

/** Catch the form's POST and read the file names from the multipart body. */
async function catchPost(p) {
  let sent = null;
  await p.route('**/demo.html', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataBuffer()?.toString('latin1') ?? '';
    sent = [...body.matchAll(/name="([^"]+)"; filename="([^"]*)"/g)].map(m => `${m[1]}=${m[2]}`);
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Sent</title><h1>Sent</h1>' });
  });
  return () => sent;
}

// ── Without JavaScript ──
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  const sent = await catchPost(p);
  await p.goto(PAGE('quiet'));
  check('no JS: the native file inputs show, with their labels', await p.locator('#plans').isVisible() && await p.locator('#id').isVisible());
  await p.click('button[type=submit]');
  await p.waitForTimeout(200);
  check('no JS: a required file stops the form natively', sent() === null);
  await p.setInputFiles('#plans', [pdf('ground-floor.pdf'), jpg('garden.jpg')]);
  await p.setInputFiles('#id', jpg('passport.jpg'));
  if (shots) await p.screenshot({ path: '.shots/file-drop/no-js.png', fullPage: true });
  await p.click('button[type=submit]');
  await p.waitForLoadState();
  check('no JS: the form sends the files', JSON.stringify(sent()) === JSON.stringify(['plans=ground-floor.pdf', 'plans=garden.jpg', 'id=passport.jpg']), JSON.stringify(sent()));
  await ctx.close();
}

// ── With JavaScript, in each register ──
for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const sent = await catchPost(p);
  await p.goto(PAGE(reg));
  await p.waitForFunction(() => window.__ready && [...document.querySelectorAll('sg-file-drop')].every(d => d.skin));
  const read = id => p.evaluate(i => {
    const d = document.getElementById(i).closest('sg-file-drop');
    return { files: [...d.querySelectorAll('.sg-file-drop-name')].map(n => n.textContent), sizes: [...d.querySelectorAll('.sg-file-drop-size')].map(n => n.textContent), note: d.querySelector('.sg-file-drop-note').textContent, focus: document.activeElement.id || document.activeElement.getAttribute('aria-label') || document.activeElement.tagName, count: document.getElementById(i).files.length };
  }, id);

  // keyboard: Tab reaches the input itself, and Space opens the chooser
  await p.keyboard.press('Tab');
  const focused = await p.evaluate(() => document.activeElement.id);
  const ring = await p.evaluate(() => getComputedStyle(document.querySelector('.sg-file-drop-zone')).outlineStyle);
  const chooser = p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null);
  await p.keyboard.press('Space');
  const fc = await chooser;
  check(`${reg}: Tab reaches the real input, the zone shows focus, Space opens the chooser`, focused === 'plans' && ring !== 'none' && !!fc, `${focused} / ${ring} / ${!!fc}`);
  if (fc) await fc.setFiles([pdf('ground-floor.pdf', 2.4 * 1024 * 1024)]);
  await p.waitForTimeout(50);
  const posted = await p.evaluate(() => document.querySelector('.sg-post-lift')?.getAnimations().length ?? 0);
  if (shots && reg !== 'quiet') { await p.waitForTimeout(reg === 'warm' ? 380 : 360); await p.locator('.sg-file-drop-zone').first().screenshot({ path: `.shots/file-drop/${reg}-posting.png` }); }
  let s = await read('plans');
  check(`${reg}: a chosen file is listed with its size`, s.files[0] === 'ground-floor.pdf' && s.sizes[0] === '2.4 MB' && s.note === '1 file chosen', JSON.stringify(s));

  // a drop on the zone, outside the input, lands in the input; a wrong type is turned away
  await p.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'first-floor.pdf', { type: 'application/pdf' }));
    dt.items.add(new File(['x'], 'setup.exe', { type: 'application/x-msdownload' }));
    const zone = document.querySelector('.sg-file-drop-zone');
    const cue = zone.querySelector('.sg-file-drop-cue');
    for (const type of ['dragenter', 'dragover', 'drop']) cue.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await p.waitForTimeout(50);
  s = await read('plans');
  check(`${reg}: a drop lands in the input; a wrong type is turned away, and said why`, s.count === 1 && s.files[0] === 'first-floor.pdf' && s.note.includes('setup.exe isn’t a PDF or JPG, so it wasn’t added.'), JSON.stringify(s));
  if (shots) await p.screenshot({ path: `.shots/file-drop/${reg}-dropped.png` });

  // too big, and too many for a single input
  await p.setInputFiles('#plans', [pdf('ground-floor.pdf'), pdf('huge-scan.pdf', 11 * 1024 * 1024), jpg('garden.jpg')]);
  s = await read('plans');
  check(`${reg}: a file over the limit is turned away`, s.count === 2 && s.note.includes('huge-scan.pdf is over 10 MB'), JSON.stringify(s));
  await p.setInputFiles('#id', [jpg('passport.jpg'), jpg('licence.jpg')]).catch(() => {}); // not multiple: Playwright refuses two
  await p.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'passport.jpg', { type: 'image/jpeg' }));
    dt.items.add(new File(['x'], 'licence.jpg', { type: 'image/jpeg' }));
    const input = document.getElementById('id');
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  s = await read('id');
  check(`${reg}: a single-file box keeps the first of several, and says so`, s.count === 1 && s.files[0] === 'passport.jpg' && s.note.includes('Only one file can go here'), JSON.stringify(s));

  // remove, by keyboard
  await p.focus('[aria-label="Remove ground-floor.pdf"]');
  await p.keyboard.press('Enter');
  s = await read('plans');
  check(`${reg}: Remove takes the file out and keeps focus in the list`, s.count === 1 && s.files[0] === 'garden.jpg' && s.note.includes('ground-floor.pdf removed.') && s.focus === 'Remove garden.jpg', JSON.stringify(s));

  // the form sends what is listed
  await p.click('button[type=submit]');
  await p.waitForLoadState();
  await p.waitForTimeout(100);
  check(`${reg}: the form sends exactly the files listed`, JSON.stringify(sent()) === JSON.stringify(['plans=garden.jpg', 'id=passport.jpg']), JSON.stringify(sent()));
  check(`${reg}: no console errors`, errors.length === 0, errors.join(' | '));
  if (reg !== 'quiet') check(`${reg}: the letter is posted when a file is kept`, posted > 0, `${posted} animations on the letter`);
  await ctx.close();
}

// ── Required, with JavaScript: the hidden-looking input still stops the form ──
{
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const sent = await catchPost(p);
  await p.goto(PAGE('warm'));
  await p.waitForFunction(() => window.__ready);
  await p.click('button[type=submit]');
  await p.waitForTimeout(200);
  const focus = await p.evaluate(() => document.activeElement.id);
  check('required: the form waits for the photo ID, and focus goes to it', sent() === null && focus === 'id' && errors.length === 0, `${focus} ${errors.join(' | ')}`);
  await ctx.close();
}

// ── Reduced motion: states change, nothing animates ──
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(PAGE('playful'));
  await p.waitForFunction(() => window.__ready && document.querySelector('sg-file-drop').skin);
  await p.setInputFiles('#plans', [pdf('plan.pdf')]);
  const running = await p.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  check('reduced motion: a file is listed, and nothing animates', running === 0, `${running} running`);
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} file-drop checks pass`);
process.exit(failed ? 1 : 0);
