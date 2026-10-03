// Playful: the water livelier, and the camera leans with the pointer, or with
// the phone's tilt where the browser gives it without asking. Decoration only:
// nothing here carries meaning, and the element never takes focus for it.

export function mount(host, ctx) {
  host.registerChanged();
  const onMove = e => {
    if (ctx.motion !== 'full') return;
    const r = host.getBoundingClientRect();
    host.pointerTarget = [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1];
  };
  const onLeave = () => { host.pointerTarget = [0, 0]; };
  // gamma: left-right tilt, beta: front-back; about 25 degrees either way is a full lean
  const onTilt = e => {
    if (ctx.motion !== 'full' || e.gamma == null) return;
    host.pointerTarget = [Math.max(-1, Math.min(1, e.gamma / 25)), Math.max(-1, Math.min(1, (e.beta - 45) / 25))];
  };
  const target = host.closest('[data-parallax-root]') ?? host;
  target.addEventListener('pointermove', onMove, { passive: true });
  target.addEventListener('pointerleave', onLeave);
  // iOS asks permission for orientation; we never ask, so there it stays still
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') addEventListener('deviceorientation', onTilt);
  return {
    update() {},
    restyle() { host.regrade(); },
    destroy() {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerleave', onLeave);
      removeEventListener('deviceorientation', onTilt);
      host.pointerTarget = [0, 0];
    },
  };
}
