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
| quiet | a plain ruled note, a coloured edge, the tone glyph | 120 ms of opacity in and out, nothing else |
| warm | an inland letter: blue card, dashed rule, corner creases, the glyph on a perforated stamp | rises a little as it arrives (180 ms); the flap swings open as the card opens downward |
| playful | the letter, and a postmark on the stamp with the ring words, date and time | rises further on the spring (260 ms); the postmark lands with a small press |

Arriving is a CSS transition from `@starting-style`, and leaving is the same, played back, so the toast's `data-phase="leave"` is all the script has to say. Under reduced motion every register shows the finished letter at once. The action and the close button are pressed like every Susegad control: the state answers in the same frame, with no transition, and eases back in under 150 ms. Quiet settles 1 px, warm shades the colour toward the ink, playful gives a little (scale 0.97, released on the spring). The keyboard never moves it, and under reduced motion the shade stays and the movement goes.

## Accessibility

- Focus is never moved to a toast. `Alt+Shift+T` (the region's `hotkey`; plain Alt+T would open Firefox's Tools menu on Windows and Linux) moves to the newest when the person asks; Escape dismisses the focused toast, focus moves to the next, and after the last it returns to where it was.
- Two live regions exist before any message: polite for most, `role="alert"` for errors. The tone is spoken ("Error: …") and drawn as a distinct glyph, never colour alone.
- Every Dismiss button is named after its message ("Dismiss: Saved …").
- Focus is never hidden under the pile (WCAG 2.4.11). The region publishes how far the pile reaches up the viewport as `--sg-toast-pile` on `:root`; `toast.css` turns it into `scroll-padding-block-end` on `html`, so browsers scroll focus clear of it, and a spacer at the end of `body` (`body::after`, so your own body padding is left alone) lets the last controls scroll clear. If focus still lands under the pile, it folds to its front letter and the control is brought into view. A top pile sets `scroll-padding-top` instead.
- The pile is a named region ("Notifications"), so screen reader users can jump to it. Letters behind the front one hide their words and cannot take focus until the pile fans out.
- Contrast: message text is 11:1 or more on the letter in every palette and theme. On the letter, actions are set in ink with an accent underline, because the accent is under 4.5:1 on the blue in Susegad dark and Casa light.
- Keep messages short and specific. Errors say what happened and how to fix it.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The tone glyph and the Dismiss cross are SVG set `aria-hidden="true"`, and the tone is spoken in words ("Error: ..."): `packages/components/toast/toast.js`; manual test, 2026-10-07 (throwaway Playwright script, three toasts open, each register): every icon svg in the region has `aria-hidden="true"`. `packages/components/toast/toast.check.mjs`: "the error is spoken as an alert, with its tone in words and without its button label". |
| 1.3.1 Info and relationships | Meets | The pile is a named region ("Notifications") holding the toasts, with a polite live region and an `role="alert"` one that exist before any message: `toast.check.mjs`, "the stack is a named region; each dismiss button names its toast". |
| 1.4.1 Use of color | Meets | The tone is spoken ("Error: ...", `packages/components/toast/toast.test.js`, "the tone is spoken, not only shown") and drawn as a distinct glyph for each of success, warning and error (`toast.js`), never colour alone. |
| 1.4.3 Contrast (minimum) | Meets | Manual test, 2026-10-07 (throwaway Playwright script, demo with three toasts open, painted colours read in the browser): message text on the letter is 13.57:1 and 12.71:1 in quiet (light, dark) and 11.28:1 and 11.59:1 in warm and playful; the Undo action 4.60:1 at the lowest (quiet dark) and 11.28:1 in warm and playful; the Dismiss cross 5.92:1 or more. The text roles are also tested in `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe, with the toasts open: 0 violations in every register, light and dark (same script; color-contrast was left to the ratios above). |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent at 1280 px, three toasts shown and the pile spread by pointing at it, three registers: every toast holds its message, nothing is clipped or off screen (throwaway Playwright script). Sizes are in `rem`, `em` and tokens: `packages/components/toast/toast.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three toasts shown and the pile spread, three registers: page width 320, every toast inside the screen with its message in full (throwaway Playwright script). `toast.css` sizes the stack to `min(26rem, calc(100vw - 2 * var(--sg-space-3)))`. `packages/components/toast/toast.check.mjs` also loads the demo at 390 px in each register. |
| 1.4.11 Non-text contrast | Meets | The tone glyph is `--sg-success`, `--sg-warning` or `--sg-danger` and the Dismiss cross `--sg-text-soft`, text roles at 4.5:1 or more on every surface, and the focus ring `--sg-focus`: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more" and "focus ring and control borders are 3:1 or more on every surface"). The Dismiss cross measured 5.92:1 or more on the letter (the manual test in the 1.4.3 row). |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo at 320 px with three toasts shown and the pile spread, three registers: each toast grows to hold its message, nothing is clipped, page width 320 (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.13 Content on hover or focus | Not applicable | A toast does not appear on hover or focus: it arrives when the page says so. Pointing at the pile, or moving focus into it, lays out toasts that are already on screen and stops their clocks (`packages/components/toast/toast.check.mjs`, "pointing at the pile lays it out"); Escape dismisses the focused toast ("Escape dismisses it and focus moves to the next letter in the pile"). Whether the spread pile is hover content is a judgement for the audit. |
| 2.1.1 Keyboard | Meets | Added because Dismiss and the action are buttons, though the kind has no `interactive` trait. `toast.check.mjs`: Alt+Shift+T moves focus to the newest toast, Escape dismisses it, and focus goes to the next letter, then back to where it was. Dismiss and the action are native buttons. |
| 2.1.2 No keyboard trap | Meets | Focus is never moved to a toast by itself (`toast.check.mjs`, "focus stays in the search field while toasts arrive"); when the person moves there, Tab leaves, and Escape on the last toast returns focus to the field ("Escape on the last one: focus goes back to the field"). |
| 2.2.1 Timing adjustable | Meets with author's part | Added because a toast leaves by itself. A toast stays for its reading time, 2 s plus 333 ms a word, at least 5 s and at most 20 s; errors and any toast with a button wait for the person; the page can turn timeouts off with `duration="0"` on the region: `packages/components/toast/toast.test.js`, "reading time grows with the words and stays between 5 s and 20 s", "errors and toasts with an action wait for the person" and "the page can turn timeouts off". The clock stops while the pile is pointed at, focused or the tab is hidden (`toast.check.mjs`, "while pointed at, a toast does not time out"). A message that would take longer than 20 seconds to read should be an error or have an action, or set `duration="0"`. |
| 2.2.2 Pause, stop, hide | Meets | The clock of every toast stops while the pile is pointed at, focused, or the tab is hidden, and resumes after: `toast.check.mjs`, "while pointed at, a toast does not time out" and "after the pointer leaves, the clock resumes and it goes". Under reduced motion each letter is open at once with nothing moving ("reduced motion: the letter is open at once, with nothing moving"). |
| 2.3.1 Three flashes or below threshold | Meets | A toast arrives and leaves with a transition of opacity and a short rise (6 px warm, 10 px playful) and nothing else; it does not flash: `packages/components/toast/toast.css` (`@starting-style`, `data-phase="leave"`). |
| 2.4.3 Focus order | Meets | The pile is a fixed region that takes no focus by itself and is reached on request; focus is never moved to it, and Escape gives focus back to where it was: `toast.check.mjs`, "Alt+Shift+T moves focus to the newest toast" and "Escape on the last one: focus goes back to the field". Letters behind the front one cannot take focus until the pile fans out. |
| 2.4.7 Focus visible | Meets | Added for the same reason as 2.1.1. `packages/components/toast/toast.css`: `sg-toast :focus-visible` draws the token focus outline on Dismiss and the action; `tools/touch.check.mjs` requires a focus style. |
| 2.4.11 Focus not obscured (minimum) | Meets | The region publishes how far the pile reaches up the viewport as `--sg-toast-pile`, and `toast.css` turns it into `scroll-padding-block-end` and a spacer so focus scrolls clear; if focus still lands under it, the pile folds to its front letter. `toast.check.mjs`, "<register>, 390 px: tabbing <n> controls with an error up, none is covered by the pile" and "<register>: the region tells the page how much room the pile takes". |
| 2.5.3 Label in name | Meets | Added for the same reason as 2.1.1. The action button's name is its visible text. The Dismiss button shows a cross, not text, and is named after its message ("Dismiss: Saved. Your ..."), so it has no visible label to match: `toast.check.mjs`, "a dismiss button names the message, not the action or the tone". |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07 (throwaway Playwright script, toast with an Undo action, 1280 and 390 px, three registers; added for the same reason as 2.1.1): the Dismiss button is 30 to 32 px square, and the action button is 32 by 21 px in quiet and 32 by 22 px in warm and playful, set inside the message text with no other target within 12 px of its centre (the nearest, Dismiss, is 50 px or more away), so it passes on the spacing exception for targets under 24 px. No check in the repository asserts target size for the toast yet. |
| 4.1.2 Name, role, value | Meets | A named region ("Notifications"), each Dismiss button named after its message, and a live region per kind: `toast.check.mjs`, "the stack is a named region; each dismiss button names its toast". axe with the toasts open: 0 violations in every register, light and dark (the manual test in the 1.4.3 row); axe on the demo page: `tools/axe.mjs --url /packages/components/toast/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07; color-contrast was left for review by hand and is covered by the ratios in this table. |
| 4.1.3 Status messages | Meets | Two live regions exist before any message: polite for most, `role="alert"` for errors; the tone is spoken and focus never moves. `toast.check.mjs`: "the success is spoken politely, with a pause after its title" and "the error is spoken as an alert, with its tone in words and without its button label". |

**The page author owns:**

- The words of every message, in the language of the page, short and specific, with what happened and how to fix it for an error; `lang` on a message in another language (3.1.2). The built-in words ("Notifications", "Dismiss", the tone words such as "Error") are fixed English in `toast.core.js`.
- Making anything a person must act on an error or a toast with an action, or setting `duration="0"`, so it does not leave after its reading time (2.2.1).
- Sticky headers and banners that sit at the top of the page when a top pile is used (2.4.11).
- The hotkey: `Alt+Shift+T` by default, and a different `hotkey` where it clashes with the page or a screen reader.

## Checks

`node --test packages/components/toast/toast.test.js` covers the pure core: reading time, durations, the pile queue, announcements, the hotkey and the postmark. `node packages/components/toast/toast.check.mjs` checks focus, the live regions, pausing, the timeout, the keyboard and reduced motion in Chromium.
