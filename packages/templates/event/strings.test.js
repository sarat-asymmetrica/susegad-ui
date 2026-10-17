import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BANNER, COPY, DAY, unwritten } from './strings.js';
import { formatKonkani } from '../../core/intl.kok.js';
import { parseWhen } from '../../core/intl.core.js';

// The Konkani pages carry their dates as written strings. They must say what the library's own
// Konkani dates say, so a page's words and the dates the library prints never disagree (ruling of
// 8 October 2026: ICU's forms win, with no ending on a date).
const WEBKIT = () => ({ resolvedOptions: () => ({ locale: 'en-GB' }), formatToParts: () => [] }); // forces the table

for (const locale of ['gom-Deva', 'gom-Latn']) {
  const day = parseWhen(`${DAY}T10:00`);
  test(`${locale}: the hero's date and the agenda's day are the library's Konkani date`, () => {
    assert.equal(COPY[locale].agenda.day, formatKonkani(day, { locale, make: WEBKIT }));
    assert.equal(COPY[locale].hero.eyebrow.split(' · ')[0], formatKonkani(day, { locale, make: WEBKIT, year: true }));
  });

  test(`${locale}: the banner opens with the day the page says, and ends with the event`, () => {
    assert.ok(COPY[locale].banner.text.startsWith(formatKonkani(day, { locale, make: WEBKIT })), COPY[locale].banner.text);
    assert.equal(BANNER.until, DAY, 'the banner goes after the event day');
  });

  test(`${locale}: the agenda's times are the part of the day and a clock, not am and pm`, () => {
    const page = readFileSync(new URL(`./${locale === 'gom-Deva' ? 'gom-deva' : 'gom-latn'}/index.html`, import.meta.url), 'utf8');
    const times = [...page.matchAll(/<p class="sg-session-time">(.*?)<\/p>/g)].map(m => m[1].replace(/<[^>]+>/g, ''));
    assert.ok(times.length >= 10, `${times.length} sessions`);
    const first = times[0];
    assert.match(first, locale === 'gom-Deva' ? /^सकाळीं 9:30 ते सकाळीं 10:00 IST$/ : /^sokallim 9:30 te sokallim 10:00 IST$/, first);
    assert.ok(times.every(t => !/\b(am|pm)\b/i.test(t)), 'no English am or pm');
    assert.equal(COPY[locale].time.am, undefined, 'the Konkani table has no am and pm: the core says the part of the day');
  });
}

test('the English page keeps its am and pm', () => {
  const page = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  assert.match(page, /9:30 am<\/time> to <time[^>]*>10 am/);
});

test('the English banner is the event example, and every page has the banner', () => {
  assert.equal(COPY['en-IN'].banner.text, 'Doors open at 9:30 am on Saturday 21 November. Please bring your ticket, on your phone or on paper.');
  for (const f of ['index.html', 'gom-deva/index.html', 'gom-latn/index.html']) {
    const page = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.match(page, /<sg-banner id="doors" until="2026-11-21">/, f);
    assert.ok(page.indexOf('<sg-banner') < page.indexOf('<header'), `${f}: the banner comes before the header`);
    assert.ok(page.indexOf('class="skip"') < page.indexOf('<sg-banner'), `${f}: after the skip link`);
  }
});

