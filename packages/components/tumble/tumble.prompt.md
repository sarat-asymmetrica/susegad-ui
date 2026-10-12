# Tumble

*A playful headline for a launch, an event page, a kids' site, a food maker's opening line.*

```html
<link rel="stylesheet" href="susegad/components/tumble/tumble.css">
<script type="module" src="susegad/components/tumble/tumble.js"></script>

<sg-tumble><h2>Life is short, eat good pasta</h2></sg-tumble>
```

## The prompt

Make a headline that arrives, as a web component that wraps a real heading and never changes it. The text stays one string in the DOM: read once by a screen reader, selectable, translatable. The moving letters are an aria-hidden copy laid over the heading, built when the arrival starts: measure each letter with a Range after document.fonts.ready, place a span for each exactly where the browser put it with the heading's own font, colour, spacing and case, group them into the lines the browser laid out, hide the real text for as long as the copy moves, then remove the copy and show the real text again. Three registers. Quiet: nothing moves. Warm: the lines slide in alternately from the left and the right, a little past rest, and settle, each line after the one above, clipped to the heading's box so nothing widens the page. Playful: each letter drops from above with a little spin, touches down, bounces once and settles, staggered so the whole arrival never takes more than about two and a half seconds. Under reduced motion, the finished heading at once and no copy. It plays once, the first time it is seen (an IntersectionObserver of its own), or when the page calls play(), which returns a promise that resolves when the heading has settled; a manual attribute turns auto-play off. The heading must never be left invisible: not with JavaScript off, not before the script runs, not if measuring throws, not on a resize, not if the element leaves the page; leave a heading with a transparent fill alone. An optional hold attribute hides the heading until play(), and lets it go after eight seconds. It must work under style-src 'self' and script-src 'self': set positions through element.style, animate with Web Animations.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| the text stays one string | overlay | The copy is a sibling layer, aria-hidden, pointer-events none; the heading keeps its one text node. |
| exactly where the browser put them | `Range.getClientRects` per letter, `letters()` | Graphemes (so an accent or an emoji is one letter) each measured against the host, after the fonts are ready. |
| the lines the browser laid out | `groupLines` | Letters whose vertical middles are within half a letter's height share a line. |
| alternate sides, settle | `warmPlan`, `warmFrames` | Odd lines from the right, even from the left, a small overshoot, each line 170 ms after the one above. |
| drop with a little spin, bounce once | `playfulPlan`, `dropFrames` | Seeded spin and height per letter; keyframes: above and turned, touch down, one small lift, rest. |
| never longer than | `MAX_TOTAL_MS` | The stagger shrinks with the letter count. |
| never invisible | `restore()` | Called in a finally, on resize, on disconnect and after a failsafe timer; hide happens only after the copy exists. |
| wait for web fonts | `document.fonts.ready` | At most three seconds, then it measures what there is. |
| strict CSP | CSSOM and WAAPI | No style element and no style attribute in what it builds. |

## Accessibility

- The heading is announced by its own text, once; the copy is `aria-hidden`.
- Quiet and reduced motion: the finished heading, no copy.
- Selecting the heading while it plays selects the real text.
