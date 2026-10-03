// <sg-scene movable>: the words you can move (decision 0021). Loaded by
// scene-element.js the first time a scene carries the attribute; nothing else
// imports it, so a page without `movable` never fetches it.
//
// A grip (a real button) at the panel's corner moves the reading panel by CSS
// transform, clamped inside the stage. Pointer Events with capture on the grip
// only, so selecting text and scrolling a phone still work; arrow keys on the
// grip do the same job, Home puts the words back. The scene re-measures its
// calm rects on each move, once a frame at most, so a renderer makes room live.
// The place is remembered by the page: `sg-words-moved` out, `words-at` in.

import { room, canMove, placeOf, offsetOf, clampTo, nudge, dirOf, avoid, movedSaid, homeSaid, limitSaid, parseWordsAt } from './movable.core.js';

const CSS = `
:host([movable]) .panel{position:relative}
.panel > .grip{position:absolute;z-index:3;top:-13px;right:-13px;width:30px;height:30px;display:grid;place-items:center;padding:0;margin:0;border:1px solid var(--sg-rule-strong,GrayText);border-radius:50%;
 background:var(--sg-surface-raised,Canvas);color:var(--sg-text,CanvasText);opacity:1;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.panel > .grip[hidden]{display:none}
.panel > .grip:hover{background:var(--sg-surface-sunk,var(--sg-surface-raised,Canvas))}
.panel.moving > .grip{cursor:grabbing}
.grip svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.panel.moving{will-change:transform}
@supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
 .panel.glass{background:color-mix(in oklab,var(--sg-surface-raised,Canvas) var(--sg-glass-tint,74%),transparent);
  -webkit-backdrop-filter:blur(var(--sg-glass-blur,14px)) saturate(1.15);backdrop-filter:blur(var(--sg-glass-blur,14px)) saturate(1.15);
  box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--sg-rule-strong,GrayText) 45%,transparent),0 14px 30px -18px var(--sg-shadow,rgb(0 0 0/.4))}
 .panel.glass[data-glass=playful]{background-image:linear-gradient(112deg,color-mix(in oklab,var(--sg-surface-raised,Canvas) 70%,transparent),transparent 36%)}
}
@media (forced-colors:active){.panel.glass{background:Canvas;backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none;border:1px solid CanvasText}}`;

const ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2"/></svg>';
const HELP = 'Drag to move the words. Arrow keys move them, Shift for bigger steps, Home puts them back.';

/**
 * @param {HTMLElement} host the <sg-scene>
 * @param {{ root: ShadowRoot, els: object, register: () => string, measure: () => void }} api
 *   root and els are the element's shadow root and its stage, panel and frame; measure re-reads the calm rects (and calls sync)
 */
