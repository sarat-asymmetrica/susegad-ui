import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, parseAction } from './args.mjs';

const SPEC = { out: 'string', width: 'number', reduced: 'bool', move: 'list', param: 'kv' };

test('parses every kind of flag and keeps positionals in order', () => {
  const { opts, positional } = parseArgs(
    ['kolam', '1', '--width', '390', '--reduced', '--move', '0.5,0.5@1', '--move=0.1,0.2@2', '--param', 'grid=7', '--out=x', '3'],
    SPEC, { width: 1280 });
  assert.deepEqual(positional, ['kolam', '1', '3']);
  assert.equal(opts.width, 390);
  assert.equal(opts.reduced, true);
  assert.equal(opts.out, 'x');
  assert.deepEqual(opts.move, ['0.5,0.5@1', '0.1,0.2@2']);
  assert.deepEqual(opts.param, { grid: '7' });
});

test('defaults stand when a flag is absent, and list/kv defaults are not shared', () => {
  const d = { width: 1280, move: ['a'] };
  const { opts } = parseArgs(['--move', 'b'], SPEC, d);
  assert.equal(opts.width, 1280);
  assert.deepEqual(opts.move, ['a', 'b']);
  assert.deepEqual(d.move, ['a']);
  assert.deepEqual(parseArgs([], SPEC).opts.param, {});
});

test('rejects unknown flags, missing values and bad numbers', () => {
  assert.throws(() => parseArgs(['--widht', '3'], SPEC), /unknown flag --widht/);
  assert.throws(() => parseArgs(['--width'], SPEC), /needs a value/);
  assert.throws(() => parseArgs(['--width', 'wide'], SPEC), /expects a number/);
  assert.throws(() => parseArgs(['--reduced=yes'], SPEC), /takes no value/);
  assert.throws(() => parseArgs(['--param', 'grid'], SPEC), /key=value/);
});

test('parses timed actions', () => {
  assert.deepEqual(parseAction('move', '0.25,0.75@1.5'), { kind: 'move', x: 0.25, y: 0.75, at: 1.5 });
  assert.deepEqual(parseAction('call', 'reseed@2'), { kind: 'call', method: 'reseed', at: 2 });
  assert.throws(() => parseAction('click', '0.5@1'), /x,y/);
  assert.throws(() => parseAction('call', 'alert(1)@1'), /bad method/);
  assert.throws(() => parseAction('move', '0.5,0.5'), /what@seconds/);
  assert.throws(() => parseAction('move', '0.5,0.5@-1'), /bad time/);
});
