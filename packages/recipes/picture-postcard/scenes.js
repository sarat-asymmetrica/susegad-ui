// The scenes a postcard can show. One line each, and the order is the order of the picker; change the array and
// nothing else has to change. `label` is the picker's name for the scene (and a thumbnail's accessible name); `blurb`
// is what the card's alt text says is drawn: "A postcard for Asha: <blurb>. Stamped ..." (words-postcard.md, section 3).
//
// Each is a 3:2 scene (1200 by 800) of the `everyday` tier from Goa, whose still reads well on a card and does not
// lean on ctx.filter blur, which WebKit keeps the value of and draws sharp (docs/BROWSERS.md). The loaders are
// written out so a bundler can see them; none runs until a card asks for its scene.
//
// `still: true` marks a scene that does not move, or whose GIF is too costly (saanj): its card is saved as a picture and
// the page does not offer a GIF of identical frames. dar moves on a script (its key swings in at 0.8 s, catches on the
// hook at 2.3 s and sways to rest, and the bolt slides home at 6.2 s), so its GIF starts as the key is caught.
// `gif` is for a scene whose still is not the best place to start moving. Without it the GIF starts at the still
// and its first frame is the picture on the PNG. With it, every frame is drawn live: `from` is the scene second the
// GIF starts at (a scene that finishes its work, like the sorting desk, moves before its still, not after), and
// `warm` is milliseconds of live frames drawn first and thrown away, for a scene that loads the code for its
// motion when it first has to move.

export const SCENES = Object.freeze([
  { name: 'posta', gif: { from: 1 }, label: 'The old post office', blurb: 'the old post office in Fontainhas, with a red postbox and brass scales', load: () => import('../../scenes/posta/index.js') },
  { name: 'ferry', label: 'The Mandovi ferry', blurb: 'the ferry crossing the Mandovi, with a jetty on each bank', load: () => import('../../scenes/ferry/index.js') },
  { name: 'mithagar', label: 'The salt pans', blurb: 'the salt pans at Ribandar, a grid of bright pans under a low sun', load: () => import('../../scenes/mithagar/index.js') },
  // shet (a paddy field through the year) is out: a GIF of it takes 5 s here, 12 s in WebKit and about 20 s at 4x CPU
  // throttle. Default, awaiting owner. It is lovely as a PNG; put its line back to offer it:
  //   { name: 'shet', gif: { from: 61, warm: 15000 }, blurb: 'a paddy field through the year', load: () => import('../../scenes/shet/index.js') },
  { name: 'tinto', label: 'The village square', blurb: 'a Goan village square, with a bus, a big tree and people about their morning', load: () => import('../../scenes/tinto/index.js') },
  { name: 'saanj', still: true /* its GIF works: swap for gif: { from: 49 }, but its first frame takes 1.5 s, 5 s at 4x, in one task */, label: 'Palms at dusk', blurb: 'palms against the dusk sky, with a flock of starlings coming home to roost', load: () => import('../../scenes/saanj/index.js') },
  { name: 'dar', gif: { from: 2.3 }, label: 'A green door', blurb: 'a green door in a lime-washed wall, with bougainvillea', load: () => import('../../scenes/dar/index.js') },
  { name: 'rampon', label: 'The shore at dusk', blurb: "a fisher's canoe on the shore at dusk, with palms and the sun going down", load: () => import('../../scenes/rampon/index.js') },
]);

/** The scene a card shows while the name is empty: the ferry, which the pitch names first and which moves. */
export const DEFAULT_SCENE = 'ferry';

/**
 * The scene a name picks when nobody has chosen one: from the name's seed, among the scenes that move, so the first
 * card offers a GIF. The same name always picks the same scene; an empty name picks DEFAULT_SCENE.
 * @param {number | null} seed `seedFor(name)` for a name, or null for none
 */
export function sceneForSeed(seed) {
  if (seed === null || seed === undefined) return DEFAULT_SCENE;
  const moving = SCENES.filter(s => !s.still);
  return moving[Math.abs(Math.trunc(seed)) % moving.length].name;
}

/** The scene named `name`, or the first. */
export const sceneNamed = name => SCENES.find(s => s.name === name) ?? SCENES[0];
