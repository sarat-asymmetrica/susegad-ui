// The page's own consistency, read from the page itself so the test and the page cannot disagree:
// the composer's number and the fallback link's number are one number, the ids the parts use to
// find each other exist, every price in the markup is the price it says, and nothing says an
// order is placed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeNumber, readWaLink } from '../../components/wa-order/wa-order.core.js';
import { parsePrice, formatMoney } from '../../components/menu/menu.core.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const composer = html.match(/<sg-wa-order\b[^>]*>/s)[0];
const fallback = html.match(/<sg-wa-order\b[^>]*>\s*<a\b([^>]*)>([^<]*)<\/a>/s);
const menuTag = html.match(/<sg-menu\b[^>]*>/s)[0];

test('the composer and its fallback link use one number', () => {
  const number = normalizeNumber(attr(composer, 'number'));
  assert.ok(number.ok, 'the number attribute is a number WhatsApp can open');
  const link = readWaLink(attr(fallback[1], 'href'));
  assert.ok(link, 'the fallback is a wa.me link');
  assert.equal(link.digits, number.digits);
});

test('the fallback message names the business and is short', () => {
  const { text } = readWaLink(attr(fallback[1], 'href'));
  assert.ok(text.includes(attr(composer, 'business')), text);
  assert.ok(text.length < 120, `${text.length} characters`);
  assert.ok(!/[—–]/.test(text));
});

test('the parts find each other: for, continue and the ids', () => {
  assert.equal(attr(composer, 'for'), attr(menuTag, 'id'));
  const id = attr(composer, 'id');
  assert.equal(attr(menuTag, 'continue'), `#${id}`);
  assert.ok(/\borderable\b/.test(menuTag), 'the menu is orderable');
});

test('every price in the markup is the price it says', () => {
  const prices = [...html.matchAll(/<data value="([^"]+)">([^<]+)<\/data>/g)];
  assert.ok(prices.length >= 8);
  for (const [, value, shown] of prices) {
    assert.equal(parsePrice(shown), Number(value), shown);
    assert.equal(formatMoney(Number(value)), shown, 'written the Indian way');
  }
});

test('dish ids are unique, and sold-out and ask-first dishes say so in words', () => {
  const ids = [...html.matchAll(/class="sg-menu-item" data-id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, state] of html.matchAll(/data-availability="(sold-out|ask)"/g)) {
    assert.match(html, new RegExp(`class="sg-menu-status">${state === 'ask' ? 'Ask first' : 'Sold out'}<`));
  }
});

test('three steps, in an ordered list', () => {
  const steps = html.match(/<ol>([\s\S]*?)<\/ol>/)[1].match(/<li>/g);
  assert.equal(steps.length, 3);
});

test('the page never says an order is placed, and has no em dash', () => {
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!/\b(order (is|has been) (placed|confirmed)|booked|order received|thank you for your order)\b/i.test(visible));
  assert.ok(!/[—–]/.test(html));
  assert.match(visible, /Nothing is final until we reply and confirm/);
});
