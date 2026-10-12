// Browser check: a strict Content-Security-Policy (style-src 'self') must find nothing to block.
//
//   node packages/core/csp.check.mjs
//
// A blank page is served with `Content-Security-Policy: style-src 'self'`. It loads <sg-scene> with a
// scene (vaati), with the movable-words grip and slotted words, and a component (sg-badge). The check
// fails on any CSP violation (the securitypolicyviolation event or a console error), and also checks
// the frame CSS really applied, so a scene whose styles were silently dropped cannot pass.
// It fails on main before the constructable-stylesheet fix (docs/requests/2026-10-04-food-site.md, section 5).

import { pickEngine } from '../../tools/lib/engine.mjs';
import { startServer } from '../../tools/serve.mjs';

const server = await startServer({ quiet: true });
const browser = await pickEngine().launch();
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };

const p = await browser.newPage();
const errors = [];
p.on('pageerror', e => errors.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await p.route('**/tools/harness/blank.html', async route => {
  const r = await route.fetch();
  await route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': "style-src 'self'" } });
});
await p.addInitScript(() => {
  window.__violations = [];
  document.addEventListener('securitypolicyviolation', e => window.__violations.push(`${e.violatedDirective}: ${e.blockedURI || 'inline'}`));
});
await p.goto(`${server.url}/tools/harness/blank.html`);

const out = await p.evaluate(async () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/packages/components/badge/badge.css';
  document.head.append(link);
  await import('/packages/core/index.js');
  await import('/packages/scenes/vaati/index.js');
  await import('/packages/components/badge/badge.js');
  const scene = document.createElement('sg-scene');
  scene.setAttribute('name', 'vaati'); scene.setAttribute('movable', ''); scene.setAttribute('register', 'warm'); scene.setAttribute('progress', '0.5');
  scene.innerHTML = '<h2>Your order</h2><p>Being made.</p>';
  const badge = document.createElement('sg-badge');
  badge.textContent = 'New';
  document.body.append(scene, badge);
  await new Promise(r => { const t = setTimeout(r, 8000); scene.addEventListener('sg-ready', () => { clearTimeout(t); r(); }, { once: true }); });
  await new Promise(r => setTimeout(r, 600)); // the movable module loads after the scene mounts
  // a light-DOM root (the veranda stage hands movable.attach itself, not a shadow root)
  const { adopt } = await import('/packages/core/sheet.js');
  const host = document.createElement('div'); host.className = 'sg-csp-light'; document.body.append(host);
  adopt(host, '.sg-csp-light{outline:3px solid red}');
  adopt(host, '.sg-csp-light{outline:3px solid red}');
  const frame = scene.shadowRoot.querySelector('.frame');
  return {
    lightStyled: getComputedStyle(host).outlineWidth === '3px',
    lightStyles: host.querySelectorAll('style').length,
    docAdopted: document.adoptedStyleSheets.filter(s => [...s.cssRules].some(r => r.selectorText === '.sg-csp-light')).length,
    frameGrid: getComputedStyle(frame).display === 'grid',
    stageRatio: scene.shadowRoot.querySelector('.stage').getBoundingClientRect().width > 0,
    gripStyled: !!scene.shadowRoot.querySelector('.grip') && getComputedStyle(scene.shadowRoot.querySelector('.grip')).position !== 'static',
    styleElements: scene.shadowRoot.querySelectorAll('style').length,
    adopted: scene.shadowRoot.adoptedStyleSheets.length,
    violations: window.__violations,
  };
});
await p.waitForTimeout(300);
const violations = [...out.violations, ...(await p.evaluate(() => window.__violations))].filter((v, i, a) => a.indexOf(v) === i);
check('no CSP violation under style-src \'self\' (event)', violations.length === 0, violations.join(' | '));
check('no CSP error in the console', !errors.some(e => /Content Security Policy|violates|style-src/i.test(e)), errors.join(' | '));
check('the scene\'s frame CSS applied (the frame is a grid)', out.frameGrid);
check('the movable grip is styled', out.gripStyled);
check('the scene holds no <style> element when adoptedStyleSheets exists', out.styleElements === 0 && out.adopted >= 1, `${out.styleElements} <style>, ${out.adopted} adopted`);
check('a light-DOM root adopts onto its document, once, with no <style> (the veranda stage’s movable grip)', out.lightStyled && out.lightStyles === 0 && out.docAdopted === 1, `styled ${out.lightStyled}, ${out.lightStyles} <style>, adopted on the document ${out.docAdopted}x`);
check('no other console errors', errors.length === 0, errors.join(' | '));

await browser.close(); await server.close();
if (results.some(r => !r.ok)) process.exit(1);
