// Playful: a bright pill with round bars, and the play button springs when
// pressed (at full motion only; never under reduced motion).
import { bars } from './bars.js';
import { press } from '../voice-note.core.js';

export function mount(host, ctx) {
  const b = bars(host, { pitch: 6, width: 3.5, round: true });
  const button = host.querySelector('.sg-voice-play');
  let anim = null;
  const onPress = () => {
    const p = press(ctx.motion);
    if (!p || !button) return;
    anim?.cancel();
    anim = button.animate(p.frames, p.timing);
    anim.finished.then(a => a.cancel(), () => {});
  };
  host.addEventListener('sg-voice-press', onPress);
  return {
    update: b.update,
    destroy() { host.removeEventListener('sg-voice-press', onPress); anim?.cancel(); b.destroy(); },
  };
}
