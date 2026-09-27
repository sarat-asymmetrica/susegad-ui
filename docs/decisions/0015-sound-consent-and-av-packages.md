# 0015: who may make a sound, and where the AV code lives

*Sutradhar, 25 September 2026, Wave 4. Status: accepted. Binds karigar-sound, karigar-narration and karigar-player. (0011 to 0014 are on `wave/3-folio`; this number avoids them.)*

## Packages

- `packages/sound/`: the synthesised vocabulary (tick, confirm, complete, error), the global switch, paired haptics. Soundscapes in `packages/sound/scapes/`. Owner: karigar-sound.
- `packages/narration/`: provider interface, the Sarvam adapter, a stub provider, the pure timing core (phrases, WAV durations, word weights), WebVTT write and parse, the highlight driver, the offline fallback. Owner: karigar-narration.
- `packages/player/` and `packages/export/`: the Susegad player, video treatments, scene export. Owner: karigar-player.
- `packages/recipes/storybook-spread/`: code owned by karigar-narration; `story/` inside it owned by Kathakar.

## Two kinds of sound, two kinds of consent

1. **Ambient and interface sound** (the vocabulary, soundscapes, haptics) plays only when the global switch is on. The switch is off by default, is turned on only by a user gesture, and is remembered per viewer. Nothing plays before a user gesture on the page, even when the remembered switch is on: the first gesture after load resumes the `AudioContext`, and only then do sounds start.
2. **Content sound** (narration, video audio) plays when the person presses its own play control. That press is the consent. It does not need the global switch, and it does not turn the switch on. Autoplay of content sound is never allowed.

The register sets the vocabulary when the switch is on: quiet plays confirmations only, warm plays soft confirmations and optional ambience, playful plays the full vocabulary (the charter's register table). Reduced motion does not silence sound. Save-Data and low power step down one register, as for visuals.

## The switch's API (from `packages/sound/switch.js`)

```js
import { soundOn, setSoundOn, onSoundChange, play, haptic } from '…/sound/index.js';
soundOn();                 // boolean: the switch, read from storage (false if storage throws)
setSoundOn(true);          // call only inside a user-gesture handler; persists; fires the event
onSoundChange(fn);         // returns an unsubscribe function
play('confirm', { register, el });   // no-op unless the switch is on and a gesture has happened
haptic('confirm');         // navigator.vibrate pattern paired to the sound; same rules
```

The event is `sg-sound-change` on `document`, with `detail: { on }`, so an element can listen without importing anything. Storage is `localStorage['sg-sound']`, every access wrapped in try/catch. `play()` and `haptic()` never throw.

karigar-sound writes this module first and commits it before the soundscapes, so the others can import it. If the API has to change, the change goes into this file first and names who agreed to it.
