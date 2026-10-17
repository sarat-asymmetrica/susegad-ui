import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOWCASE, HOME_SHOWCASE, showcaseGroups, showcasePage, teamsPage, developersPage, agentPrompt, plain, homeShowcase } from './audience.core.js';
import { W } from './words.core.js';
import { bar } from './site.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'registry', 'registry.json'), 'utf8'));
const info = item => ({ poster: { w: 640, h: 400 }, demo: `/packages/recipes/${item.name}/index.html`, pageHref: `recipes/${item.name}` });
const shown = registry.items.filter(i => i.type === 'recipe' || i.type === 'template');

test('the showcase lists every recipe and template in the registry, each once', () => {
  const names = showcaseGroups(registry.items).flatMap(g => g.items.map(i => i.name));
  assert.deepEqual([...names].sort(), shown.map(i => i.name).sort());
  const html = showcasePage(registry.items, info);
  for (const i of shown) assert.ok(html.includes(`recipes/${i.name}"`), i.name);
});

test('a recipe the table does not name still shows, in a group of its own', () => {
  const extra = { name: 'new-thing', type: 'recipe', title: 'New thing', description: 'A new page. More words.' };
  const groups = showcaseGroups([...registry.items, extra]);
  assert.equal(groups.at(-1).key, 'more');
  assert.deepEqual(groups.at(-1).items.map(i => i.name), ['new-thing']);
  assert.equal(plain(extra).line, 'A new page.', 'its line is the first sentence of its description');
});

test('every name in the showcase table and the home strip is a real piece, with plain words of its own', () => {
  const names = new Set(shown.map(i => i.name));
  for (const g of SHOWCASE) for (const n of g.items) { assert.ok(names.has(n), n); assert.ok(W.audience.pieces[n], `${n} has plain words`); }
  for (const n of HOME_SHOWCASE) assert.ok(SHOWCASE.some(g => g.items.includes(n)), n);
  for (const g of [...SHOWCASE.map(g => g.key), 'more']) assert.ok(W.audience.show.groups[g], g);
});

test('the words to paste into an agent name the piece and the site, and keep the brackets to fill in', () => {
  const booking = registry.items.find(i => i.name === 'booking');
  const p = agentPrompt(booking);
  assert.match(p, /starting from its booking recipe\./);
  assert.match(p, /explain in plain words how I can put it online/, 'a reader without code is told how to publish');
  assert.match(agentPrompt(registry.items.find(i => i.name === 'template-event')), /its template-event template\./, 'a template is called a template');
  assert.match(p, /https:\/\/susegad\.asymmetrica\.ai\/llms\.txt/);
  assert.match(p, /\[my place and my details\]/);
  assert.doesNotMatch(p, /\{[a-z]+\}/, 'every slot is filled');
  const html = homeShowcase(registry.items, info, shown.length);
  assert.match(html, /data-copy-text="Make me /);
  assert.equal((html.match(/class="show-card"/g) || []).length, HOME_SHOWCASE.length);
});

// The first reader is someone who wants a page. Above the first link to the developer's door, their pages use none of
// the library's own vocabulary (request front-door-4, gate 3).
const JARGON = /\b(registers?|headless|primitives?|tokens?|kernels?|registry|CLI|MCP|npx|custom elements?)\b/i;
// What a reader sees or hears: the text, and the names a screen reader reads out (aria-label), without the markup.
const visibleText = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/ data-copy-text="[^"]*"/g, '')
  .replace(/aria-label="([^"]*)"/g, '> $1 <').replace(/<[^>]+>/g, ' ');
const beforeDevDoor = html => { const i = html.search(/href="(\.\/)?developers(#[^"]*)?"/); return i < 0 ? html : html.slice(0, i); };
// The header is on every page, so all of it counts (its own Developers link is not a door into the developer's words);
// the page's main counts up to its first link to the developer's door.
const firstReaderText = html => {
  const header = html.match(/<header class="bar">[\s\S]*?<\/header>/)?.[0] ?? '';
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
  return visibleText(header) + ' ' + visibleText(beforeDevDoor(main));
};

test('the first reader\'s pages use no library jargon above the developer\'s door, the header included', () => {
  const home = fs.readFileSync(path.join(HERE, 'index.html'), 'utf8').replace(/<header class="bar">[\s\S]*?<\/header>/, () => bar('', 0));
  const pages = { home, showcase: showcasePage(registry.items, info), teams: teamsPage(registry.items, info) };
  for (const [name, html] of Object.entries(pages)) {
    const text = firstReaderText(html);
    const hit = text.match(JARGON);
    assert.equal(hit, null, `${name}: "${hit?.[0]}" near "${hit ? text.slice(Math.max(0, hit.index - 40), hit.index + 40).replace(/\s+/g, ' ') : ''}"`);
  }
});

test('the home page leads with the showcase and the agent, and keeps the developer\'s door on the first screen', () => {
  const home = fs.readFileSync(path.join(HERE, 'index.html'), 'utf8');
  const mast = home.slice(home.indexOf('<section class="mast"'), home.indexOf('</section>', home.indexOf('<section class="mast"')));
  assert.match(mast, /href="showcase">See what it makes</);
  assert.match(mast, /href="start#path-agent">Build it with your agent</);
  assert.match(mast, /href="developers">The developer's door</);
  for (const m of ['site:showcase', 'site:scenes', 'site:doors', 'site:newest']) assert.ok(home.includes(`<!-- ${m}:start -->`), m);
  assert.ok(home.indexOf('id="showcase"') < home.indexOf('id="library"'), 'what it makes comes before what is inside');
});

test('the page for teams has a note a business can send, and it names only public pages', () => {
  const html = teamsPage();
  assert.match(html, /id="developer"/);
  const note = html.match(/<p class="note-text" id="dev-note">([^<]*)<\/p>/)[1];
  for (const p of ['/developers', '/accessibility', '/llms.txt']) assert.ok(note.includes(`https://susegad.asymmetrica.ai${p}`), p);
  assert.match(html, /data-copy="dev-note"/);
});

test('the developer\'s door links every index, the tools and the trust pages', () => {
  const html = developersPage({ scene: 33, component: 61, recipe: 16, template: 1, package: 32, techniques: 24 }, '<section class="ideas"></section>');
  for (const href of ['components', 'recipes', 'templates', 'scenes', 'foundations', 'pencil-box', 'accessibility', 'browsers', 'handoff', 'llms.txt', 'start#path-agent']) {
    assert.ok(html.includes(`href="${href}"`), href);
  }
  assert.match(html, /aria-current="page">Developers</);
});

test('each new page marks itself in the nav', () => {
  assert.match(showcasePage(registry.items, info), /href="showcase" aria-current="page"/);
  assert.match(teamsPage(), /href="for-teams" aria-current="page"/);
  assert.match(developersPage({}, ''), /href="developers" aria-current="page"/);
});

test('the page for teams shows real pages from the showcase beside its words, each a link', () => {
  const html = teamsPage(registry.items, info);
  const pics = html.slice(html.indexOf('<aside class="teams-pics"'), html.indexOf('</aside>'));
  assert.equal((pics.match(/<li>/g) || []).length, 3);
  assert.match(pics, /href="packages\/recipes\/booking\/index\.html"/);
  assert.match(pics, /href="showcase">More in the showcase</);
  assert.doesNotMatch(teamsPage(), /teams-pics/, 'no pictures without the registry');
});
