// Tumble: the overlay the three skins share. It measures the letters of the real heading where the browser
// put them (a Range for each, after the web fonts have arrived), lays an aria-hidden copy of them over the
// heading in the same places, hides the real text for as long as the copy moves, plays the arrival with Web
// Animations, and then takes the copy away and shows the real text again. The text is never changed: the
// heading keeps its one string, and everything here is a layer on top that lives for about a second.
//
// The heading is never left hidden. It is hidden only once the copy is built and the animations have started;
// any error, a resize, the element leaving the page, or a timeout puts it back. A heading whose colour is
// transparent (gradient text) is left alone, because a copy of it would be invisible too.
//
// Everything is set through the CSSOM and attributes: no <style> element and no style attribute in markup.
import { MAX_LETTERS, isClear as clear, letters, groupLines, warmPlan, warmFrames, playfulPlan, dropFrames, totalMs } from '../tumble.core.js';

const COPY = ['font', 'color', 'letterSpacing', 'textTransform', 'textShadow', 'fontVariationSettings', 'fontFeatureSettings', 'fontKerning', 'fontStretch'];

/**
 * @param {HTMLElement & { native: Element|null, release?: () => void }} host
 * @param {object} ctx the component context (motion, emit)
 * @param {{ look: 'quiet'|'warm'|'playful' }} how
 */
