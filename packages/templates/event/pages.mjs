#!/usr/bin/env node
// Writes the three pages of the event site from strings.js:
//
//   node pages.mjs            write index.html, gom-deva/index.html and gom-latn/index.html
//   node pages.mjs --check    fail if the pages on disk are not what strings.js would make
//
// Run it from the project folder `susegad create` made. Plain Node, no dependencies, and
// optional: the pages are ordinary files, so a site that edits them by hand never needs it.

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANNER, COPY, DAY, LANGS, REGISTER, SCHEDULE, SCOPE, SITE, SPEAKERS, TICKET_AT, VENUE, EVENT_ID } from './strings.js';
import { strings } from './susegad/core/strings.js';
import { BY_LANG } from './susegad/core/strings.table.js';
import { isKonkani, dayPartWord } from './susegad/core/intl.kok.js';
import { renderConsent } from './susegad/components/consent/consent.core.js';
import { offlinePage } from './susegad/recipes/offline/offline.page.js';
import { kindOf } from './susegad/recipes/offline/offline.core.js';
import { swSource } from './susegad/recipes/offline/build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = s => String(s).replace(/[&<>"]/g, c => ESC[c]);

/** 15:00 is "3 pm" and 10:30 is "10:30 am", the way the agenda says them. A Konkani page says the part of the day first: "सांजे 7:00". */
function clock(hhmm, t, tag) {
  const [h, m] = hhmm.split(':').map(Number);
  const hour = h % 12 || 12;
  if (isKonkani(tag)) return `${dayPartWord(h, tag)} ${hour}:${String(m).padStart(2, '0')}`;
  return `${hour}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? t.am : t.pm}`;
}

const stamp = hhmm => `${DAY}T${hhmm}:00+05:30`;
const shared = tag => strings(BY_LANG, tag);

function sessionHtml(s, c, tag) {
  const t = c.time, speaker = s.speaker && c.speakers[s.speaker];
  const who = speaker ? speaker.name : s.who === 'organisers' ? c.organisers : '';
  const where = [`<span class="sg-session-room">${esc(c.rooms[s.room])}</span>`, s.track ? `<span class="sg-session-track">${esc(c.tracks[s.track])}</span>` : ''].filter(Boolean).join(' ');
  return `        <li class="sg-session" id="${s.id}"${s.kind ? ` data-kind="${s.kind}"` : ''} data-start="${DAY}T${s.start}" data-end="${DAY}T${s.end}">
          <p class="sg-session-time"><time datetime="${stamp(s.start)}">${clock(s.start, t, tag)}</time> ${esc(t.to)} <time datetime="${stamp(s.end)}">${clock(s.end, t, tag)}</time> <abbr title="${esc(t.istFull)}">${esc(t.ist)}</abbr></p>
          <h4 class="sg-session-title">${esc(c.sessions[s.id])}</h4>${who ? `\n          <p class="sg-session-who">${esc(who)}</p>` : ''}
          <p class="sg-session-where">${where}</p>
        </li>`;
}

function speakerHtml(id, c) {
  const p = c.speakers[id], s = SCHEDULE.find(x => x.speaker === id);
  return `      <li><sg-person-card>
        <article aria-labelledby="sp-${id}">
          <h3 id="sp-${id}">${esc(p.name)}</h3>
          <p class="sg-person-role">${esc(p.role)}</p>
          <p class="sg-person-building">${esc(p.line)}</p>
          <p class="sg-person-link"><a href="#${s.id}">${esc(c.sessions[s.id])}</a></p>
        </article>
      </sg-person-card></li>`;
}

