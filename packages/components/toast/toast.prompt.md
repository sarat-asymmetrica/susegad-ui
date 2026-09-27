# Toast

*A short message that arrives without taking focus: Saved, Couldn't save, The photo was deleted (Undo).*

Screen readers hear every toast as it arrives. Sighted readers see a small pile of letters in the corner. Nobody loses a message to a timer they could not stop.

```html
<link rel="stylesheet" href="susegad/components/toast/toast.css">
<script type="module" src="susegad/components/toast/toast.js"></script>

<sg-toast-region></sg-toast-region>

<script type="module">
  import { toast } from './susegad/components/toast/toast.js';
  toast('Your changes are saved.', { tone: 'success', title: 'Saved' });
</script>

<!-- or from a server, e.g. an htmx swap into the region -->
<sg-toast tone="error"><strong class="sg-toast-title">Couldn't save</strong> Check your connection and try again.</sg-toast>
```

| Attribute | On | Values | What it does |
|---|---|---|---|
| `tone` | `sg-toast` | `info`, `success`, `warning`, `error` | The glyph on the stamp, the edge colour and the live region. Errors are spoken as alerts and never time out. |
| `duration` | `sg-toast` | ms | Asks for a time. Never less than 5 s; ignored for errors and toasts with an action. |
| `duration` | `sg-toast-region` | ms, or `0` | `0` turns every timeout off (a setting to offer people who need it); a number is the least time any toast gets. |
| `max` | `sg-toast-region` | 1 or more, default 3 | How many letters are in the pile; the rest wait, untimed. |
| `layout` | `sg-toast-region` | `pile`, `list` | `pile` shows the newest in front; `list` lays them all out. |
| `position` | `sg-toast-region` | `bottom-end`, `bottom-center`, `top-end`, `top-center` | Where the pile sits. |
| `hotkey` | `sg-toast-region` | e.g. `Alt+Shift+T` (the default), `F8`, or `none` | Moves focus to the newest toast, only when pressed. |

## The prompt

