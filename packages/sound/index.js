// packages/sound: the synthesised vocabulary, the global switch and paired
// haptics (decision 0015). Soundscapes are in sound/scapes/, imported
// separately by the scene that uses them.

export { soundOn, setSoundOn, onSoundChange, play, haptic, sceneContext } from './switch.js';
export { VOCAB, patchFor } from './patches.js';
export { patternFor } from './haptics.js';