export function attach(host, { root, els, register, measure }) {
  const { stage, panel, toggle } = els, frame = stage.parentNode;
  const style = document.createElement('style'); style.textContent = CSS;
  const grip = document.createElement('button');
  grip.type = 'button'; grip.className = 'grip'; grip.part = 'grip'; grip.hidden = true;
  grip.setAttribute('aria-label', 'Move the words'); grip.setAttribute('aria-describedby', 'mv-help'); grip.innerHTML = ICON;
  const help = Object.assign(document.createElement('div'), { id: 'mv-help', className: 'vh', textContent: HELP });
  const status = Object.assign(document.createElement('div'), { className: 'vh' }); status.setAttribute('role', 'status');
  root.append(style, help, status); panel.append(grip);

  let place = null;            // { x, y } in [0, 1], or null at home
  let cur = { dx: 0, dy: 0 };   // what is applied now, px
  let told = '', drag = null, raf = 0, on = false;

  let home = null;               // the panel where CSS puts it, client px, from the last rects()
  const rects = () => {
    const s = stage.getBoundingClientRect(), p = panel.getBoundingClientRect();
    home = { left: p.left - cur.dx, top: p.top - cur.dy, width: p.width, height: p.height };
    return room(s, home);
  };
  const apply = r => {
    cur = place ? offsetOf(r, place.x, place.y) : { dx: 0, dy: 0 };
    // the pause button stays clear (WCAG 2.2.2 wants it reachable): the panel steps down or aside where they would meet
    const b = toggle.hidden ? null : toggle.getBoundingClientRect();
    if (place && b?.width) {
      const to = avoid(r, home, cur.dx, cur.dy, b, 22); // 8 px clear, and the grip hangs 13 px over the corner
      if (to.dx !== cur.dx || to.dy !== cur.dy) { cur = to; place = placeOf(r, to.dx, to.dy); } // where the words really are
    }
    panel.style.transform = place ? `translate(${cur.dx}px,${cur.dy}px)` : '';
  };
  const say = text => { if (text !== told) status.textContent = told = text; };
  const fire = () => {
    const r = rects(), p = place ?? placeOf(r, 0, 0);
    host.dispatchEvent(new CustomEvent('sg-words-moved', { bubbles: true, composed: true, detail: { x: p.x, y: p.y, home: !place } }));
  };
  const set = (x, y) => { place = x === null ? null : { x, y }; if (on) apply(rects()); measure(); };
  const setPx = (r, dx, dy) => { const c = clampTo(r, dx, dy), p = placeOf(r, c.dx, c.dy); set(p.x, p.y); return p; };

  // The whole pane keeps the scene's motion out, not only the line boxes: a caption card or a walker under the glass, beside
  // the words, would bleed into them through the blur (decision 0021; the pane joins the list like anything else).
  const clear = () => {
    const m = host.meta;
    if (!on || !m) return host.keepClear('glass', null);
    const s = stage.getBoundingClientRect(), p = panel.getBoundingClientRect(), kx = m.W / s.width, ky = m.H / s.height;
    host.keepClear('glass', { x: (p.left - s.left) * kx, y: (p.top - s.top) * ky, w: p.width * kx, h: p.height * ky });
  };

  // ── what core calls: after every measure and register change
  function sync() {
    const reg = register(), r = rects();
    const want = reg !== 'quiet' && !frame.classList.contains('stacked') && !panel.hidden && canMove(r);
    on = want; grip.hidden = !want;
    panel.classList.toggle('glass', want); want ? (panel.dataset.glass = reg) : delete panel.dataset.glass;
    if (want) apply(r); else { cur = { dx: 0, dy: 0 }; panel.style.transform = ''; }
    clear();
  }

  // ── pointer: capture on the grip, one move a frame
  const pointer = () => {
    raf = 0;
    if (!drag?.to) return;
    const r = rects();
    setPx(r, drag.dx + drag.to[0] - drag.x, drag.dy + drag.to[1] - drag.y);
  };
  grip.addEventListener('pointerdown', e => {
    if (e.button || drag) return;
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: cur.dx, dy: cur.dy, to: null };
    panel.classList.add('moving');
  });
  grip.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) { drag.to = [e.clientX, e.clientY]; raf ||= requestAnimationFrame(pointer); } });
  const drop = e => {
    if (!drag || e.pointerId !== drag.id) return;
    cancelAnimationFrame(raf); raf = 0;
    if (drag.to) pointer();
    const moved = !!drag.to; drag = null;
    panel.classList.remove('moving');
    if (moved && place) { say(movedSaid(place.x, place.y, rects())); fire(); }
  };
  grip.addEventListener('pointerup', drop);
  grip.addEventListener('pointercancel', drop);

  // ── keys: the same moves, in steps
  grip.addEventListener('keydown', e => {
    const r = rects();
    if (e.key === 'Home') { e.preventDefault(); set(null); say(homeSaid()); fire(); return; }
    if (!dirOf(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const s = nudge(r, cur.dx, cur.dy, e.key, e.shiftKey, stage.getBoundingClientRect().width), was = cur;
    if (!s.moved) return say(limitSaid(e.key));
    const p = setPx(r, s.dx, s.dy);
    if (Math.hypot(cur.dx - was.dx, cur.dy - was.dy) < 0.5) return say(limitSaid(e.key)); // the pause button is in the way: nothing moved
    say(movedSaid(p.x, p.y, r)); fire();
  });

  const attr = v => { const p = parseWordsAt(v); place = p; if (on) apply(rects()); measure(); };
  place = parseWordsAt(host.getAttribute('words-at'));
  sync();

  return {
    sync, attr,
    /** { x, y } as places in [0, 1], or null at home. */
    at: () => (place ? { ...place } : null),
    destroy() {
      cancelAnimationFrame(raf); host.keepClear('glass', null);
      panel.style.transform = ''; panel.classList.remove('glass', 'moving'); delete panel.dataset.glass;
      grip.remove(); style.remove(); help.remove(); status.remove();
    },
  };
}
