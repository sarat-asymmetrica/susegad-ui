// A fake room-details source: pure and seeded, reporting only what happened. It answers with real
// data after a seeded delay, or fails when the world says so. The delay is the
// only waiting in the recipe, and it lives here, where a real network would be:
// the page shows the skeleton until an answer comes, never for a set time.
//
// Swap it for your own: anything with `load(id) → Promise<room>` will do.

import { rng } from '../../engine/src/rng.js';

const ROOMS = {
  garden: {
    name: 'Garden room', per: 'night', rate: 3200, sleeps: 2, beds: { double: 1 },
    summary: 'On the ground floor, with a veranda onto the paddy and the mango tree.',
    included: ['Breakfast on the veranda', 'Filtered drinking water', 'Wi-Fi', 'An umbrella for the walk to the village'],
  },
  balcao: {
    name: 'Balcão suite', per: 'night', rate: 5600, sleeps: 3, beds: { double: 1, single: 1 },
    summary: 'Upstairs, opening onto the old stone balcão where the house takes its evening tea.',
    included: ['Breakfast on the veranda', 'Evening chai', 'Wi-Fi', 'A desk by the window'],
  },
  house: {
    name: 'The whole house', whole: true, per: 'week', rate: 125000, sleeps: 8, beds: { double: 3, single: 2 },
    summary: 'All four rooms, the kitchen and the garden, for a family or a group of friends.',
    included: ['A cook for breakfast and lunch', 'Daily housekeeping', 'Wi-Fi', 'Airport pickup from Mopa or Dabolim'],
  },
};
export const ROOM_IDS = Object.keys(ROOMS);

/** One room's details for a seed. Only availability varies with the seed. */
export function roomFor(id, seed = 1) {
  const base = ROOMS[id];
  if (!base) return null;
  const left = id === 'house' ? rng(`room-left:${seed}:${id}`).int(0, 1) : rng(`room-left:${seed}:${id}`).int(0, 5);
  return { id, ...base, included: [...base.included], beds: { ...base.beds }, left };
}

/**
 * @param {{ seed?: number|string, latency?: [number, number], wait?: (ms: number) => Promise<void>, overrides?: object }} [o]
 *   wait: how the source waits; the page passes a timer, tests pass an instant one.
 *   overrides: per-room fields to force, e.g. { garden: { left: 0 } }.
 */
export function createSource({ seed = 1, latency = [500, 1500], wait = ms => new Promise(r => setTimeout(r, ms)), overrides = {} } = {}) {
  const lat = rng(`room-latency:${seed}`);
  let failNext = 0, calls = 0;
  return {
    /** The world: the next n loads fail, as if the connection dropped. */
    failNext(n = 1) { failNext += n; },
    get calls() { return calls; },
    async load(id) {
      calls++;
      const took = Math.round(lat.range(latency[0], latency[1]));
      const fail = failNext > 0 ? (failNext--, true) : false;
      await wait(fail ? Math.round(took * 0.6) : took);
      if (fail) throw Object.assign(new Error('The connection dropped before the details arrived.'), { code: 'network' });
      const room = roomFor(id, seed);
      if (!room) throw Object.assign(new Error(`No room called ${id}.`), { code: 'not-found' });
      return { ...room, ...(overrides[id] ?? {}) };
    },
  };
}
