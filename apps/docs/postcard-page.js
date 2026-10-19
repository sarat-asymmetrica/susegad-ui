// The /postcard page: the maker (packages/recipes/picture-postcard) wired to the page's own scene picker.
//
// The maker reads the scene from #scene (here a hidden input) and listens for its change. A name picks a scene from its
// seed until the person chooses one themselves: the same name always lands on the same scene, and a scene they picked
// stays. Nothing here sends anything anywhere: the page makes no request of its own after it has loaded.

import { sceneFromQuery, KIT_WORDS } from './postcard-kit.core.js';
import { mountPostcard, SCENES, DEFAULT_SCENE, sceneForSeed, seedFor, normaliseName, WORDS, GOA_OCT_2026 } from '../../packages/recipes/picture-postcard/recipe.js';

const $ = id => document.getElementById(id);
const nameEl = $('name'), sceneEl = $('scene'), radios = [...document.querySelectorAll('input[name="scene-pick"]')];
let pinned = false; // the person chose a scene: the name no longer picks

const show = name => { sceneEl.value = name; for (const r of radios) r.checked = r.value === name; };
const choose = name => { pinned = true; show(name); sceneEl.dispatchEvent(new Event('change', { bubbles: true })); };

// before the maker's own listener, so the scene is already the name's when the card is drawn after the typing pauses
nameEl.addEventListener('input', () => {
  if (pinned) return;
  const name = normaliseName(nameEl.value);
  show(name ? sceneForSeed(seedFor(name)) : DEFAULT_SCENE);
});
for (const r of radios) r.addEventListener('change', () => { if (r.checked) choose(r.value); });
$('another-scene').addEventListener('click', () => {
  const at = SCENES.findIndex(s => s.name === sceneEl.value);
  choose(SCENES[(at + 1) % SCENES.length].name);
});

// a link may name a scene (?scene=ferry); only a scene of this page's own is taken, and nothing else is read from the address
const linked = sceneFromQuery(location.search, SCENES, null);
if (linked) pinned = true; // the sender's choice stays when a name is typed, the default scene included (the email links ?scene=ferry)
show(linked ?? DEFAULT_SCENE);

// press and hold: after Save picture the finished PNG is shown too, for a browser (an in-app WebView) that downloads nothing
let holdUrl = null;
$('maker').addEventListener('postcard-made', e => {
  const { out, how, share } = e.detail;
  if (share || how === 'cancelled') return;
  if (holdUrl) URL.revokeObjectURL(holdUrl);
  const img = $('hold-img');
  holdUrl = URL.createObjectURL(out.blob);
  img.alt = $('card').getAttribute('aria-label') ?? '';
  img.src = holdUrl; img.hidden = false;
  $('hold-line').textContent = KIT_WORDS.hold.line;
});

mountPostcard(document, { event: GOA_OCT_2026 })
  .catch(e => { $('status').textContent = e?.phase === 'scene' ? WORDS.errScene : WORDS.errDraw; })
  .then(() => document.fonts.ready)
  .then(() => { window.__ready = true; });