export function renderPage(lang) {
  const c = COPY[lang.tag], words = shared(lang.tag), up = lang.folder ? '../' : '';
  const v = c.venue, loc = folder => `${up}${folder ? folder + '/' : ''}index.html`;
  const url = l => `${SITE}/${l.folder ? l.folder + '/' : ''}`;
  const alternates = LANGS.map(l => `<link rel="alternate" hreflang="${l.tag}" href="${url(l)}">`).concat(`<link rel="alternate" hreflang="x-default" href="${url(LANGS[0])}">`);
  const names = { 'en-IN': 'English', 'gom-Deva': 'कोंकणी', 'gom-Latn': 'Konknni' };
  const switcher = LANGS.map(l => `<li><a href="${l.folder === lang.folder ? 'index.html' : loc(l.folder)}" hreflang="${l.tag}" lang="${l.tag}"${l.tag === lang.tag ? ' aria-current="page"' : ''}>${names[l.tag]}</a></li>`).join('\n          ');

  return `<!doctype html>
<html lang="${lang.tag}" data-register="${REGISTER}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.meta.title)}</title>
<meta name="description" content="${esc(c.meta.description)}">
${alternates.join('\n')}
<script src="${up}look.js"></script>
<link rel="stylesheet" href="${up}susegad/tokens/fonts.css">
<link rel="stylesheet" href="${up}susegad/tokens/tokens.css">
<link rel="stylesheet" href="${up}susegad/core/lazy.css">
<link rel="stylesheet" href="${up}susegad/components/banner/banner.css">
<link rel="stylesheet" href="${up}susegad/components/lang/lang.css">
<link rel="stylesheet" href="${up}susegad/components/check/check.css">
<link rel="stylesheet" href="${up}susegad/components/field-note/field-note.css">
<link rel="stylesheet" href="${up}susegad/components/consent/consent.css">
<link rel="stylesheet" href="${up}susegad/components/qr/qr.css">
<link rel="stylesheet" href="${up}susegad/components/ticket/ticket.css">
<link rel="stylesheet" href="${up}susegad/components/person-card/person-card.css">
<link rel="stylesheet" href="${up}susegad/components/site-footer/site-footer.css">
<link rel="stylesheet" href="${up}susegad/recipes/agenda/recipe.css">
<link rel="stylesheet" href="${up}susegad/recipes/speakers/recipe.css">
<link rel="stylesheet" href="${up}susegad/recipes/venue/recipe.css">
<link rel="stylesheet" href="${up}site.css">
<script type="module" src="${up}page.js"></script>
</head>
<body>
<a class="skip" href="#main">${esc(c.skip)}</a>

<sg-banner id="${BANNER.id}" until="${BANNER.until}">${esc(c.banner.text)}</sg-banner>

<header class="bar">
  <p class="brand"><a href="${up}index.html">${esc(c.site.name)}</a></p>
  <nav class="bar-links" aria-label="${esc(words.mainNav)}">
    <a href="#agenda">${esc(c.agenda.heading)}</a>
    <a href="#speakers">${esc(c.speakers.heading)}</a>
    <a href="#register">${esc(c.register.heading)}</a>
    <a href="#venue">${esc(v.heading)}</a>
  </nav>
${LANGS.length < 2 ? '' : `  <sg-lang>
    <nav aria-label="${esc(words.language)}">
      <ul>
          ${switcher}
      </ul>
    </nav>
  </sg-lang>
`}</header>

<main id="main">
  <section class="hero" aria-labelledby="hero-h">
    <div class="hero-words">
      <p class="eyebrow">${esc(c.hero.eyebrow)}</p>
      <h1 id="hero-h">${esc(c.hero.title)}</h1>
      <p class="lede">${esc(c.hero.lede)}</p>
      <p class="hero-links">
        <a class="button" href="#agenda">${esc(c.hero.seeAgenda)}</a>
        <a class="button button-plain" href="#venue">${esc(c.hero.findVenue)}</a>
      </p>
    </div>
    <figure class="hero-picture">
      <!-- The poster is the first paint. The scene is fetched only when it can be seen, and not in the quiet register, under reduced motion or with Save-Data. -->
      <sg-lazy src="${up}susegad/scenes/pahat/index.js">
        <picture>
          <source type="image/avif" srcset="${up}posters/hero.avif">
          <source type="image/webp" srcset="${up}posters/hero.webp">
          <img src="${up}posters/hero.jpg" width="1028" height="686" alt="${esc(c.hero.posterAlt)}" fetchpriority="high" decoding="async">
        </picture>
        <sg-scene name="pahat" seed="1" label="${esc(c.hero.posterAlt)}" hidden></sg-scene>
      </sg-lazy>
      <button type="button" class="button button-plain hero-play" hidden>${esc(c.hero.play)}</button>
    </figure>
  </section>

  <section class="sg-agenda" id="agenda" aria-labelledby="agenda-h">
    <h2 id="agenda-h">${esc(c.agenda.heading)}</h2>
    <p class="sg-agenda-zone">${esc(c.agenda.zone)}</p>
    <section class="sg-agenda-day" aria-labelledby="day1">
      <h3 id="day1"><time datetime="${DAY}">${esc(c.agenda.day)}</time></h3>
      <ol class="sg-agenda-sessions">
${SCHEDULE.map(s => sessionHtml(s, c, lang.tag)).join('\n')}
      </ol>
    </section>
  </section>

  <section class="sg-speakers" id="speakers" aria-labelledby="speakers-h">
    <h2 id="speakers-h">${esc(c.speakers.heading)}</h2>
    <ul class="sg-speakers-list">
${SPEAKERS.map(id => speakerHtml(id, c)).join('\n')}
    </ul>
  </section>

  <!-- data-lat, data-lng and data-name are written once; the page's script makes the two map links from them -->
  <!-- Registration. A valid send fires sg-register ({ name, email }) and never leaves the page; page.js answers it by making the ticket on this device; the consent notice is the library's, and a legal read of it is yours to get before going live -->
  <section class="sg-register" id="register" aria-labelledby="register-h">
    <h2 id="register-h">${esc(c.register.heading)}</h2>
    <p class="lede">${esc(c.register.lede)}</p>
    <sg-ticket id="ticket" event="${esc(c.site.name)}" event-id="${EVENT_ID}" at="${TICKET_AT}"></sg-ticket>
    <form class="sg-register-form" action="#" method="post" data-sample="${esc(c.register.sample)}">
      <p class="sg-register-field"><label for="reg-name">${esc(c.register.name)}</label> <input id="reg-name" name="name" autocomplete="name" required></p>
      <p class="sg-register-field"><label for="reg-email">${esc(c.register.email)}</label> <input id="reg-email" name="email" type="email" autocomplete="email" required></p>
${renderConsent({ lang: lang.tag, id: 'register-consent', values: c.register.consent }).split('\n').map(l => '      ' + l).join('\n')}
      <p><button class="button" type="submit" disabled>${esc(c.register.submit)}</button></p>
      <noscript><p class="sg-register-noscript"${lang.tag.startsWith('en') ? '' : ' lang="en"'}>${esc(c.register.noscript ?? COPY['en-IN'].register.noscript)}</p></noscript>
      <p class="sg-register-status" role="status"></p>
    </form>
  </section>
  <section class="sg-venue" id="venue" aria-labelledby="venue-h" data-lat="${VENUE.lat}" data-lng="${VENUE.lng}" data-name="${esc(v.name)}">
    <h2 id="venue-h">${esc(v.heading)}</h2>
    <div class="sg-venue-top">
      <div class="sg-venue-words">
        <p class="sg-venue-name">${esc(v.name)}</p>
        <address class="sg-venue-address">${esc(v.address)}</address>
        <h3>${esc(v.finding)}</h3>
        <p class="sg-venue-landmarks">${esc(v.landmarks)}</p>
        <p class="sg-venue-maps">
          <a class="sg-venue-link" data-map="app" href="geo:${VENUE.lat},${VENUE.lng}?q=${VENUE.lat},${VENUE.lng}(${encodeURIComponent(v.name)})">${esc(v.mapApp)}</a>
          <a class="sg-venue-link sg-venue-link-web" data-map="web" href="https://www.google.com/maps/search/?api=1&amp;query=${VENUE.lat},${VENUE.lng}">${esc(v.mapWeb)}</a>
        </p>
      </div>
      <figure class="sg-venue-locator" aria-hidden="true">
        <svg viewBox="0 0 320 200" focusable="false">
          <path class="sg-loc-river" d="M0 0H320V34C270 22 232 46 176 34S74 22 0 36Z"/>
          <text class="sg-loc-label" x="14" y="22">${esc(v.river)}</text>
          <path class="sg-loc-road" d="M0 150H320"/>
          <path class="sg-loc-road" d="M196 56V200"/>
          <rect class="sg-loc-block" x="30" y="62" width="130" height="52" rx="3"/>
          <text class="sg-loc-label" x="40" y="92">${esc(v.secretariat)}</text>
          <rect class="sg-loc-hall" x="214" y="62" width="82" height="52" rx="3"/>
          <text class="sg-loc-label sg-loc-hall-label" x="226" y="92">${esc(v.hall)}</text>
          <circle class="sg-loc-stop" cx="56" cy="172" r="7"/>
          <text class="sg-loc-label" x="70" y="176">${esc(v.bus_stop)}</text>
          <path class="sg-loc-walk-halo" d="M56 165V150H196V120"/>
          <path class="sg-loc-walk" d="M56 165V150H196V120"/>
          <path class="sg-loc-pin" d="M255 56c-7 0-12 5-12 11 0 8 12 19 12 19s12-11 12-19c0-6-5-11-12-11Z"/>
          <circle class="sg-loc-pin-dot" cx="255" cy="67" r="4"/>
        </svg>
      </figure>
    </div>
    <div class="sg-venue-more">
      <section class="sg-venue-ways" aria-labelledby="ways-h">
        <h3 id="ways-h">${esc(v.ways)}</h3>
        <ul>
${['bus', 'ferry', 'car'].map(k => `          <li><strong>${esc(v[k][0])}</strong> ${esc(v[k][1])}</li>`).join('\n')}
        </ul>
      </section>
      <section class="sg-venue-access" aria-labelledby="access-h">
        <h3 id="access-h">${esc(v.access)}</h3>
        <dl>
${['step', 'lift', 'toilet'].map(k => `          <div><dt>${esc(v[k][0])}</dt><dd>${esc(v[k][1])}</dd></div>`).join('\n')}
        </dl>
      </section>
    </div>
  </section>
</main>

<sg-site-footer seed="${esc(c.site.name)}">
  <footer aria-label="${esc(words.siteFooter)}">
    <p class="sg-site-footer-sign">${esc(c.footer.sign)}</p>
    <nav class="sg-site-footer-links" aria-label="${esc(c.footer.links)}">
      <ul>
        <li><a href="#agenda">${esc(c.agenda.heading)}</a></li>
        <li><a href="#speakers">${esc(c.speakers.heading)}</a></li>
        <li><a href="#venue">${esc(v.heading)}</a></li>
        <li><a href="#main">${esc(c.footer.top)}</a></li>
      </ul>
    </nav>
    <p class="sg-site-footer-small">&copy; <time datetime="2026">2026</time> ${esc(c.footer.small)}</p>
  </footer>
</sg-site-footer>
</body>
</html>
`;
}

