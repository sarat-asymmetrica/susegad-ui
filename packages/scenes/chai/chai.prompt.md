# Cutting chai

*Mumbai slang: a half glass of tea, poured into a small ribbed tumbler.*

A cutting chai whose steam never settles, a diya that leans away from your cursor and goes out when you tap it, and a tulsi creeper that grows along a rule. They are meant as a loader, a toggle and a divider for real sites: small enough to ship, quiet enough to sit beside text. Set lit to put the lamp out or light it; in playful, tap the flame or hover the creeper.

```html
<script type="module" src="susegad/scenes/chai/index.js"></script>

<!-- a café's evening note: the lamp is out when the kitchen is closed -->
<sg-scene name="chai" register="warm" lit="false" label="Three small drawings: tea, a lamp that is out, a creeper"></sg-scene>

<!-- playful: tap the flame, hover the creeper, or use the arrow keys and Enter -->
<sg-scene name="chai" register="playful"></sg-scene>
```

| Param | Values | Default | What it does |
|---|---|---|---|
| `lit` | boolean | true | Whether the diya is lit. `false` puts it out with a curl of smoke; `true` lights it again with a small overshoot. |

## The prompt

Build three small UI pieces on one paper-textured canvas in plain JavaScript, drawn in indigo ink. First, a cutting chai glass: a small ribbed tumbler of milky tea whose steam rises as thin wisps that follow a curl-noise field, each wisp travelling up its streamline and fading, to use as a loading indicator. Second, a clay diya: build the flame from layered teardrop shapes whose height and tip wander with smooth noise, lean it away from the pointer with a spring, and on click snuff it out with a thin curl of smoke, or relight it with a small overshoot. Third, a tulsi creeper for a section divider: reveal the stem along a horizontal rule by length, unfurl leaves with an ease-out-back, and regrow it on hover. Redraw the ink outlines a few times a second with fresh wobble so they feel hand-drawn. Give the lamp a lit attribute, so a page can say whether it is lit, and stop each wisp of steam where the page’s own words begin.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| follow a curl-noise field | noise | Curl noise is the swirl of a smooth noise field. It never bunches up or drains away, so steam and smoke built on it curl and drift like the real thing. |
| each wisp travelling up its streamline and fading | particles | A wisp is a short window sliding along a path traced through the field. A new one is born every 0.85 seconds and fades 4.6 seconds later, so the loop never needs resetting. |
| lean it away from the pointer with a spring | interaction | Your cursor sets a target lean and a damped spring pulls the flame toward it, so it sways and settles instead of snapping. In playful a tap on the lamp, or Enter by it, puts it out or lights it again. |
| unfurl leaves with an ease-out-back | easing | Ease-out-back overshoots a little before settling, which reads as a leaf opening rather than a shape scaling up. |
| Redraw the ink outlines a few times a second with fresh wobble | boil | The outlines re-roll their wobble six times a second. That is the boiling line of hand-drawn animation. The sheet is redrawn 24 times a second while things move, and not at all in a still. |
| Give the lamp a lit attribute | state | lit="false" puts the lamp out, with its curl of smoke; lit="true" lights it again with a small overshoot. A tap in playful turns it only until the attribute changes. |
| stop each wisp of steam where the page’s own words begin | calm | Each wisp is cut at the first point within 24 units of a text box, so steam never drifts through the words. |

## Accessibility

The drawing's name is its `alt`; give it a `label` when the lamp means something on your page. The lamp is not a control: a real toggle belongs in the page (a `<button aria-pressed>` or a switch) and can set `lit`. In playful the drawing takes focus: the arrow keys move a hand and Enter or Space by the lamp puts it out or lights it; anywhere else the creeper grows again. Steam never drifts through words laid over the sheet.

## Credit

Cutting chai, the clay diya and the tulsi are everyday India. The diya here is a household lamp on a table, not a lamp in worship; tulsi is sacred to many households, so it is drawn as a plant along a rule and never as a gimmick. Both are on the owner's confirm list.
