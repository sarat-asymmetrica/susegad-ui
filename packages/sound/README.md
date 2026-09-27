# packages/sound

The synthesised UI vocabulary, the global switch and paired haptics. See
`docs/decisions/0015-sound-consent-and-av-packages.md` for the two kinds of
sound and their two kinds of consent, and `SKILL.md` §5/§6 once it covers
sound, for how to use the switch on a page.

```js
import { soundOn, setSoundOn, onSoundChange, play, haptic } from './index.js';

// inside a user-gesture handler, e.g. a switch control's change event
button.addEventListener('click', () => setSoundOn(!soundOn()));

// anywhere, any time: a no-op unless the switch is on and a gesture has happened
play('confirm', { register: 'warm' });
haptic('confirm');
```

- `switch.js` owns the on/off state (`localStorage['sg-sound']`, every access
  wrapped in try/catch), the one shared `AudioContext`, and the rule that
  nothing plays before the first gesture on the page.
- `patches.js` is pure data: which of the four words (tick, confirm, complete,
  error) each register plays, and how loud. Runs and is tested in Node.
- `player.js` is the thin, side-effecting half: it turns a patch into
  oscillators and gain envelopes on a context that already exists.
- `haptics.js` pairs a `navigator.vibrate` pattern to each word, pure data.
- `scapes/` holds the soundscapes (Paus rain, Rampon koel), which a scene
  imports on its own; they are not part of this package's bundle.

Budget: 14 KB of behaviour source for the whole package (switch, patches,
player, haptics), same figure as a component's behaviour allowance (0009)
since this is the layer every sound-making piece in the library sits on.
