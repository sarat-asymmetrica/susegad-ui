// Shet: the pure half of the turning year (loaded with year.js, decision
// 0020), deterministic for a seed: the raindrops, drawn from the field's own
// random stream where buildField left off, and the egrets' little simulation,
// which starts from the same seeded plan (egretPlan) the still's settled
// birds are placed from, so the two always agree.

import { lerp, TAU, ease } from '../../engine/index.js';
import { W, H, HY, F, Y_FAR, T, proj, egretPlan } from './model.js';

/** When and where each early drop lands (screen space), in time order. Drawn once per field and kept on it. */
export function rainOf(field) {
  if (field.drops) return field.drops;
  const r = field.rng, drops = [];
  for (let i = 0; i < 2600; i++) {
    const t = T.spots[0] + (T.rainOut[1] - T.spots[0]) * Math.pow(r(), 1.15);
    const y = lerp(Y_FAR + 2, H, Math.pow(r(), 0.8)), x = r.range(-10, W + 10);
    const s = (y - HY) / (H - HY);
    drops.push({ t, x, y, rx: r.range(3, 7.5) * Math.pow(s, 0.7), ry: r.range(3, 7.5) * Math.pow(s, 0.7) * lerp(0.2, 0.9, s) });
  }
  return (field.drops = drops.sort((a, b) => a.t - b.t));
}

/** Two egrets: they arrive with the water, wade and walk the bunds, follow the
 *  harvest, and leave before the mud dries. A stateful little simulation. */
export function makeEgrets(seed) {
  const { r, pick, birds } = egretPlan(seed);
  const flyTo = (b, to, dur) => {
    const from = b.g || [to[0] + 2.2 * (b.i ? 1 : -1), to[1] + 3];
    b.fly = { from, to, u: 0, dur, alt: b.g ? 0.28 : 0.5 }; b.flyTo = to; b.state = 'fly'; b.dir = Math.sign(proj(to[0], to[1])[0] - proj(from[0], from[1])[0]) || b.dir;
  };
  return {
    birds,
    /** Advance by dt. active: are egrets in the field now? follow: a ground depth to stay near (the harvest). */
    step(dt, active, ptr, follow) {
      for (const b of birds) {
        if (b.state === 'away') {
          if (active) flyTo(b, b.target, r.range(4, 6));
          continue;
        }
        if (b.state === 'fly') {
          b.fly.u += dt / b.fly.dur; b.flap += dt * TAU * 2.1;
          if (b.fly.u >= 1) {
            b.fly = null;
            if (b.leaving || !active) { b.state = 'away'; b.g = null; b.leaving = false; }
            else { b.g = b.target = b.flyTo; b.state = 'walk'; b.wait = r.range(1, 2.5); }
          }
          continue;
        }
        if (!active) { flyTo(b, [b.g[0] + 1.6 * (b.i ? 1 : -1), b.g[1] + 4], 5); b.leaving = true; continue; }
        if (!b.g) continue;
        const [x, y] = proj(b.g[0], b.g[1]);
        if (ptr && Math.hypot(ptr[0] - x, ptr[1] - y + 20) < 120) { flyTo(b, pick(null, ptr), r.range(3.2, 4.4)); continue; }
        // walk slowly toward the target, stop, peck, choose again
        if (b.wait > 0) {
          b.wait -= dt; b.peck = Math.max(0, Math.sin(b.wait * 3.2)) ** 2;
          if (b.wait <= 0) b.target = follow ? pick([b.g[0] + r.range(-0.4, 0.4), follow]) : r() < 0.7 ? pick(b.g) : pick();
          continue;
        }
        b.peck = 0;
        const dx = b.target[0] - b.g[0], dz = b.target[1] - b.g[1], d = Math.hypot(dx, dz), sp = 0.07 * dt;
        if (d < sp) { b.g = b.target; b.wait = r.range(1.2, 3.5); continue; }
        b.g = [b.g[0] + (dx / d) * sp, b.g[1] + (dz / d) * sp]; b.walk += dt * 7;
        const sx = Math.sign(proj(b.target[0], b.target[1])[0] - x); if (sx) b.dir = sx;
      }
    },
    /** For a still frame: both birds standing where they meant to go. */
    settle() { for (const b of birds) { b.g = b.target; b.state = 'walk'; b.fly = null; b.wait = 1; b.peck = b.i ? 0.25 : 0; b.dir = b.i ? -1 : 1; } },
    /** Where each bird is on screen now, for drawing and depth sorting. */
    placed() {
      return birds.filter(b => b.state !== 'away').map(b => {
        if (b.fly) {
          const u = ease.inOutSine(b.fly.u), gx = lerp(b.fly.from[0], b.fly.to[0], u), gz = lerp(b.fly.from[1], b.fly.to[1], u);
          const [x, y] = proj(gx, Math.max(0.9, gz)), alt = Math.sin(Math.PI * u) * b.fly.alt + (b.fly.u < 1 && !b.g && u < 0.2 ? 0.3 : 0);
          return { b, gz, x, y: y - (alt * F) / Math.max(0.9, gz), s: 5.2 / Math.max(0.9, gz), fly: b.fly.u < 0.92 };
        }
        const [x, y] = proj(b.g[0], b.g[1]);
        return { b, gz: b.g[1], x, y, s: 5.2 / b.g[1], fly: false };
      });
    },
  };
}

