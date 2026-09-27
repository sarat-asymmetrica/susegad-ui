# Toast

`<sg-toast-region>` and `<sg-toast>` show short messages that never take focus. Every toast is spoken as it arrives. The visible toasts form a small pile of letters: the newest in front, the older ones peeking above it.

## Use

```html
<link rel="stylesheet" href="susegad/components/toast/toast.css">
<script type="module" src="susegad/components/toast/toast.js"></script>

<sg-toast-region></sg-toast-region>
```

From a script:

```js
import { toast } from './susegad/components/toast/toast.js';

toast('Your changes are saved.', { tone: 'success', title: 'Saved' });
toast('The photo was deleted.', { action: { label: 'Undo', onAction: restore } });

const region = document.querySelector('sg-toast-region');
region.show({ tone: 'error', title: "Couldn't save", message: 'Check your connection and try again.' });
```

From a server: append an `<sg-toast>` to the region (for example `hx-swap="beforeend"` targeting it). The region moves it into the pile and announces it.

```html
<sg-toast tone="error"><strong class="sg-toast-title">Couldn't save</strong> Check your connection and try again.</sg-toast>
```

An `<sg-toast>` outside a region is shown where it stands, as an inline note with a Dismiss button. Without JavaScript it is a plain ruled note in the flow of the page.

## Attributes

| Element | Attribute | Values | Default |
|---|---|---|---|
| `sg-toast` | `tone` | `info`, `success`, `warning`, `error` | `info` |
| `sg-toast` | `duration` | ms, at least 5000; `0` stays until dismissed | the reading time |
| `sg-toast-region` | `duration` | `0` turns every timeout off; a number is the least any toast gets | per toast |
| `sg-toast-region` | `max` | how many are in the pile | `3` |
| `sg-toast-region` | `layout` | `pile`, `list` | `pile` |
| `sg-toast-region` | `position` | `bottom-end`, `bottom-center`, `top-end`, `top-center` | `bottom-end` |
| `sg-toast-region` | `hotkey` | a key such as `Alt+Shift+T` or `F8`; `none` | `Alt+Shift+T` |
| `sg-toast-region` | `label` | the name of the notifications region | `Notifications` |
| both | `register` | `quiet`, `warm`, `playful` | inherited |

## Methods and events

| | |
|---|---|
| `region.show(options \| element)` | `{ message, title, tone, duration, action: { label, onAction, keep } }`, or an `<sg-toast>` you made. Returns the toast. An action dismisses its toast after it runs, unless `keep` is set (or the button has `data-keep`). |
| `region.hold(on = true)` | Stops (or restarts) every clock, for a "hold messages" setting. |
| `toast.dismiss(reason)` | Plays the skin's exit and removes the toast. |
| `toast(message, options)` | Shows a toast in the page's region, making one at the end of `<body>` if there is none. |
| `sg-toast-dismiss` | Bubbles from the toast: `{ reason: 'user' \| 'timeout' \| 'action' \| 'api', id }`. |

A toast plays `confirm` on arrival, or `error` for an error-toned one, through the sound switch (`packages/sound`). Silent unless the switch is on and a gesture has already happened; nothing to wire up.

## Timing (WCAG 2.2.1)

- A toast stays for its reading time: 2 s plus 333 ms a word, at least 5 s and at most 20 s.
- Errors, and toasts with a button or link, stay until they are dismissed.
- The clock stops while the pointer is over the pile, while focus is inside it, and while the tab is hidden.
- In the pile only the front letter spends time. The ones behind keep their full time until they come forward; those waiting beyond `max` spend nothing.
- `duration="0"` on the region turns timeouts off. Offer it as a setting to people who need more time.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a plain ruled note, a coloured edge, the tone glyph | fades in and out in under 200 ms |
| warm | an inland letter: blue card, dashed rule, corner creases, the glyph on a perforated stamp | the flap swings open as the card opens downward |
| playful | the letter, and a postmark on the stamp with the ring words, date and time | the postmark lands with a small press |

Under reduced motion every register shows the finished letter at once.

## Accessibility

- Focus is never moved to a toast. `Alt+Shift+T` (the region's `hotkey`; plain Alt+T would open Firefox's Tools menu on Windows and Linux) moves to the newest when the person asks; Escape dismisses the focused toast, focus moves to the next, and after the last it returns to where it was.
- Two live regions exist before any message: polite for most, `role="alert"` for errors. The tone is spoken ("Error: …") and drawn as a distinct glyph, never colour alone.
- Every Dismiss button is named after its message ("Dismiss: Saved …").
- Focus is never hidden under the pile (WCAG 2.4.11). The region publishes how far the pile reaches up the viewport as `--sg-toast-pile` on `:root`; `toast.css` turns it into `scroll-padding-block-end` on `html`, so browsers scroll focus clear of it, and a spacer at the end of `body` (`body::after`, so your own body padding is left alone) lets the last controls scroll clear. If focus still lands under the pile, it folds to its front letter and the control is brought into view. A top pile sets `scroll-padding-top` instead.
- The pile is a named region ("Notifications"), so screen reader users can jump to it. Letters behind the front one hide their words and cannot take focus until the pile fans out.
- Contrast: message text is 11:1 or more on the letter in every palette and theme. On the letter, actions are set in ink with an accent underline, because the accent is under 4.5:1 on the blue in Susegad dark and Casa light.
- Keep messages short and specific. Errors say what happened and how to fix it.

## Checks

`node --test packages/components/toast/toast.test.js` covers the pure core: reading time, durations, the pile queue, announcements, the hotkey and the postmark. `node packages/components/toast/toast.check.mjs` checks focus, the live regions, pausing, the timeout, the keyboard and reduced motion in Chromium.
