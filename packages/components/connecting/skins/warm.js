// Warm: seven fireflies in a small slice of night. They blink on their own while
// connecting, and fall into step once connected. Offline, they dim and slow.
import { fireflySkin } from './fireflies.js';

export const mount = fireflySkin({ n: 7, W: 64, H: 24, glowR: 7, bright: 1, blades: 9, seed: 3 });
