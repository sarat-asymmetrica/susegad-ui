// The boxes, shared by the three skins: each shows its digit, the current one
// shows the caret, and a digit that has just arrived is handed to `land` so
// the register can ink or stamp it. Digits already there when a skin mounts
// (a server value, a register change) are shown as they are, never replayed.

export function boxes(host, ctx, { land = null, pose = null } = {}) {
  let prev = null, anims = [];
  const row = () => [...(host.querySelector('.sg-otp-boxes')?.children ?? [])];
  return {
    update(s) {
      const bs = row();
      let k = 0;
      bs.forEach((b, i) => {
        const ch = s.value[i] ?? '', digit = b.firstElementChild;
        if (pose) { const p = pose(s.seed, i); b.style.setProperty('--sg-otp-rotate', `${p.rotate}deg`); b.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotate}deg)`; }
        b.toggleAttribute('data-filled', !!ch);
        b.toggleAttribute('data-active', s.active.includes(i));
        if (digit.textContent === ch) return;
        digit.textContent = ch;
        if (ch && prev !== null && land && ctx.motion !== 'still') {
          // a paste lands left to right, one stamp after another
          for (const a of land(b, digit, i, k++)) { anims.push(a); a.finished.then(() => a.cancel(), () => {}).finally(() => { anims = anims.filter(x => x !== a); }); }
        }
      });
      host.toggleAttribute('data-complete', s.complete);
      prev = s.value;
    },
    destroy() {
      anims.forEach(a => a.cancel());
      for (const b of row()) { b.style.removeProperty('--sg-otp-rotate'); b.style.transform = ''; }
    },
  };
}
