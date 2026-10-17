import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageUrl, sitemapXml } from './sitemap.core.js';

test('a page file is the URL it is served at', () => {
  assert.equal(pageUrl('index.html'), 'https://susegad.asymmetrica.ai/');
  assert.equal(pageUrl('showcase.html'), 'https://susegad.asymmetrica.ai/showcase');
  assert.equal(pageUrl('components\\badge.html'), 'https://susegad.asymmetrica.ai/components/badge');
  assert.equal(pageUrl('gom-deva/index.html'), 'https://susegad.asymmetrica.ai/gom-deva/');
});

test('the sitemap lists the site pages once each, sorted, and leaves out the 404, offline pages and library files', () => {
  const xml = sitemapXml(['index.html', 'showcase.html', 'showcase.html', '404.html', 'templates/event/site/offline.html', 'packages/components/badge/demo.html', 'templates/event/site/susegad/recipes/agenda/index.html', 'scenes/paus.html', 'llms.txt']);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(locs, ['https://susegad.asymmetrica.ai/', 'https://susegad.asymmetrica.ai/scenes/paus', 'https://susegad.asymmetrica.ai/showcase']);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
});
