// A scene's page: the words are already HTML (site.core.js); this puts the
// drawing live into its stage, with the controls and Look closer.
//
// Library code is imported by relative path from the repo tree
// (../../packages/...). build.mjs rewrites that prefix for the built copy.

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const stage = document.querySelector('main sg-scene');
const still = document.querySelector('.scene-still');
const controls = document.querySelector('.scene-art .controls');
const name = stage?.getAttribute('name');
const pkg = rel => new URL(`../../packages/${rel}`, import.meta.url).href;

async function mount() {
  if (!name) return false;
  try {
    await import(pkg('core/index.js'));
    await import(pkg(`scenes/${name}/index.js`));
    return true;
  } catch (err) {
    console.warn(`scene ${name} did not load, so the still stays`, err?.message ?? err);
    return false;
  }
}

const done = () => { window.__ready = true; };

if (await mount()) {
  // the still stays over the stage until the drawing's first frame is on it
  const reveal = () => { if (still) still.hidden = true; };
  stage.addEventListener('sg-ready', () => { reveal(); sync(); done(); }, { once: true });
  setTimeout(done, 15000); // never hold a check forever; the still is still a page

  // ── the controls ─────────────────────────────────────────────────
  controls.hidden = false;
  const btn = act => controls.querySelector(`[data-act="${act}"]`);
  const live = controls.querySelector('.live');
  /** The viewer's intent, not the loop: a scene off screen is paused but still "playing". */
  const wants = () => !!(stage.wanted ?? stage.playing);
  function sync() {
    btn('pause').textContent = wants() ? 'Pause' : 'Play';
    live.textContent = wants() ? 'drawn live in your browser' : stage.dataset.userPaused ? 'paused' : 'a still frame; press Play to run it';
  }
  for (const ev of ['sg-play', 'sg-pause', 'sg-state']) stage.addEventListener(ev, sync);
  btn('replay').addEventListener('click', () => { delete stage.dataset.userPaused; stage.replay?.(); stage.play?.(); sync(); });
  btn('reseed').addEventListener('click', () => { stage.reseed?.(); sync(); });
  btn('pause').addEventListener('click', () => {
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
  btn('closer').addEventListener('click', () => {
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
