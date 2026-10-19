// The pixel comparison now lives in pixels.mjs (one distance rule, its reason in that file's header).
// This path stays so every import keeps working.
export { pixelDistance, comparePixels, CHANGED_THRESHOLD, LAYER_THRESHOLD } from './pixels.mjs';
