import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRules, analyseCss, missing, interactiveReasons, diffSnapshots } from './touch.core.js';

const GOOD = `
sg-x button { transition: translate 120ms; }
sg-x button:active { translate: 0 1px; transition: none; }
sg-x button:focus-visible { outline: 2px solid Highlight; }
@media (prefers-reduced-motion: reduce) { sg-x button:active { translate: none; } }
`;

test('parseRules: reads selectors, declarations and the at-rules around them, and skips keyframes', () => {
  const rules = parseRules(`/* c */ a:hover { color: red; } @media (prefers-reduced-motion: reduce) { a:active { translate: none; } } @keyframes k { from { opacity: 0 } to { opacity: 1 } }`);
  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0].decls, [['color', 'red']]);
  assert.match(rules[1].at[0], /reduced-motion/);
});

test('analyseCss: a component that keeps the contract has no gaps', () => {
  assert.deepEqual(missing(analyseCss(GOOD)), []);
});

test('analyseCss: no :active rule is named', () => {
  assert.match(missing(analyseCss(GOOD.replace(':active', ':hover')))[0], /no :active rule/);
});

test('analyseCss: an :active rule that sets nothing visible does not count (transition alone, or none)', () => {
  const hollow = GOOD.replace('translate: 0 1px; transition: none;', 'transition: none; translate: none;');
  assert.match(missing(analyseCss(hollow)).join(), /changes nothing visible/);
});

test('analyseCss: a rule that only says "not :active" is not a press state', () => {
  const css = GOOD.replace('sg-x button:active', 'sg-x button:not(:active)');
  assert.match(missing(analyseCss(css)).join(), /no :active rule/);
});

test('analyseCss: an :active rule that exists only under reduced motion is not a press state', () => {
  const css = `sg-x button { transition: translate 1s; } @media (prefers-reduced-motion: reduce) { sg-x button:active { translate: none; color: red; } } sg-x button:focus-visible { outline: 2px solid red; }`;
  assert.match(missing(analyseCss(css)).join(), /no :active rule/);
});

test('analyseCss: no :focus-visible style, and a ring-less rule, are named', () => {
  assert.match(missing(analyseCss(GOOD.replace(':focus-visible', ':focus')))[0], /no :focus-visible/);
  assert.match(missing(analyseCss(GOOD.replace('outline: 2px solid Highlight', 'cursor: pointer')))[0], /no :focus-visible/);
});

test('analyseCss: a component that moves needs reduced-motion handling, in CSS or in a skin that reads ctx.motion', () => {
  const css = GOOD.replace(/@media[^]*$/, '');
  assert.match(missing(analyseCss(css)).join(), /reduced-motion/);
  assert.deepEqual(missing(analyseCss(css, 'if (ctx.motion === "still") return;')), []);
});

test('analyseCss: a component with no motion at all needs no reduced-motion block', () => {
  const css = `sg-x button:active { color: red; } sg-x button:focus-visible { outline: 2px solid red; }`;
  assert.deepEqual(missing(analyseCss(css)), []);
});

test('missing: a text-entry-only component needs no press state', () => {
  const css = `sg-x input:focus-visible { outline: 2px solid red; }`;
  assert.deepEqual(missing(analyseCss(css), { pressable: false }), []);
  assert.match(missing(analyseCss(css)).join(), /no :active/);
});

test('interactiveReasons: markup inside the tag counts, a demo\'s own buttons outside it do not', () => {
  const demo = `<button>Replay</button><sg-badge><span>New</span></sg-badge><sg-tabs><nav><a href="#a">A</a></nav></sg-tabs>`;
  assert.deepEqual(interactiveReasons('sg-badge', demo, '').reasons, []);
  assert.match(interactiveReasons('sg-tabs', demo, '').reasons[0], /holds a/);
});

test('interactiveReasons: scripts that make a button or set a tabindex count; a hidden input does not', () => {
  assert.match(interactiveReasons('sg-x', '<sg-x></sg-x>', `document.createElement('button')`).reasons[0], /scripts make button/);
  assert.match(interactiveReasons('sg-x', '<sg-x></sg-x>', `el.setAttribute('tabindex', '0')`).reasons[0], /tabindex/);
  assert.deepEqual(interactiveReasons('sg-x', '<sg-x><input type="hidden" name="a"></sg-x>', '').reasons, []);
});

test('interactiveReasons: a text input is interactive but not pressable; a checkbox or button is', () => {
  const text = interactiveReasons('sg-otp', '<sg-otp><input autocomplete="one-time-code"></sg-otp>', '');
  assert.equal(text.reasons.length, 1);
  assert.equal(text.pressable, false);
  assert.equal(interactiveReasons('sg-t', '<sg-t><input type="checkbox"></sg-t>', '').pressable, true);
  assert.equal(interactiveReasons('sg-t', '<sg-t><button>x</button></sg-t>', '').pressable, true);
});

test('diffSnapshots: reports what changed and which of it is movement', () => {
  const a = { 'button#0': { translate: 'none', color: 'rgb(0, 0, 0)', scale: 'none' } };
  const b = { 'button#0': { translate: '0px 1px', color: 'rgb(10, 0, 0)', scale: 'none' } };
  const d = diffSnapshots(a, b);
  assert.deepEqual(d.changed, ['button#0 translate', 'button#0 color']);
  assert.deepEqual(d.moved, ['button#0 translate']);
  assert.deepEqual(diffSnapshots(a, a), { changed: [], moved: [] });
});

test('interactiveReasons: a component\'s own builders count (mk, h), as menu builds its buttons', () => {
  assert.match(interactiveReasons('sg-menu', '<sg-menu></sg-menu>', `const minus = mk('button', 'sg-menu-minus');`).reasons[0], /scripts make button/);
  assert.match(interactiveReasons('sg-x', '<sg-x></sg-x>', `this.append(h('a', { class: 'go' }))`).reasons[0], /scripts make a/);
  assert.deepEqual(interactiveReasons('sg-x', '<sg-x></sg-x>', `s.split('a'); el.includes('button')`).reasons, []);
});

test('diffSnapshots: a node that appears or goes away counts as a change', () => {
  assert.deepEqual(diffSnapshots({}, { 'path#3': { opacity: '1' } }).changed, ['path#3 opacity']);
  assert.deepEqual(diffSnapshots({ 'path#3': { opacity: '1' } }, {}).changed, ['path#3 opacity']);
});

test('diffSnapshots: a node that only appears (a popup the press opened) is a change but not a movement', () => {
  const d = diffSnapshots({}, { 'option#3': { translate: '0px -6px', color: 'rgb(0, 0, 0)' } });
  assert.ok(d.changed.length > 0);
  assert.deepEqual(d.moved, []);
});