export function mountTumble(host, ctx, { look }) {
  const doc = host.ownerDocument, win = doc.defaultView;
  let state = {}, layer = null, anims = [], running = null, played = false, io = null, seen = null;
  let saved = [], hostStyle = [], failsafe = 0;

  const moves = () => look !== 'quiet' && ctx.motion !== 'still';
  const heading = () => host.native;

  // ── when to play ────────────────────────────────────────────────────────

  function auto() {
    if (seen && !played && !running && !state.manual && moves() && heading()) play();
  }
  if (typeof IntersectionObserver === 'undefined') seen = true;
  else {
    io = new IntersectionObserver(list => { seen = list[list.length - 1].isIntersecting; auto(); });
    io.observe(host);
  }

  function play() {
    if (!moves() || !heading()) { host.release?.(); return Promise.resolve(); }
    if (running) return running;
    played = true;
    running = run().finally(() => { running = null; });
    return running;
  }

  /** Wait for the fonts the heading uses, but never for ever: a heading arriving late is still a heading. */
  function fonts() {
    const ready = doc.fonts?.ready ?? Promise.resolve();
    return Promise.race([ready, new Promise(r => setTimeout(r, 3000))]).catch(() => {});
  }

  async function run() {
    let started = false;
    try {
      await fonts();
      if (!host.isConnected || !moves() || !heading()) return;
      const built = build();
      if (!built) return;
      started = true;
      ctx.emit('sg-tumble-start', { look });
      hide();
      host.append(built.layer);
      layer = built.layer;
      anims = built.animate();
      win.addEventListener('resize', restore, { once: true });
      await new Promise(resolve => {
        failsafe = setTimeout(resolve, built.total + 1500);
        Promise.all(anims.map(a => a.finished)).then(resolve, resolve);
      });
    } catch (err) {
      console.warn('sg-tumble: the heading is shown as it is.', err);
    } finally {
      restore();
      if (started) ctx.emit('sg-tumble-done', { look });
    }
  }

  // ── building the copy ─────────────────────────────────────────────────────

  function build() {
    const h = heading();
    // measure with the real text showing, so its colour reads as the colour it is
    const held = host.dataset.state;
    if (held) delete host.dataset.state;
    try {
      ensureBox();
      const hostRect = host.getBoundingClientRect();
      if (!hostRect.width) return null;
      const range = doc.createRange(), walker = doc.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      const styles = new Map(), boxes = [];
      for (let n; (n = walker.nextNode());) {
        const el = n.parentElement;
        if (!styles.has(el)) {
          const cs = win.getComputedStyle(el);
          const fill = cs.getPropertyValue('-webkit-text-fill-color') || cs.color;
          styles.set(el, { copy: Object.fromEntries(COPY.map(k => [k, cs[k]])), color: fill, stroke: cs.getPropertyValue('-webkit-text-stroke') });
        }
        const st = styles.get(el);
        if (clear(st.color)) return null;
        for (const l of letters(n.data)) {
          range.setStart(n, l.at); range.setEnd(n, l.at + l.len);
          const r = [...range.getClientRects()].find(q => q.width > 0);
          if (!r) continue;
          boxes.push({ ch: l.ch, x: r.left - hostRect.left, y: r.top - hostRect.top, w: r.width, h: r.height, st });
          if (boxes.length > MAX_LETTERS) return null;
        }
      }
      if (!boxes.length) return null;
      return compose(boxes, hostRect);
    } finally {
      if (held) host.dataset.state = held;
    }
  }

  function compose(boxes, hostRect) {
    const lay = doc.createElement('div');
    lay.className = 'sg-tumble-layer';
    lay.setAttribute('aria-hidden', 'true');
    lay.dataset.look = look;
    lay.style.position = 'absolute'; lay.style.inset = '0'; lay.style.pointerEvents = 'none'; lay.style.userSelect = 'none';
    const groups = groupLines(boxes), lineEls = [], letterEls = new Array(boxes.length);
    for (const idx of groups) {
      const top = Math.min(...idx.map(i => boxes[i].y)), height = Math.max(...idx.map(i => boxes[i].h));
      const line = doc.createElement('div');
      line.className = 'sg-tumble-line';
      line.style.position = 'absolute'; line.style.left = '0'; line.style.top = `${top}px`; line.style.width = `${hostRect.width}px`; line.style.height = `${height}px`;
      for (const i of idx) {
        const b = boxes[i], s = doc.createElement('span');
        s.className = 'sg-tumble-letter';
        s.textContent = b.ch;
        Object.assign(s.style, b.st.copy);
        s.style.color = b.st.color;
        if (b.st.stroke) s.style.setProperty('-webkit-text-stroke', b.st.stroke);
        s.style.position = 'absolute'; s.style.whiteSpace = 'pre';
        s.style.left = `${b.x}px`; s.style.top = `${b.y - top}px`; s.style.height = `${b.h}px`; s.style.lineHeight = `${b.h}px`;
        line.append(s);
        letterEls[i] = s;
      }
      lay.append(line);
      lineEls.push(line);
    }
    let plan, total;
    if (look === 'warm') { plan = warmPlan(lineEls.length, hostRect.width); total = totalMs(plan); }
    else { plan = playfulPlan(boxes.length, state.seed); total = totalMs(plan); }
    const animate = () => look === 'warm'
      ? lineEls.map((el, i) => el.animate(warmFrames(plan[i].from), { delay: plan[i].delay, duration: plan[i].duration, fill: 'both' }))
      : letterEls.map((el, i) => el.animate(dropFrames(plan[i], boxes[i].h), { delay: plan[i].delay, duration: plan[i].duration, fill: 'both' }));
    if (look === 'warm') { lay.style.overflow = 'clip'; lay.style.setProperty('overflow-clip-margin', '0.4em'); }
    return { layer: lay, animate, total };
  }

  // ── hiding the real text, and putting it back ──────────────────────────────

  /** The copy is positioned against the host: if the stylesheet is missing, make it a positioned block here. */
  function ensureBox() {
    const cs = win.getComputedStyle(host);
    if (cs.display === 'inline') { hostStyle.push(['display', host.style.display]); host.style.display = 'block'; }
    if (cs.position === 'static') { hostStyle.push(['position', host.style.position]); host.style.position = 'relative'; }
  }

  function hide() {
    const h = heading();
    host.dataset.state = 'playing';
    // the stylesheet normally does this; if it is missing, do it here so the copy never doubles the text
    if (!clear(win.getComputedStyle(h).color)) {
      for (const el of [h, ...h.querySelectorAll('*')]) {
        saved.push([el, el.style.getPropertyValue('color'), el.style.getPropertyPriority('color')]);
        el.style.setProperty('color', 'transparent', 'important');
      }
    }
  }

  /** Everything back as it was: the animations stopped, the copy gone, the real text showing. Safe to call twice. */
  function restore() {
    clearTimeout(failsafe);
    win.removeEventListener('resize', restore);
    for (const a of anims) { try { a.cancel(); } catch { /* already gone */ } }
    anims = [];
    layer?.remove(); layer = null;
    for (const [el, value, priority] of saved) { if (value) el.style.setProperty('color', value, priority); else el.style.removeProperty('color'); }
    saved = [];
    for (const [prop, value] of hostStyle) { if (value) host.style[prop] = value; else host.style.removeProperty(prop); }
    hostStyle = [];
    if (host.dataset.state === 'playing' || host.dataset.state === 'held') host.dataset.state = played ? 'done' : '';
    if (!host.dataset.state) delete host.dataset.state;
    host.release?.();
  }

  return {
    play,
    update(next) {
      state = next;
      if (!moves() && host.dataset.state === 'held') host.release?.();
      auto();
    },
    restyle() {},
    destroy() {
      io?.disconnect();
      restore();
    },
  };
}
