// The demo page's wiring: mounts the spread on index.html, driving the
// paus scene from story/spread.json's scene_cues. Your own page imports
// recipe.js and passes its own cues (see README.md) instead of reading the
// story file directly, since a builder's project won't have `story/`.

import { mountStorybookSpread } from './recipe.js';

const root = document.getElementById('spread');
if (root) {
  // Listen before anything async, so the scene's one sg-ready (its first painted frame) is never missed.
  const scene = root.querySelector('sg-scene');
  const painted = scene ? new Promise(r => scene.addEventListener('sg-ready', r, { once: true })) : Promise.resolve();
  fetch('./story/spread.json')
    .then(r => r.json())
    .then(story => {
      mountStorybookSpread(root, { cues: story.scene_cues.cues, defaultLang: 'en' });
      customElements.whenDefined('sg-narration').then(() => painted).then(() => { window.__ready = true; });
    })
    .catch(err => {
      console.warn('storybook-spread demo: could not read story/spread.json; mounting without scene cues.', err);
      mountStorybookSpread(root, { cues: [], defaultLang: 'en' });
      painted.then(() => { window.__ready = true; });
    });
}
