// The page's half of the offline recipe: register the worker, and after the first visit tell it which
// files the page used so that visit is enough.
//
//   import { registerOffline } from './susegad/recipes/offline/offline.js';
//   registerOffline({ url: 'sw.js', scope: '/' });
//
// It never breaks a page. No service worker in the browser (or one that refuses, as in a private window of
// some browsers), a worker that will not install, a slow network: each leaves the page exactly as it was.
// It runs after the page has loaded and the browser is idle, so it costs the first paint nothing.

import { urlsToKeep } from './offline.core.js';

/**
 * @param {{ url?: string, scope?: string, max?: number }} [opts] url: where the worker file is (default "sw.js", beside the page);
 *   scope: the folder it covers, ending in "/" (default the page's own folder's parent: "/")
 * @returns {Promise<{ registered: boolean, kept: number, why?: string }>}
 */
export async function registerOffline({ url = 'sw.js', scope = '/', max = 120 } = {}) {
  try {
    if (!('serviceWorker' in navigator)) return { registered: false, kept: 0, why: 'this browser has no service workers' };
    if (document.readyState !== 'complete') await new Promise(r => addEventListener('load', r, { once: true }));
    await new Promise(r => (globalThis.requestIdleCallback ? requestIdleCallback(r, { timeout: 2000 }) : setTimeout(r, 200)));
    const reg = await navigator.serviceWorker.register(url, { scope });
    const ready = await navigator.serviceWorker.ready;
    const worker = ready.active ?? reg.active;
    if (!worker) return { registered: true, kept: 0, why: 'no active worker yet' };
    const names = [location.href, ...performance.getEntriesByType('resource').map(e => e.name)];
    const urls = urlsToKeep(names, { origin: location.origin, scope, max });
    worker.postMessage({ type: 'keep', urls });
    return { registered: true, kept: urls.length };
  } catch (e) {
    return { registered: false, kept: 0, why: String(e?.message ?? e) };
  }
}