/**
 * The worker's version: a hash of every file it may keep (pages, offline pages, styles, scripts, fonts, pictures), so any
 * change to any of them gives the worker a new version, and visitors get the new files on their next visit after it
 * updates. Nothing to bump by hand. strings.js, pages.mjs and the worker itself are not served, so they are left out.
 * The pages written in this same run are hashed from memory, so the hash does not depend on the order they are written.
 */
function contentVersion(written) {
  const skip = new Set(['sw.js', 'strings.js', 'pages.mjs', 'susegad.json', 'package.json']);
  const files = [];
  const walk = dir => {
    for (const e of readdirSync(join(here, dir), { withFileTypes: true })) {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(rel); continue; }
      if (skip.has(rel) || written.has(rel) || !kindOf(`/${rel}`)) continue;
      files.push(rel);
    }
  };
  walk('');
  const h = createHash('sha256');
  const all = [...files.map(rel => [rel, readFileSync(join(here, rel))]), ...[...written].map(([rel, text]) => [rel, Buffer.from(text)])].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [rel, buf] of all) {
    // text is hashed with LF line ends, so the same files give the same version on every machine
    const text = /\.(html|css|m?js|svg)$/.test(rel) ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n')) : buf;
    h.update(`${rel}\n${text.length}\n`).update(text);
  }
  return h.digest('hex').slice(0, 12);
}