Make a toast notification web component in two parts: a region placed once on the page, `<sg-toast-region>`, and the toasts, `<sg-toast tone="success">`, which a script or a server can add. Never move focus to a toast. Put two visually hidden live regions in the region before any message arrives, one `role="status"` with `aria-live="polite"` and one `role="alert"` for errors, and append each toast's words to the right one as it arrives, with "Error:" or "Warning:" in front so the tone is heard, not only seen. Give every toast a tone glyph (a circled i, a tick, a triangle, an octagon with a cross) so colour never carries the meaning alone, and a Dismiss button named after the message. Follow WCAG 2.2.1: keep each toast for the time it takes to read it slowly (two seconds to notice plus a third of a second a word, never less than five seconds), never time out an error or a toast with an action, let the page turn timeouts off, and stop the clock while the pointer is over the toasts, while focus is inside them and while the tab is hidden. Stack them as a pile of letters, the newest in front and the older ones peeking above; spend time only on the one in front, and fan them out into a list when pointed at or focused. Show at most three and keep the rest waiting. Let Alt+Shift+T (not Alt+T, which opens Firefox's Tools menu) move focus to the newest toast on request, Escape dismiss the focused one and move to the next, and focus return to where the person was after the last. Use the popover API so the pile sits above everything, and never let it hide the focused control: publish the pile's height so the page scrolls focus clear of it, leave room at the end of the page, and fold the pile to its front letter if focus lands under it anyway. Give it three registers. Quiet: a plain ruled note with a coloured edge that fades in and out in under 200 ms. Warm: an India Post inland letter, blue, with a dashed inner rule, creases at the top corners and the tone glyph printed on a perforated stamp; the flap swings open on its top edge as the card opens downward. Playful: the same letter, and a postmark lands on the stamp with a small press: two rings, words round the ring, the date and time in the middle, wavy cancellation lines and a rough ink edge. Under reduced motion, show the letter open and the postmark in place, with nothing moving.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| never move focus to a toast | native first | Nothing calls `focus()` on a toast unless the person pressed the hotkey. A browser check types into a field while two toasts arrive and confirms focus stays there. |
| two visually hidden live regions … before any message arrives | live regions | The region builds `role="status"` and `role="alert"` containers when it connects, so screen readers are already listening. Each message is appended as a new line 60 ms later (a timer, because frames stop in a hidden tab) and removed after 15 s. |
| "Error:" or "Warning:" in front | redundancy | `announcement()` prefixes the tone in words, and a visually hidden span does the same inside the toast for anyone who reads it later. |
| the time it takes to read it slowly | reading time | `readingTime()` is 2 s plus 333 ms a word (180 words a minute), rounded up to 100 ms and held between 5 s and 20 s. Unit-tested. |
| never time out an error or a toast with an action | WCAG 2.2.1 | `durationFor()` returns 0 (until dismissed) for errors and for any toast that holds a button or link, and for every toast when the region's `duration` is `0`. |
| stop the clock while … | pause | The region keeps a set of reasons (pointer, focus, hidden tab, `hold()`). Before any change it settles the clock, so paused time and time before a toast arrived are never charged to it. A browser check hovers for 7 s and the toast is still there. |
| focus is never hidden under the pile | WCAG 2.4.11 | A ResizeObserver on the pile (and `transitionend`, since the peeking letters move by transform) measures how far the letters reach up the viewport and sets `--sg-toast-pile` on `:root`. `toast.css` makes that `scroll-padding-block-end` on `html` and a spacer after `body`. On a `focusin` under the pile, it folds to its front letter and scrolls the control into view. A browser check tabs every control at 390 px with an error showing and requires 0% covered. |
| a pile of letters … spend time only on the one in front | queue | `createQueue({ front: true })` shows the first `max` toasts and ticks only the newest of them. The ones behind keep their full time until they come forward, and the ones waiting spend nothing. Unit-tested. |
| fan them out into a list when pointed at or focused | CSS grid | Piled, every letter sits in one grid cell, pushed up by `--depth` × 0.55 rem and scaled down slightly. The letters behind are cut to the front letter's height (a ResizeObserver) and their words are hidden, so nothing unreadable can take focus. |
| Alt+Shift+T … Escape … focus return | keyboard | `parseHotkey()` matches on the physical key (`KeyT`), so Option+Shift+T on a Mac works. The default adds Shift because Alt+T alone opens Firefox's Tools menu. Escape dismisses the focused toast and focus moves to the next, then back to the element that had it before. |
| the popover API so the pile sits above everything | native first | The stack is `popover="manual"`, shown while it holds a toast, so it is in the top layer without z-index battles. Without popover support it is `position: fixed`. |
| an India Post inland letter | texture | `light-dark(var(--sg-inland), …)` for the blue, an outline with a negative offset for the dashed rule, and two diagonal gradients for the corner creases. On the blue the action is set in ink with an accent underline, because the accent drops below 4.5:1 there in some palettes. |
| a perforated stamp | CSS mask | Two mask layers: a grid of small transparent circles, and a solid rectangle 6 px smaller. Together they cut the holes only along the edge. |
| the flap swings open … as the card opens downward | WAAPI | The flap is a triangle (`clip-path`) turned from 0 to 180 degrees about its top edge with perspective, while the card's `clip-path: inset()` opens from 58% to 0. The animations are cancelled when done, so `getAnimations()` stays empty. |
| a postmark lands … with a small press | easing | Keyframes from scale 1.7 and no ink to 0.9, then settling at 1 with a slight turn, on an overshooting curve, after the letter has opened. The ring words follow a circle with `textPath`, and `feTurbulence` into `feDisplacementMap` roughens the ink. |
| under reduced motion … nothing moving | still | Every skin checks `ctx.motion === 'still'` and shows the finished letter; a browser check confirms no animations run. |
