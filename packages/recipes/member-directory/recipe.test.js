import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, stateOf, stateToQuery } from './recipe.js';

// ── the shareable state ─────────────────────────────────────────────────

test('the state reads back from a query string', () => {
  assert.deepEqual(stateOf(new URLSearchParams('?q=priyanka')), { q: 'priyanka', tracks: [] });
  assert.deepEqual(stateOf(new URLSearchParams('?q=aldona&track=AI%20for%20Kids,Tech%20for%20Good')), { q: 'aldona', tracks: ['AI for Kids', 'Tech for Good'] });
});

test('nothing set is nothing filtered', () => {
  assert.deepEqual(stateOf(new URLSearchParams('')), { q: '', tracks: [] });
  assert.deepEqual(stateOf(new URLSearchParams('?track=')), { q: '', tracks: [] });
  assert.deepEqual(stateOf(new URLSearchParams('?q=%20')), { q: ' ', tracks: [] });
});

test('the state writes back to a query, omitting what is empty', () => {
  assert.equal(stateToQuery({ q: '', tracks: [] }).toString(), '');
  assert.equal(stateToQuery({ q: 'priyanka', tracks: [] }).toString(), 'q=priyanka');
  assert.equal(stateToQuery({ q: ' ', tracks: [] }).toString(), '');
  const t = stateToQuery({ q: '', tracks: ['AI for Kids', 'Tech for Good'] }).toString();
  assert.equal(new URLSearchParams(t).getAll('track')[0], 'AI for Kids,Tech for Good');
});

test('the same state reads and writes the same query', () => {
  for (const s of [{ q: 'aldona', tracks: [] }, { q: '', tracks: ['AI for Kids'] }, { q: 'deepa', tracks: ['Tech for Good', 'AI for Kids'] }]) {
    assert.deepEqual(stateOf(stateToQuery(s)), s);
  }
});

// ── the words the directory says ────────────────────────────────────────

test('the count says 1 member, 2 members', () => {
  assert.equal(STRINGS.shown(1), 'Showing 1 member');
  assert.equal(STRINGS.shown(7), 'Showing 7 members');
});

test('the empty state is kind, not clever, and names the two fixes', () => {
  assert.equal(STRINGS.empty, 'No one matches that yet. Try a shorter word, or a different track.');
});

test('the share note explains that the view is in the address', () => {
  assert.ok(STRINGS.queryNote.startsWith('This filtered view is in the address'));
});
