// The venue recipe: where the event is, in words first. A name and address, landmark
// directions in plain speech ("behind the Old Secretariat, facing the river"), a link out to the
// phone's maps app, how to get there, and how accessible the place is. No embedded map, no
// iframe, no third-party script: the maps links are ordinary links that open the app the person
// already trusts. The page reads in full with JavaScript off, links included.
//
// This file does two small jobs. First, the links: you write the coordinates once, as data-lat,
// data-lng and data-name on the .sg-venue element, and mountVenue() fills the maps links from them
// (a geo: link on Android, Apple Maps on iOS, and a web link everywhere; on a desktop, where a geo:
// link may open nothing, the app link is hidden and the web link stands alone). The hrefs you write
// in the HTML stay as the no-JavaScript truth, and a build step can call venueLinks() instead.
// Second, the access list: a row whose answer is only white space is hidden, and so is the whole
// section when every row is.

/** Latitude and longitude as a short, stable string: five decimals is about a metre. */
const deg = n => Number(n).toFixed(5).replace(/\.?0+$/, '');

/** True for a number a map could use: a latitude within +-90, a longitude within +-180. */
export const validPoint = (lat, lng) => Number.isFinite(+lat) && Number.isFinite(+lng) && lat !== '' && lng !== '' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** "geo:15.4989,73.8278?q=15.4989,73.8278(Name)": the maps app on Android. */
export function geoUri({ lat, lng, name = '' }) {
  const at = `${deg(lat)},${deg(lng)}`;
  // brackets are encoded too: a name like "Hall (East Wing)" would otherwise close the label early
  return `geo:${at}?q=${at}${name ? `(${encodeURIComponent(name).replace(/[()]/g, c => (c === '(' ? '%28' : '%29'))})` : ''}`;
}

/** The web fallback: a plain Google Maps link that opens the Maps app where it is installed. */
export function mapsUrl({ lat, lng }) {
  return `https://www.google.com/maps/search/?api=1&query=${deg(lat)},${deg(lng)}`;
}

/** Apple Maps, for iPhones and iPads, whose Safari does not open geo: links. */
export function appleMapsUrl({ lat, lng, name = '' }) {
  return `https://maps.apple.com/?ll=${deg(lat)},${deg(lng)}&q=${encodeURIComponent(name || 'Venue')}`;
}

/** Is this an iPhone, iPad or iPod (an iPad may call itself a Mac, so a touch screen counts)? */
export const isApple = (ua = '', touchPoints = 0) => /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);

/**
 * { app, web } for a venue. The web link works anywhere. The app link is offered only where a
 * maps app is sure to answer it: a geo: link on Android, Apple Maps on an iPhone or iPad. On a
 * desktop a geo: link may open nothing at all, so there `app` is null and only the web link shows.
 */
export function venueLinks(venue, { ua = '', touchPoints = 0 } = {}) {
  if (!validPoint(venue.lat, venue.lng)) return null;
  const app = isApple(ua, touchPoints) ? appleMapsUrl(venue) : /Android/i.test(ua) ? geoUri(venue) : null;
  return { app, web: mapsUrl(venue) };
}

/**
 * Wire a venue block: fill [data-map="app"] and [data-map="web"] from the coordinates on the root.
 * @param {HTMLElement} root the .sg-venue element, with data-lat, data-lng and data-name
 * @param {{ ua?: string, touchPoints?: number }} [o] the device (tests pass their own)
 */
export function mountVenue(root, { ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints } = {}) {
  const venue = { lat: root.dataset.lat, lng: root.dataset.lng, name: root.dataset.name ?? '' };
  const links = venueLinks(venue, { ua, touchPoints });
  if (!links) { console.warn('sg-venue: data-lat and data-lng are needed; the links written in the page stay as they are.'); return null; }
  const app = root.querySelector('[data-map="app"]');
  if (links.app) app?.setAttribute('href', links.app); else if (app) app.hidden = true; // no sure maps app here: the web link stays, alone
  root.querySelector('[data-map="web"]')?.setAttribute('href', links.web);
  // an access row with only white space in it (an editor's line breaks) has nothing to say
  const rows = [...root.querySelectorAll('.sg-venue-access dl > div')];
  rows.forEach(row => { row.hidden = !row.querySelector('dd')?.textContent.trim(); });
  const access = root.querySelector('.sg-venue-access');
  if (access) access.hidden = rows.length > 0 && rows.every(r => r.hidden);
  return links;
}
