// The waveform, shared by the three skins: one SVG of bars fitted to the
// wave's measured width, the played ones marked as the audio moves. The bars
// move only when the sound does (honest motion); nothing loops.

import { barsFrom, barCount } from '../voice-note.core.js';
import { rng } from '../../../engine/src/rng.js';

const NS = 'http://www.w3.org/2000/svg';

/**
 * @param {HTMLElement} host
 * @param {{ pitch: number, width: number, round?: boolean, pencil?: number }} look
 *   pitch: px from one bar to the next; width: a bar's width; round: round caps;
 *   pencil: how far a warm bar's ends wander, in px
 */
export function bars(host, { pitch, width, round = false, pencil = 0 }) {
  const doc = host.ownerDocument;
  const wave = host.querySelector('.sg-voice-wave');
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'sg-voice-bars');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  wave?.prepend(svg);
  let key = '', els = [], last = null, raf = 0;

  function draw() {
    raf = 0;
    if (!wave || !last) return;
    const w = Math.round(wave.clientWidth), h = Math.round(wave.clientHeight);
    const n = barCount(w, pitch), k = `${w}|${h}|${last.peaks.length}|${last.peaks[0]}`;
    if (w && h && k !== key) {
      key = k;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const vals = barsFrom(last.peaks, n), r = rng(`bars:${last.peaks.length}`);
      const gap = (w - n * pitch) / 2 + (pitch - width) / 2;
      svg.replaceChildren();
      els = vals.map((v, i) => {
        const x = gap + i * pitch + width / 2, half = Math.max(width / 2, (v * (h - width)) / 2);
        const line = doc.createElementNS(NS, 'path');
        const j = () => (pencil ? r.range(-pencil, pencil) : 0);
        line.setAttribute('d', `M${(x + j() * 0.3).toFixed(2)} ${(h / 2 - half + j()).toFixed(2)}L${(x + j() * 0.3).toFixed(2)} ${(h / 2 + half + j()).toFixed(2)}`);
        line.setAttribute('stroke-width', String(width));
        line.setAttribute('stroke-linecap', round || pencil ? 'round' : 'butt');
        svg.append(line);
        return line;
      });
    }
    const played = Math.round(last.fraction * els.length);
    els.forEach((el, i) => el.classList.toggle('sg-played', i < played));
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };
  const ro = new ResizeObserver(() => { key = ''; schedule(); });
  if (wave) ro.observe(wave);

  return {
    update(s) { last = s; schedule(); },
    destroy() { ro.disconnect(); cancelAnimationFrame(raf); svg.remove(); },
  };
}
