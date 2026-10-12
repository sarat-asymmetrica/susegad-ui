// Browser checks for the member-directory recipe: the gate (no JavaScript: the
// full list shows, unfiltered, and it says so), then the filter walk with
// JavaScript: a word against name, role and building, tracks alone and
// together, the shareable query in the address and read back on load, the
// count, the empty state, axe, and phone width. Each probe runs once on a
// state that fails, so the probes can fail.
//
//   node packages/recipes/member-directory/recipe.check.mjs

import { harness, settle } from '../../../tools/lib/component-check.mjs';
import { sidewaysScroll } from '../../../tools/lib/overflow.mjs';

const { server, browser, engine, check, open, axe, done } = await harness();
const PAGE = '/packages/recipes/member-directory/index.html';

const read = page => page.evaluate(() => {
  const root = document.getElementById('directory');
  return {
    shown: [...root.querySelectorAll('.sg-directory-list sg-person-card')].map(c => ({ name: c.querySelector('h3, h2')?.textContent ?? '', hidden: c.hidden, track: c.getAttribute('data-track') })),
    count: root.querySelector('.sg-directory-count')?.textContent ?? '',
    emptyShown: !root.querySelector('.sg-directory-empty')?.hidden,
    shareShown: !root.querySelector('.sg-directory-share')?.hidden,
    query: location.search,
  };
});
const type = async (page, text) => { await page.fill('#q', text); await page.waitForTimeout(80); };

