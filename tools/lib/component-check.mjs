// Shared glue for component browser checks (*.check.mjs): a server, a browser,
// a pass/fail printer, axe with the WCAG 2.2 AA tags (with and without
// JavaScript), and pages built from a string. Added for the studio-site batch
// (docs/requests/2026-09-27-studio-site-components.md); older checks inline
// the same few lines.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { startServer } from '../serve.mjs';
import { contextOptions, engineName, pickEngine } from './engine.mjs';

export const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const AXE = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

export async function harness() {
  const server = await startServer({ quiet: true });
  const engine = engineName();
  const browser = await pickEngine(engine).launch();
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: !!ok });
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  };
  /** A page at `path` (query string allowed), waited on window.__ready when it declares one. */
  async function open(path, { width = 1280, height = 900, js = true, reduced = false, touch = false, errors = [] } = {}) {
    const ctx = await browser.newContext(contextOptions(engine, {
      viewport: { width, height }, javaScriptEnabled: js, reducedMotion: reduced ? 'reduce' : 'no-preference',
      hasTouch: touch, isMobile: touch, permissions: ['clipboard-read', 'clipboard-write'],
    }));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${server.url}${path}`);
    if (js) await page.waitForFunction(() => window.__ready !== false, null, { timeout: 10000 }).catch(() => errors.push('never ready'));
    return { ctx, page, errors };
  }
  /** Serve `html` at `/__check/<name>.html` for the rest of the run and open it. */
  async function openHtml(name, html, opts = {}) {
    const path = `/__check/${name}.html`;
    const errors = opts.errors ?? [];
    const ctx = await browser.newContext(contextOptions(engine, {
      viewport: { width: opts.width ?? 1280, height: opts.height ?? 900 }, javaScriptEnabled: opts.js ?? true,
      reducedMotion: opts.reduced ? 'reduce' : 'no-preference', hasTouch: !!opts.touch, isMobile: !!opts.touch,
      permissions: ['clipboard-read', 'clipboard-write'],
    }));
    await ctx.route(`**${path}`, r => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${server.url}${path}`);
    return { ctx, page, errors };
  }
  /** axe violations on the page as it stands, as "rule (n)" strings. */
  async function axe(page) {
    await page.addScriptTag({ content: AXE });
    return page.evaluate(async tags => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags } })).violations.map(v => `${v.id} (${v.nodes.length}: ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', ')})`), WCAG);
  }
  /**
   * axe on the page a browser without JavaScript builds: the DOM is taken with
   * JavaScript off, then checked in a scripted copy with the scripts removed.
   */
  async function axeNoJs(path, opts = {}) {
    const { ctx, page } = await open(path, { ...opts, js: false });
    await page.waitForLoadState('load');
    const html = await page.evaluate(() => { document.querySelectorAll('script').forEach(s => s.remove()); return '<!doctype html>' + document.documentElement.outerHTML; });
    await ctx.close();
    const copy = await openHtml(`nojs-${Math.random().toString(36).slice(2)}`, html.replace('<head>', `<head><base href="${server.url}${path.replace(/[^/]*$/, '')}">`), { ...opts, js: true });
    await copy.page.waitForLoadState('load');
    const v = await axe(copy.page);
    await copy.ctx.close();
    return v;
  }
  async function done() {
    await browser.close();
    await server.close?.();
    const failed = results.filter(r => !r.ok).length;
    console.log(failed ? `${failed} of ${results.length} checks failed` : `all ${results.length} checks pass`);
    process.exit(failed ? 1 : 0);
  }
  return { server, browser, engine, check, open, openHtml, axe, axeNoJs, done };
}

/** Every animation on the page, settled. */
export const settle = page => page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