/** What the offline worker needs at install, besides the offline pages: the files an offline page draws itself with, and the two files the page loads only when Save as picture is pressed (a page that has not yet been pressed would not have asked for them, and a new version of the worker starts with an empty cache). */
const PRECACHE = ['look.js', 'susegad/tokens/fonts.css', 'susegad/tokens/tokens.css', 'susegad/recipes/offline/recipe.css', 'susegad/recipes/offline/retry.js', 'susegad/components/ticket/ticket.png.js', 'susegad/export/png.js'];

/** The offline page for a language: the same words as the recipe's, addressed from the site's folder. */
const offlineFor = lang => offlinePage({ lang: lang.tag, base: SCOPE, register: REGISTER, siteName: COPY[lang.tag].site.name, styles: PRECACHE.filter(f => f.endsWith('.css')), look: 'look.js' });

/** The folder of each language mapped to its offline page, "" for the first (the default). */
const offlinePages = () => Object.fromEntries(LANGS.map((l, i) => [i ? l.folder : '', [l.folder, 'offline.html'].filter(Boolean).join('/')]));

/** [relative path, text] for each file pages.mjs writes: the pages, their offline pages, and the worker. */
export const pages = () => {
  const written = new Map([
    ...LANGS.map(l => [[l.folder, 'index.html'].filter(Boolean).join('/'), renderPage(l)]),
    ...LANGS.map(l => [[l.folder, 'offline.html'].filter(Boolean).join('/'), offlineFor(l)]),
  ]);
  return [...written, ['sw.js', swSource({ version: contentVersion(written), scope: SCOPE, offlinePages: offlinePages(), precache: PRECACHE })]];
};

if (import.meta.main ?? process.argv[1]?.split('\\').join('/').endsWith('/pages.mjs')) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [rel, text] of pages()) {
    const file = join(here, rel);
    if (check) {
      const now = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : null;
      if (now !== text) { console.error(`${rel} is not what strings.js makes. Run node pages.mjs to write it again.`); stale++; }
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
      console.log(`wrote ${rel}`);
    }
  }
  process.exitCode = stale ? 1 : 0;
  if (check && !stale) console.log('The pages match strings.js.');
}
