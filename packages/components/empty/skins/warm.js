// Warm: the scene beside the words. It follows the page's register, so it
// drifts slowly here and shows its finished still under reduced motion. The
// scene keeps its own name for assistive technology and its pause button, so
// anyone can stop the motion.
//
// The scene comes after the words and the action in the document (CSS shows
// it first), so Tab reaches the action before the picture. It is asked not to
// take focus as an interactive drawing unless the builder says
// scene-interactive="true". And it loads only once the empty state is on screen.

export function mount(el) {
  let scene = null, name = null, applied = {}, dead = false, seen = false, pending = null;
  // one look: once the empty state has been on screen, the scene may load
  const io = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    seen = true; io.disconnect();
    if (pending) api.update(pending);
  });
  if (io) io.observe(el); else seen = true;
  const apply = params => {
    for (const k of Object.keys(applied)) if (!(k in params)) scene.removeAttribute(k);
    for (const [k, v] of Object.entries(params)) scene.setAttribute(k, v);
    if (!('interactive' in params)) scene.setAttribute('interactive', 'false');
    applied = params;
  };
  const api = {
    async update(s) {
      if (s.scene === name) { if (scene) apply(s.params); return; }
      // not on screen yet: nothing to load until it is
      if (!seen) { pending = s; return; }
      name = s.scene;
      // the scene and <sg-scene> load only when a warm or playful page needs them
      try {
        await import('../../../core/index.js');
        await import(`../../../scenes/${name}/index.js`);
      } catch (err) { console.warn(`sg-empty: the ${name} scene did not load; the words still show.`, err); return; }
      if (dead || name !== s.scene) return;
      // name and params go on before it connects, so it mounts once, as the right scene
      scene?.remove();
      scene = document.createElement('sg-scene');
      scene.className = 'sg-empty-scene';
      scene.setAttribute('name', name);
      applied = {};
      apply(s.params);
      el.append(scene);
    },
    // drawn with CSS custom properties (and the scene repaints itself), so a theme change needs nothing
    restyle() {},
    destroy() { dead = true; io?.disconnect(); scene?.remove(); },
  };
  return api;
}
