// Chai: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in chai.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'chai',
  title: 'Three small things',
  word: 'Cutting chai',
  gloss: 'Mumbai slang: a half glass of tea, poured into a small ribbed tumbler',
  alt: 'Three small ink drawings on paper: a ribbed glass of milky tea with steam rising, a clay diya with its flame lit, and a tulsi creeper growing along a rule, each labelled by hand.',
  caption:
    'A cutting chai whose steam never settles, a diya that leans away from your cursor and goes out when you tap it, and a tulsi creeper that grows along a rule. They are meant as a loader, a toggle and a divider for real sites: small enough to ship, quiet enough to sit beside text. Set lit to put the lamp out or light it; in playful, tap the flame or hover the creeper.',
  keys: 'Arrow keys move a hand over the sheet. Enter or Space by the lamp puts it out or lights it again; anywhere else the creeper grows again.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'pan-Indian',
  credit: 'Cutting chai, the clay diya and the tulsi are everyday India. The diya here is a household lamp on a table, not a lamp in worship.',
  techniques: ['noise', 'particles', 'interaction', 'easing', 'boil', 'state', 'calm'],
  prompt:
    'Build three small UI pieces on one paper-textured canvas in plain JavaScript, drawn in indigo ink. First, a cutting chai glass: a small ribbed tumbler of milky tea whose steam rises as thin wisps that follow a curl-noise field, each wisp travelling up its streamline and fading, to use as a loading indicator. Second, a clay diya: build the flame from layered teardrop shapes whose height and tip wander with smooth noise, lean it away from the pointer with a spring, and on click snuff it out with a thin curl of smoke, or relight it with a small overshoot. Third, a tulsi creeper for a section divider: reveal the stem along a horizontal rule by length, unfurl leaves with an ease-out-back, and regrow it on hover. Redraw the ink outlines a few times a second with fresh wobble so they feel hand-drawn. Give the lamp a lit attribute, so a page can say whether it is lit, and stop each wisp of steam where the page’s own words begin.',
  map: [
    ['follow a curl-noise field', 'noise', 'Curl noise is the swirl of a smooth noise field. It never bunches up or drains away, so steam and smoke built on it curl and drift like the real thing.'],
    ['each wisp travelling up its streamline and fading', 'particles', 'A wisp is a short window sliding along a path traced through the field. A new one is born every 0.85 seconds and fades 4.6 seconds later, so the loop never needs resetting.'],
    ['lean it away from the pointer with a spring', 'interaction', 'Your cursor sets a target lean and a damped spring pulls the flame toward it, so it sways and settles instead of snapping. In playful a tap on the lamp, or Enter by it, puts it out or lights it again.'],
    ['unfurl leaves with an ease-out-back', 'easing', 'Ease-out-back overshoots a little before settling, which reads as a leaf opening rather than a shape scaling up.'],
    ['Redraw the ink outlines a few times a second with fresh wobble', 'boil', 'The outlines re-roll their wobble six times a second. That is the boiling line of hand-drawn animation. The sheet is redrawn 24 times a second while things move, and not at all in a still.'],
    ['Give the lamp a lit attribute', 'state', 'lit="false" puts the lamp out, with its curl of smoke; lit="true" lights it again with a small overshoot. A tap in playful turns it only until the attribute changes.'],
    ['stop each wisp of steam where the page’s own words begin', 'calm', 'Each wisp is cut at the first point within 24 units of a text box, so steam never drifts through the words.'],
  ],
};
