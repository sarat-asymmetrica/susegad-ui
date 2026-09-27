# Progress

*A kolam closes when the work is done; a glass of cutting chai is full when it is ready.*

A determinate progress indicator that enhances the native `<progress>` element. The number is always in words beside the label. In warm, a small kolam is drawn exactly as far as the value and closes at 100%. In playful, a cutting-chai glass fills with tea.

```html
<link rel="stylesheet" href="susegad/components/progress/progress.css">
<script type="module" src="susegad/components/progress/progress.js"></script>

<sg-progress label="Uploading photos">
  <progress value="0.4" max="1">40%</progress>
</sg-progress>

<script>
  upload.addEventListener('progress', e => { bar.value = e.loaded / e.total; });
</script>
```

## The prompt

Build a progress indicator as a light-DOM custom element, `<sg-progress label="…">`, that enhances a native `<progress>` child, so the value and the progressbar role stay native and it still works without JavaScript. Put the label and the value in words above or beside the bar, and name the native element by the visible label with `aria-labelledby`. Give it three registers. Quiet: the native bar itself, styled as a three-pixel pencil hairline in the ink colour over a rule-coloured track, and nothing else. Warm: beside the words, a small SVG kolam, one unbroken line looping around thirteen dots, taken from the Kolam scene's mirror-curve geometry; draw the line exactly as far as the value with a dash offset over a faint dotted pencil guide of what is left, roughen it with a light turbulence filter so it looks hand inked, and turn the dots laterite when it closes at 100%. Playful: a fluted cutting-chai glass in SVG whose tea level is the value, clipped inside the glass, with its milky surface on top and three wisps of steam rising while motion is allowed. Move only with the work: animate only when the value changes, a short ease to the new value and no further, never on a timer. Without a value the element is indeterminate: say what is happening in words, draw no line and fill no tea; let the kolam's dots breathe slowly, or pour a thin stream into the empty glass. With reduced motion, draw the current value with no animation. Pause every animation while the element is off screen.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| enhances a native `<progress>` child | progressive enhancement | The browser's own element carries the value and the role. Without JavaScript, and in quiet, it is simply styled; the skins hide it visually but leave it for screen readers. |
| name the native element by the visible label | accessibility | The element writes the label into a visible span and points `aria-labelledby` at it, so the words people see are the words a screen reader says. The number beside it is `aria-hidden` because the native element already announces its value. |
| draw the line exactly as far as the value with a dash offset | stroke dashing | The kolam path has `pathLength="100"`, so a dash offset of 60 leaves 40% drawn, whatever the path's real length. |
| taken from the Kolam scene's mirror-curve geometry | reuse | The warm skin calls the scene's pure `geometry()` for a thirteen-dot diamond instead of carrying its own drawing. |
| roughen it with a light turbulence filter | SVG filter | `feTurbulence` and `feDisplacementMap` nudge the line by about a pixel, painted once, so it reads as ink without redrawing. |
| tea level is the value, clipped inside the glass | clip path | One tall block of tea slides up and down behind a clip path shaped like the inside of the glass. An empty glass holds no tea at all. |
| animate only when the value changes | motion that follows the work | Each update eases from the value last shown to the new one with the Web Animations API, then stops. Nothing moves between updates. |
| say what is happening in words | indeterminate state | Without a value attribute the words say "Working on it" (or the quiet and playful wording), and no drawing suggests an amount. |
| Pause every animation while the element is off screen | budget | One shared IntersectionObserver tells each skin when it is visible; the steam and breathing animations are paused, not left running. |
