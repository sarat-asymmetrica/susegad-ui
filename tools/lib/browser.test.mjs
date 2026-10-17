import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCancelledMedia } from './browser.mjs';

test('a cancelled audio or video request is not a failure (the page closed on a preload)', () => {
  assert.equal(isCancelledMedia('net::ERR_ABORTED', 'media'), true);
});

test('the same cancellation on a script, stylesheet or image still counts: a 404 module import fires it too', () => {
  for (const type of ['script', 'stylesheet', 'image', 'fetch', 'document', 'font']) assert.equal(isCancelledMedia('net::ERR_ABORTED', type), false, type);
});

test('any other failure of a media request still counts', () => {
  assert.equal(isCancelledMedia('net::ERR_CONNECTION_REFUSED', 'media'), false);
  assert.equal(isCancelledMedia('NS_BINDING_ABORTED', 'media'), false);
  assert.equal(isCancelledMedia('failed', 'media'), false);
});
