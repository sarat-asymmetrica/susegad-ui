// End-to-end check of the file-upload recipe with its drop zone: choose by
// keyboard, drop on the zone, what is refused and in whose words, bars that
// arrive, and the Received stamp.
//
//   node packages/recipes/file-upload/recipe.check.mjs [--shots]

import fs from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from '../../../tools/serve.mjs';

const shots = process.argv.includes('--shots');
if (shots) fs.mkdirSync('.shots/file-upload', { recursive: true });
const server = await startServer({ quiet: true });
const browser = await chromium.launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const MB = 1024 * 1024;
const jpg = (name, size) => ({ name, mimeType: 'image/jpeg', buffer: Buffer.alloc(size, 255) });

for (const reg of ['quiet', 'warm', 'playful']) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(`${server.url}/packages/recipes/file-upload/index.html?register=${reg}`);
  await p.waitForFunction(() => window.__ready && document.querySelector('#live sg-file-drop')?.skin);
  const live = () => p.evaluate(() => {
    const root = document.getElementById('live');
    return {
      zone: !!root.querySelector('sg-file-drop .sg-file-drop-zone > input[type=file]'),
      ownList: !!root.querySelector('.sg-file-drop-list, .sg-file-drop-note'),
      empty: !!root.querySelector('sg-empty'),
      rows: [...root.querySelectorAll('.upload__row sg-progress')].map(b => b.getAttribute('label')),
      note: root.querySelector('sg-field-note')?.textContent.trim() ?? '',
      stamp: !root.querySelector('.upload__stamp').hidden,
      stampText: root.querySelector('.upload__stamp').textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  let s = await live();
  check(`${reg}: the picker is a drop zone around the real input, and the session keeps the list`, s.zone && !s.ownList && s.empty, JSON.stringify(s));

  // keyboard: Tab from the samples button reaches the input. In quiet, Space opens the chooser.
  // (Headless Chromium drops the file chooser while the main thread is saturated, as it is
  // while Paus loads and warms up in warm and playful; the same happens on the plain FileDrop
  // demo with 30 ms of busy work a frame. So there the files go to the same input directly,
  // and file-drop.check.mjs covers Space in every register on a quiet page.)
  await p.focus('#samples');
  await p.keyboard.press('Tab');
  const focused = await p.evaluate(() => document.activeElement.type);
  const files = [jpg('veranda.jpg', 0.6 * MB), jpg('drone-flyover.jpg', 11 * MB)];
  if (reg === 'quiet') {
    const chooser = p.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
    await p.keyboard.press('Space');
    const fc = await chooser;
    check(`${reg}: Tab reaches the input in the zone, and Space opens the file chooser`, focused === 'file' && !!fc, `${focused} / ${!!fc}`);
    if (fc) await fc.setFiles(files);
  } else {
    check(`${reg}: Tab reaches the input in the zone`, focused === 'file', focused);
    await p.setInputFiles('#live sg-file-drop input[type=file]', files);
  }
  await p.waitForTimeout(100);
  const posted = await p.evaluate(() => document.querySelector('#live .sg-post-lift')?.getAnimations().length ?? 0);
  s = await live();
  check(`${reg}: a file too large is refused in the field note, the rest start uploading`, s.rows.length === 1 && s.rows[0].startsWith('veranda.jpg') && s.note.includes('drone-flyover.jpg') && s.note.includes('over the 10.0 MB limit') && !s.empty, JSON.stringify(s));
  if (reg !== 'quiet') check(`${reg}: the letter is posted when the files are handed over`, posted > 0, `${posted}`);

  // a drop on the zone: the session vets the type, in its own words
  await p.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['x'.repeat(2048)], 'floor-plan.pdf', { type: 'application/pdf' }));
    dt.items.add(new File(['x'], 'setup.exe', { type: 'application/x-msdownload' }));
    const cue = document.querySelector('#live .sg-file-drop-cue');
    for (const type of ['dragenter', 'dragover', 'drop']) cue.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  await p.waitForTimeout(100);
  s = await live();
  check(`${reg}: a drop on the zone adds its files; a wrong type is refused in the recipe's words`, s.rows.length === 2 && s.rows.some(r => r.startsWith('floor-plan.pdf')) && s.note.includes("setup.exe isn't a photo or a PDF"), JSON.stringify(s));
  if (shots) await p.locator('#live').screenshot({ path: `.shots/file-upload/${reg}-uploading.png` });

  // the bars arrive, then the stamp
  await p.waitForFunction(() => !document.querySelector('#live .upload__stamp').hidden, null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(800); // the stamp lands, then its words settle
  s = await live();
  check(`${reg}: every file arrives and the Received stamp lands`, s.stamp && /2 files/.test(s.stampText ?? ''), JSON.stringify(s));
  if (shots) await p.locator('#live').screenshot({ path: `.shots/file-upload/${reg}-received.png` });
  check(`${reg}: no console errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`${results.length - failed}/${results.length} file-upload checks pass`);
process.exit(failed ? 1 : 0);