// ── the gate: no JavaScript ─────────────────────────────────────────────
{
  const { ctx, page, errors } = await open(`${PAGE}?register=quiet`, { js: false });
  const r = await page.evaluate(() => {
    const root = document.getElementById('directory');
    const hidden = e => e.hidden || e.getClientRects().length === 0;
    return {
      cards: root.querySelectorAll('.sg-directory-list sg-person-card').length,
      noneHidden: [...root.querySelectorAll('.sg-directory-list sg-person-card')].every(c => !c.hidden),
      reads: [...root.querySelectorAll('.sg-directory-list sg-person-card')].every(c => c.querySelector('h3') && c.querySelector('.sg-person-role') && c.querySelector('.sg-person-building') && c.querySelector('a')),
      field: !!root.querySelector('#q') && !hidden(root.querySelector('#q')),
      note: root.querySelector('.sg-directory-note')?.textContent ?? '',
    };
  });
  check('no JS: all 7 cards show, unfiltered, and each reads (name, role, building, link)', r.cards === 7 && r.noneHidden && r.reads, JSON.stringify(r));
  check('no JS: the field is still there, and the note says the filters do nothing', r.field && r.note.startsWith('Without JavaScript the filters do nothing'), r.note);
  check('no JS: no console or page errors', !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── the filter walk ─────────────────────────────────────────────────────
for (const register of ['quiet', 'warm', 'playful']) {
  const { ctx, page, errors } = await open(`${PAGE}?register=${register}`);
  await settle(page);
  const at = () => read(page);

  check(`${register}: the page opens on all 7 and the count says so`, (await at()).count === 'Showing 7 members' && !(await at()).emptyShown, (await at()).count);

  // a word against a name, a role and a building line
  await type(page, 'Priyanka');
  let r = await at();
  check(`${register}: a name keeps only its person`, r.shown.filter(c => !c.hidden).map(c => c.name).join() === 'Priyanka Naik' && r.count === 'Showing 1 member', r.count);
  await type(page, 'nurse');
  r = await at();
  check(`${register}: a word from a role line matches Deepa Shirodkar`, r.shown.filter(c => !c.hidden).map(c => c.name).join() === 'Deepa Shirodkar', JSON.stringify(r.shown.filter(c => !c.hidden)));
  await type(page, 'storybook');
  r = await at();
  check(`${register}: a word from the building line matches Priyanka Naik`, r.shown.filter(c => !c.hidden).map(c => c.name).join() === 'Priyanka Naik', JSON.stringify(r.shown.filter(c => !c.hidden)));

  // two words must both match
  await type(page, 'priyanka aldona');
  r = await at();
  check(`${register}: two words that match one person keep her; a third person's word drops her`, false === r.emptyShown && r.shown.filter(c => !c.hidden).length === 1, r.count);
  await type(page, 'priyanka fisherman');
  r = await at();
  check(`${register}: two words that match different people leave nobody, and the empty state says the two fixes`, r.emptyShown && r.shown.every(c => c.hidden) && (await page.textContent('.sg-directory-empty')).includes('Try a shorter word, or a different track'), await page.textContent('.sg-directory-empty'));

  // accents folded
  await page.fill('#q', '');
  await type(page, 'fernandés');
  r = await at();
  check(`${register}: "fernandés" with the accent finds Melwyn Fernandes`, r.shown.filter(c => !c.hidden).map(c => c.name).join() === 'Melwyn Fernandes', r.count);

  // the query in the address, and reading it back on load
  await type(page, 'tide');
  r = await at();
  const shared = new URL(page.url()).search;
  check(`${register}: the address carries the filter`, shared.includes('q=tide'), shared);
  const { ctx: c2, page: p2 } = await open(`${PAGE}?register=${register}&${shared.slice(1)}`);
  const r2 = await read(p2);
  const filled = await p2.inputValue('#q');
  check(`${register}: opening the shared address prefills the field and the list`, filled === 'tide' && r2.shown.filter(x => !x.hidden).map(x => x.name).join() === 'Roque Barros', `field "${filled}", list ${JSON.stringify(r2.shown.filter(x => !x.hidden).map(x => x.name))}`);

  // the tracks
  await p2.fill('#q', '');
  await p2.click('input[name="track"][value="Tech for Good"]');
  await p2.waitForTimeout(120);
  const tracks = await read(p2);
  check(`${register}: one track keeps only its members`, tracks.shown.filter(x => !x.hidden).map(x => x.track).every(t => t === 'Tech for Good') && tracks.shown.filter(x => !x.hidden).length === 2, tracks.count);
  check(`${register}: the address carries the track, and the share note shows`, new URL(p2.url()).search.includes('track=Tech') && tracks.shareShown, new URL(p2.url()).search);
  await p2.click('input[name="track"][value="AI for Kids"]');
  await p2.waitForTimeout(120);
  const two = await read(p2);
  check(`${register}: two tracks keep both sets`, two.shown.filter(x => !x.hidden).length === 3 && new Set(two.shown.filter(x => !x.hidden).map(x => x.track)).size === 2, two.count);
  // untick and the whole list returns
  await p2.click('input[name="track"][value="Tech for Good"]');
  await p2.click('input[name="track"][value="AI for Kids"]');
  await p2.waitForTimeout(120);
  check(`${register}: unticking both returns all 7 and the share note goes`, (await read(p2)).count === 'Showing 7 members' && !(await read(p2)).shareShown, (await read(p2)).count);
  // a track and a word together narrow
  await p2.click('input[name="track"][value="Workshops for Founders"]');
  await p2.fill('#q', 'pricing');
  await p2.waitForTimeout(120);
  check(`${register}: a track and a word narrow together`, (await read(p2)).shown.filter(x => !x.hidden).map(x => x.name).join() === "Fernanda D'Souza", (await read(p2)).count);

  // axe over the filtered state (open state, not only the rest state)
  const v = await axe(p2);
  check(`${register}: axe on a filtered page (and its empty sibling): 0 violations`, !v.length, v.join('; '));
  await c2.close();

  check(`${register}: no console or page errors`, !errors.length, errors.join(' | '));
  await ctx.close();
}

// ── the empty state probe can fail: the unfiltered page ────────────────
{
  const { ctx, page } = await open(`${PAGE}?register=quiet`);
  check('control: unfiltered, the empty state is hidden, so the empty-state probe above can fail', await page.evaluate(() => document.querySelector('.sg-directory-empty').hidden));
  await ctx.close();
}

// ── phone width ────────────────────────────────────────────────────────
{
  const { ctx, page, errors } = await open(`${PAGE}?register=warm`, { width: 390, height: 844 });
  await settle(page);
  const { scrollWidth: w } = await sidewaysScroll(page, 390);
  check('at 390 px the directory does not scroll sideways', w <= 390, `${w}`);
  check('at 390 px the directory raises no console errors', !errors.length, errors.join(' | '));
  await page.screenshot({ path: '.shots/member-directory/phone-390-warm.png' });
  await ctx.close();
}

await done();