test('the registration form: its consent values are English, and Konkani is written', () => {
  assert.deepEqual(COPY['en-IN'].register.consent, {
    fields: 'your name and your email address',
    purpose: 'confirm your place and send you the ticket and any change to this event',
    period: '30 days after the event',
  });
  assert.deepEqual(unwritten(), { 'en-IN': 0, 'gom-Deva': 0, 'gom-Latn': 0 }, 'every Konkani entry of the form is written (a draft, for a native reader)');
  for (const f of ['gom-deva/index.html', 'gom-latn/index.html']) {
    const page = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.equal((page.match(/\[TODO gom-/g) ?? []).length, 0, f);
  }
});

test('every page carries the registration form with the consent notice, a native required box, and a sample seam', () => {
  for (const f of ['index.html', 'gom-deva/index.html', 'gom-latn/index.html']) {
    const page = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.match(page, /<form class="sg-register-form" action="#" method="post" data-sample="/, f);
    assert.match(page, /<sg-consent id="register-consent" role="group" aria-labelledby="register-consent-h">/, f);
    assert.match(page, /<input type="checkbox" id="register-consent-box" name="consent" value="yes" required>/, f);
    assert.ok(!/ checked/.test(page.slice(page.indexOf('<sg-consent'), page.indexOf('</sg-consent>'))), `${f}: never pre-ticked`);
    assert.ok(page.indexOf('href="#register"') > 0 && page.indexOf('id="register"') > 0, `${f}: linked from the header`);
    // the three values the template leaves for the site stay visible
    const notice = page.slice(page.indexOf('<sg-consent'), page.indexOf('</sg-consent>'));
    assert.equal((notice.match(/class="sg-consent-blank"/g) ?? []).length >= 3, true, `${f}: contact, site and complaint stay placeholders`);
  }
});

test('every page carries the ticket beside the form, for this event and its doors time', () => {
  for (const [f, name] of [['index.html', 'Mandovi Conclave'], ['gom-deva/index.html', 'मांडवी कॉन्क्लेव्ह'], ['gom-latn/index.html', 'Mandovi Conclave']]) {
    const page = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.ok(page.includes(`<sg-ticket id="ticket" event="${name}" event-id="mandovi-conclave" at="2026-11-21T09:30"></sg-ticket>`), f);
    assert.ok(page.indexOf('<sg-ticket') < page.indexOf('<form class="sg-register-form"'), `${f}: the ticket is above the form`);
  }
});

test('the offline pages and the worker are written, in step with the languages', () => {
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sw, /^(import|export) /m, 'one classic script');
  assert.match(sw, /"": "offline.html"/);
  assert.match(sw, /"gom-deva": "gom-deva\/offline.html"/);
  assert.match(sw, /"gom-latn": "gom-latn\/offline.html"/);
  const want = { 'offline.html': 'No connection right now', 'gom-deva/offline.html': 'सध्या जोडणी ना', 'gom-latn/offline.html': 'Sodhya jodonni na' };
  for (const [f, title] of Object.entries(want)) {
    const page = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.ok(page.includes(`<h1>${title}</h1>`), f);
    assert.ok(page.includes('href="/susegad/recipes/offline/recipe.css"') && page.includes('src="/susegad/recipes/offline/retry.js"'), `${f}: its files are addressed from the site's folder`);
  }
});

test('page.js turns sg-register into a ticket made on the device, and registers the offline worker', () => {
  const js = readFileSync(new URL('./page.js', import.meta.url), 'utf8');
  assert.match(js, /ticket\?\.issue\(e\.detail\.name\)/);
  assert.match(js, /registerOffline\(/);
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), 'the page script sends nothing anywhere');
});

test('every page names the event in no language, so a ticket made on one page is the same ticket on the others', () => {
  for (const f of ['index.html', 'gom-deva/index.html', 'gom-latn/index.html']) {
    const page = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.match(page, /<sg-ticket id="ticket" event="[^"]+" event-id="mandovi-conclave" at="2026-11-21T09:30">/, f);
  }
  const names = ['index.html', 'gom-deva/index.html'].map(f => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').match(/<sg-ticket id="ticket" event="([^"]+)"/)[1]);
  assert.notEqual(names[0], names[1], 'the event is written differently in each language, which is why the id is what matches');
});

test('with no script the form sends nothing: the button is disabled in the HTML, and a line says why', () => {
  for (const f of ['index.html', 'gom-deva/index.html', 'gom-latn/index.html']) {
    const page = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.match(page, /<button class="button" type="submit" disabled>/, `${f}: Register starts disabled`);
    assert.match(page, /<noscript><p class="sg-register-noscript"[^>]*>Registering needs JavaScript\. Please turn it on and reload this page\.<\/p><\/noscript>/, f);
  }
  assert.ok(readFileSync(new URL('./gom-deva/index.html', import.meta.url), 'utf8').includes('<p class="sg-register-noscript" lang="en">'), 'on a Konkani page the English line is marked as English');
  assert.match(readFileSync(new URL('./page.js', import.meta.url), 'utf8'), /removeAttribute\('disabled'\)/, 'script is what enables it');
});

test('the worker\u2019s version is made from the files, not set by hand', () => {
  const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
  assert.match(sw, /"version": "[0-9a-f]{12}"/);
  const strings = readFileSync(new URL('./strings.js', import.meta.url), 'utf8');
  assert.ok(!/SW_VERSION/.test(strings), 'no constant to forget to bump');
});
