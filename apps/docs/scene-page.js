// A scene's page: the words are already HTML (site.core.js); this puts the
// drawing live into its stage, with the controls and Look closer.
//
// Library code is imported by relative path from the repo tree
// (../../packages/...). build.mjs rewrites that prefix for the built copy.

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const lazy = document.querySelector('main sg-lazy');
const stage = lazy?.querySelector('sg-scene');
const controls = document.querySelector('.scene-art .controls');
const pkg = rel => new URL(`../../packages/${rel}`, import.meta.url).href;

const done = () => { window.__ready = true; };

// The poster is the first paint. <sg-lazy> fetches the scene when it is near the screen and nothing
// asks for stillness (reduced motion, Save-Data, the quiet register, a small device); a viewer who
// presses Play gets it anyway. The words and the poster read without any of this.
let defined = false;
if (lazy) {
  try { await import(pkg('core/lazy.js')); defined = true; } catch (err) { console.warn('the scene loader did not load, so the poster stays', err?.message ?? err); }
}

if (defined) {
  const live = controls.querySelector('.live');
  const btn = act => controls.querySelector(`[data-act="${act}"]`);
  const started = () => lazy.state === 'live';
  /** The viewer's intent, not the loop: a scene off screen is paused but still "playing". */
  const wants = () => !!(stage.wanted ?? stage.playing);
  function sync() {
    const on = started(), loading = lazy.state === 'loading', held = !!lazy.holding;
    // Play stays first and the row keeps its room, so nothing moves under the finger; buttons show as they apply.
    const show = (act, v) => btn(act).classList.toggle('is-off', !v);
    show('pause', on || held); show('closer', on || held); show('replay', on); show('reseed', on);
    controls.setAttribute('aria-busy', String(loading));
    btn('pause').textContent = on && wants() ? 'Pause' : 'Play';
    live.textContent = loading ? 'loading the scene' : on && wants() ? 'drawn live in your browser' : stage.dataset.userPaused ? 'paused' : held || on ? 'a still frame; press Play to run it' : '';
  }
  lazy.addEventListener('sg-lazy', () => { sync(); if (started()) done(); else if (lazy.state === 'failed') done(); });
  stage.addEventListener('sg-ready', () => { sync(); done(); }, { once: true });
  // a page whose poster is all anyone sees (held, or not yet scrolled to) is ready as soon as its picture is
  const poster = lazy.querySelector('img');
  const settle = () => { if (lazy.holding || lazy.state === 'failed') done(); };
  poster?.decode().catch(() => {}).then(settle);
  setTimeout(done, 15000); // never hold a check forever; the poster is still a page
  sync();

  // ── the controls ─────────────────────────────────────────────────
  for (const ev of ['sg-play', 'sg-pause', 'sg-state']) stage.addEventListener(ev, sync);
  btn('replay').addEventListener('click', () => { delete stage.dataset.userPaused; stage.replay?.(); stage.play?.(); sync(); });
  btn('reseed').addEventListener('click', () => { stage.reseed?.(); sync(); });
  btn('pause').addEventListener('click', () => {
    if (!started()) { lazy.start(); return; } // held back until now: the viewer asked
    if (wants()) { stage.pause?.(); stage.dataset.userPaused = '1'; }
    else { delete stage.dataset.userPaused; stage.play?.(); }
    sync();
  });
  // the register decides whether scenes move; keep the label truthful when it changes
  new MutationObserver(() => requestAnimationFrame(sync)).observe(root, { attributes: true, attributeFilter: ['data-register'] });
  reduceMotion.addEventListener('change', sync);

  // ── look closer ──────────────────────────────────────────────────
  // The stage morphs into a full view (View Transitions); the running scene is
  // moved, never rebuilt, so it does not restart. Reduced motion just opens it.
  const closer = document.getElementById('closer');
  const slot = document.getElementById('closer-slot');
  const W = Number(stage.closest('.scene-mount')?.style.aspectRatio.split('/')[0]) || 3;
  const H = Number(stage.closest('.scene-mount')?.style.aspectRatio.split('/')[1]) || 2;
  let open = null;
  const morph = fn => (document.startViewTransition && !reduceMotion.matches ? document.startViewTransition(fn) : (fn(), null));
  const move = (el, parent, before = null) => {
    if (parent.moveBefore) { try { parent.moveBefore(el, before); return; } catch { /* fall through */ } }
    parent.insertBefore(el, before);
  };
  const fit = () => {
    if (!open) return;
    const r = slot.getBoundingClientRect();
    stage.style.width = `${Math.floor(Math.min(r.width, r.height * (W / H)))}px`;
  };
  btn('closer').addEventListener('click', async () => {
    if (open) return;
    if (!started() && !(await lazy.start({ play: false }))) return; // held back until now: the viewer asked to look, not to watch it move
    if (open) return;
    const hold = document.createElement('div');
    hold.className = 'stage-hold';
    hold.textContent = 'looking closer';
    hold.style.aspectRatio = `${W} / ${H}`;
    stage.style.viewTransitionName = 'closer-stage';
    morph(() => {
      stage.parentNode.insertBefore(hold, stage);
      document.getElementById('closer-title').textContent = document.getElementById('scene-title').textContent;
      document.getElementById('closer-word').textContent = document.querySelector('.scene-text .word b')?.textContent || '';
      move(stage, slot);
      closer.showModal();
      open = { hold, trigger: btn('closer') };
      fit();
    });
  });
  const restore = () => { move(stage, open.hold.parentNode, open.hold); open.hold.remove(); stage.style.width = ''; };
  function close() {
    if (!open) return;
    const { trigger } = open;
    const t = morph(() => { restore(); open = null; if (closer.open) closer.close(); });
    const after = () => { stage.style.viewTransitionName = ''; trigger.focus({ preventScroll: true }); };
    t ? t.finished.then(after, after) : after();
  }
  document.getElementById('closer-close').addEventListener('click', close);
  closer.addEventListener('cancel', e => { e.preventDefault(); close(); });
  closer.addEventListener('close', () => {
    if (!open) return;
    const { trigger } = open;
    restore(); open = null;
    stage.style.viewTransitionName = '';
    trigger.focus({ preventScroll: true });
  });
  addEventListener('resize', fit);
} else {
  done();
}
