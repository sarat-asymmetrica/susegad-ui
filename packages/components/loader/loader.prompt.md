# Loader

*A light walks the kolam's line and wakes each dot as it passes; a bambaram hums on its nail.*

An indeterminate loading indicator that says in words what is loading. It is a polite status region, so the words are read out, and a small drawing sits beside them.

```html
<link rel="stylesheet" href="susegad/components/loader/loader.css">
<script type="module" src="susegad/components/loader/loader.js"></script>

<sg-loader label="Loading your bookings"></sg-loader>
```

## The prompt

Build a loading indicator as a light-DOM custom element, `<sg-loader label="…">`, that is a polite status region (`role="status"`) whose text says what is loading, so a screen reader hears the words and the page shows them even without JavaScript. Take the words from the label attribute or the element's own text, and fall back to a short default per register. Never show a percentage or anything that looks like an amount; that is what a progress bar is for. Put a small aria-hidden drawing before the words, in three registers. Quiet: three dots the size of the text that pulse slowly in turn. Warm: a small SVG kolam from the Kolam scene's mirror-curve geometry, its line drawn faintly, with a short bright segment travelling round the loop and each dot brightening just as the segment reaches it; work out, for every dot, where along the loop the line passes closest, and phase that dot's pulse to that moment. Playful: a bambaram, a wooden spinning top with lacquer bands, where the bands slide sideways under the outline to read as spin and the top leans in a slow circle about its nail over a soft shadow. Animate with the Web Animations API so every animation can be paused, pause them while the element is off screen, and with reduced motion show the drawing still.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| whose text says what is loading | accessibility | `role="status"` makes the element a live region. Its only text is the words, so that is what is read, and a changed label is read again. |
| Never show a percentage | no number | A loader has no number. If the work can report how far it has got, use `<sg-progress>` instead. |
| a short bright segment travelling round the loop | stroke dashing | The kolam path has `pathLength="100"` and a dash pattern of 14 on, 86 off. Animating the dash offset from 100 to 0 carries the bright segment once round the loop. |
| phase that dot's pulse to that moment | timing | Each dot's closest point on the loop gives a fraction of the lap. A negative animation delay starts that dot's pulse so it peaks when the segment arrives, and the dots light in the order a hand would reach them. |
| the bands slide sideways under the outline to read as spin | clip path | A strip of coloured bands twice as wide as the top moves sideways inside a clip path shaped like the top. The outline stays still, so the eye reads it as turning. |
| leans in a slow circle about its nail | transform origin | The whole top rocks a few degrees about the tip of its nail, and its shadow shifts with it. |
| with reduced motion show the drawing still | reduced motion | Under `prefers-reduced-motion` no animation starts: the dots rest, the kolam rests with its dots lit, and the top stands upright. |
