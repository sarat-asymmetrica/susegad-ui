// light.js: the sun, and what the sun does to a thing standing on the ground.
// Pure. Time of day is the only input, so a scene that has already decided it
// is dawn can ask the same question the salt pans ask and get the same answer.
//
// Sun position is a sinusoid over the day, not a straight line. Elevation and
// azimuth are the two angles that matter to a drawing: elevation sets how long
// a shadow is and how warm the light reads, azimuth sets which way it is
// thrown. Azimuth is a compass bearing everywhere in this file, so what sunAt
// returns can be handed straight to shadowDir.

import { clamp, lerp } from './math.js';

export const DEG = Math.PI / 180;

/** Where the sun is, given a time of day and the latitude it is over.
 *
 * `t` is 0 at the first light, 0.5 at the local solar noon, 1 at the last
 * light. A real sun climbs fast near the equator and shallowly toward the
 * poles, so the curve is fitted with a latitude: at the equator the arc
 * stands tall, near the poles it flattens and the day is short.
 *
 * The horizon crossing is at 0 and 1, so elevation is negative outside the
 * day and clamps to 0 for anything that wants a light source at all.
 *
 * @param {number} t 0..1 across the day
 * @param {{ latitudeDeg?: number, maxElevationDeg?: number, horizonDeg?: number }} [opts]
 * @returns {{ t: number, elevationDeg: number, elevation: number, azimuthDeg: number,
 *   azimuth: number, above: number, altitude: number }}
 *   `azimuthDeg` is a compass bearing, 0 = north, 90 = east: the sun rises
 *   east of south, crosses due south at noon (due north in the southern
 *   hemisphere) and sets west of it;
 *   `elevation` and `azimuth` are the same angles in radians; `above` is 0..1
 *   for how high the sun has climbed (0 at the horizon, 1 at its peak);
 *   `altitude` is how much light there is, `sin` of the elevation, so it falls
 *   to 0 at dawn and dusk without a second curve.
 */
export function sunAt(t, {
  latitudeDeg = 15, maxElevationDeg = null, horizonDeg = -0.833,
} = {}) {
  const day = clamp(t);
  // The sun is up between the two horizon crossings, so peak at midday and
  // symmetric about it: 0 at t=0, 1 at t=0.5, 0 at t=1.
  const above = Math.sin(Math.PI * day);
  // How high it can get is set by where on the earth you are: the sun stands
  // overhead at the equator and never climbs far at all near the poles, so the
  // peak is 90 degrees minus the latitude. A caller who knows their own
  // solstice passes `maxElevationDeg` instead of the latitude.
  const peak = maxElevationDeg ?? 90 - Math.abs(latitudeDeg);
  const maxEl = clamp(peak, horizonDeg + 1, 90);
  const elevationDeg = horizonDeg + (maxEl - horizonDeg) * above;
  // Azimuth sweeps from east to west, fastest at the equator, and its arc is
  // the same shape as the elevation's because both follow the same hour angle.
  const azArc = lerp(150, 100, clamp(Math.abs(latitudeDeg) / 90, 0, 1));
  const sweep = -azArc / 2 + azArc * day;
  const azimuthDeg = latitudeDeg >= 0 ? 180 + sweep : (360 - sweep) % 360;

  return {
    t: day,
    elevationDeg,
    elevation: elevationDeg * DEG,
    azimuthDeg,
    azimuth: azimuthDeg * DEG,
    above,
    altitude: Math.max(0, Math.sin(Math.max(0, elevationDeg) * DEG)),
  };
}

/**
 * How long a shadow is, as a multiple of the height of the thing casting it.
 *
 * The ground geometry is exact: a shadow of an object `h` tall, with the sun
 * at elevation `e`, is `h / tan(e)` long. It is the one number in a drawing
 * that can be checked against a sundial rather than against taste, and it
 * diverges from a straight line exactly where a straight line looks wrong:
 * a linear ramp through noon is far too short either side of it, and comes
 * nowhere near the long raking shadow you get at an actual sunrise.
 *
 * Two guards, both physical rather than aesthetic. Below `minElevationDeg` the
 * sun is behind the horizon and a shadow has no defined length, so it is
 * held at the horizon value rather than sent to infinity. Above it, the
 * result is clamped to `max` heights of the caster, because an infinitely
 * long shadow is a picture of a line, not of a shadow.
 *
 * @param {number} h the height of the caster, in the scene's own units
 * @param {number} elevationDeg the sun's elevation in degrees
 * @param {{ minElevationDeg?: number, max?: number }} [opts]
 *   `max` is a multiple of `h`, so it scales with the thing casting.
 * @returns {number} the length of the shadow, in the same units as `h`
 */
export function shadowLength(h, elevationDeg, { minElevationDeg = 0.5, max = 24 } = {}) {
  if (!(h > 0)) return 0;
  const e = Math.max(minElevationDeg, elevationDeg);
  return Math.min(max * h, h / Math.tan(e * DEG));
}

/** The direction a shadow is thrown, as a unit vector on the ground plane.
 *
 * Away from the sun, always. A scene passes the sun's azimuth and gets the
 * opposite, so a shadow on the wrong side of its caster is a bug the model
 * cannot hide.
 *
 * Azimuth is a compass bearing, 0 = north and 90 = east. On a canvas +x runs
 * east and +y runs *down* the page, which is south, so north is -y. The
 * bearing is therefore not the screen angle: it is mapped through the pair
 * (sin, -cos) before being reversed.
 *
 * @param {number} azimuthDeg the sun's azimuth in degrees, 0 = north, 90 = east
 * @returns {[number, number]} unit vector in the ground plane
 */
export function shadowDir(azimuthDeg) {
  const a = azimuthDeg * DEG;
  return [-Math.sin(a), Math.cos(a)];
}

/**
 * How warm the light is, 0 (no light) to 1 (full midday).
 *
 * Derived from the sun's own altitude rather than being a separate curve, so
 * a scene that moves the sun cannot leave the light colour behind. Low sun
 * has passed through more atmosphere, so it is redder and dimmer; the return
 * is the pair a canvas wants, since a colour is never useful without a
 * strength to multiply it by.
 *
 * @param {number} elevationDeg
 * @param {{ min?: number }} [opts]
 * @returns {{ warmth: number, intensity: number }}
 */
export function daylight(elevationDeg, { min = 0.06 } = {}) {
  const a = Math.max(0, Math.sin(Math.max(0, elevationDeg) * DEG));
  return { warmth: 1 - a, intensity: Math.max(min, a) };
}
