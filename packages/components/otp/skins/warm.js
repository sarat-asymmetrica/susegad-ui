// Warm: stamp boxes. Each box is a small carved frame with a double rule, and
// each digit inks in as it is typed: it lands a touch large and soft and
// settles into the paper, with the ink a little starved, as a rubber stamp
// prints. The texture is an SVG filter (turbulence cut from the ink's alpha).
// Also exports `ink`, which the playful skin builds on.

import { boxes } from './boxes.js';
import { landing, boxPose } from '../otp.core.js';

let uid = 0;

/** The shared ink texture for one element, as an SVG filter; returns its remover. */
export function inkFilter(host, amount = 1) {
  const id = `sg-otp-ink-${++uid}`, NS = 'http://www.w3.org/2000/svg';
  const svg = host.ownerDocument.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'sg-otp-defs');
  svg.innerHTML = `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="${uid * 7}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${-2.4 * amount} ${1.9 + 0.55 * amount}" result="a"/><feComposite in="SourceGraphic" in2="a" operator="in"/></filter>`;
  host.append(svg);
  host.style.setProperty('--sg-otp-ink', `url(#${id})`);
  return () => { svg.remove(); host.style.removeProperty('--sg-otp-ink'); };
}

export function ink(host, ctx, { register, amount, spread = false }) {
  const off = inkFilter(host, amount);
  const pose = (seed, i) => boxPose(seed, i, register);
  const b = boxes(host, ctx, {
    pose: register === 'playful' ? pose : null,
    land(box, digit, i, k) {
      const l = landing(ctx.motion, 0);
      if (!l) return [];
      const delay = k * 55, out = [digit.animate(l.frames, { ...l.timing, delay, fill: 'backwards' })];
      if (spread && l.spread) {
        const halo = host.ownerDocument.createElement('span');
        halo.className = 'sg-otp-spread';
        box.append(halo);
        const a = halo.animate(l.spread.frames, { ...l.spread.timing, delay: delay + l.spread.timing.delay, fill: 'both' });
        a.finished.finally(() => halo.remove()).catch(() => {});
        out.push(a);
      }
      return out;
    },
  });
  return { update: b.update, destroy() { b.destroy(); off(); } };
}

export const mount = (host, ctx) => ink(host, ctx, { register: 'warm', amount: 1 });
