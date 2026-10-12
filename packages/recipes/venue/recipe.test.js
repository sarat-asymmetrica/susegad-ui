import test from 'node:test';
import assert from 'node:assert/strict';
import { geoUri, mapsUrl, appleMapsUrl, isApple, validPoint, venueLinks } from './recipe.js';

const hall = { lat: 15.4989, lng: 73.8278, name: 'Mandovi Riverside Hall' };

test('the geo link carries the point and the name, so the app labels the pin', () => {
  assert.equal(geoUri(hall), 'geo:15.4989,73.8278?q=15.4989,73.8278(Mandovi%20Riverside%20Hall)');
  assert.equal(geoUri({ lat: 15.4989, lng: 73.8278 }), 'geo:15.4989,73.8278?q=15.4989,73.8278');
});

test('the web fallback is a plain link, no key and no script', () => {
  assert.equal(mapsUrl(hall), 'https://www.google.com/maps/search/?api=1&query=15.4989,73.8278');
});

test('Apple Maps is for iPhones and iPads, which do not open geo: links', () => {
  assert.equal(appleMapsUrl(hall), 'https://maps.apple.com/?ll=15.4989,73.8278&q=Mandovi%20Riverside%20Hall');
  assert.ok(isApple('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'));
  assert.ok(isApple('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'));
  assert.ok(isApple('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)); // an iPad that calls itself a Mac
  assert.ok(!isApple('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)); // a real Mac
  assert.ok(!isApple('Mozilla/5.0 (Linux; Android 14; Pixel 8)'));
});

test('the app link suits the device and the web link works anywhere', () => {
  const android = venueLinks(hall, { ua: 'Mozilla/5.0 (Linux; Android 14)' });
  assert.ok(android.app.startsWith('geo:') && android.web.startsWith('https://'));
  const iphone = venueLinks(hall, { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' });
  assert.ok(iphone.app.startsWith('https://maps.apple.com/'));
  assert.equal(iphone.web, android.web);
});

test('a place that is not on the globe makes no links', () => {
  assert.equal(venueLinks({ lat: '', lng: '' }), null);
  assert.equal(venueLinks({ lat: 91, lng: 0 }), null);
  assert.equal(venueLinks({ lat: 0, lng: 181 }), null);
  assert.equal(venueLinks({ lat: 'north', lng: 73 }), null);
  assert.ok(validPoint(0, 0)); // the equator and the meridian are a place too
  assert.equal(geoUri({ lat: 0, lng: 0 }), 'geo:0,0?q=0,0');
});

test('digits are trimmed to a metre, whatever string they arrive as', () => {
  assert.equal(geoUri({ lat: '15.49890000', lng: '73.827800001' }), 'geo:15.4989,73.8278?q=15.4989,73.8278');
  assert.equal(mapsUrl({ lat: 10, lng: 100 }), 'https://www.google.com/maps/search/?api=1&query=10,100');
});

test('geo: only where it works: Android. Apple Maps on iOS. Anywhere else the app link is not offered', () => {
  const android = venueLinks(hall, { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/124 Mobile' });
  assert.ok(android.app.startsWith('geo:'));
  const windows = venueLinks(hall, { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124' });
  assert.equal(windows.app, null);
  assert.ok(windows.web.startsWith('https://'));
  const mac = venueLinks(hall, { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', touchPoints: 0 });
  assert.equal(mac.app, null);
  assert.equal(venueLinks(hall, { ua: '' }).app, null);
});

test('a venue name with brackets does not break the geo: label', () => {
  assert.equal(geoUri({ lat: 1, lng: 2, name: 'Hall (East Wing)' }), 'geo:1,2?q=1,2(Hall%20%28East%20Wing%29)');
});
