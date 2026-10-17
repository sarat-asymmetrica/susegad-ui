# Sound switch

`<sg-sound-switch>` is the one control that turns Susegad's sound switch on or off, site-wide. It wraps a native `<input type="checkbox" role="switch">`; the checkbox is the whole control.

## Use

```html
<link rel="stylesheet" href="susegad/components/sound-switch/sound-switch.css">
<script type="module" src="susegad/components/sound-switch/sound-switch.js"></script>

<sg-sound-switch>
  <label><input type="checkbox" role="switch"> Sound</label>
  <small class="sg-sound-switch-note">Turning sound on needs JavaScript.</small>
</sg-sound-switch>
```

Put one anywhere a page offers the setting: a header, a settings panel, the first scene that would use sound. More than one on a page stay in sync with each other, because they all read and write the same switch (`packages/sound/switch.js`).

## What it does

- On connect, the checkbox is set to `soundOn()`. Checking or unchecking it calls `setSoundOn()` from inside the browser's own `change` event, so that click or key press is the user gesture `switch.js` needs to resume the shared `AudioContext`: turning sound on and hearing the first sound can be the same tap. Turning it on also plays `confirm`, the switch's own first sound.
- Every `<sg-sound-switch>` on the page listens for `sg-sound-change` and follows: check one, and the rest (and anything else reading `soundOn()`) update without a page reload.
- **Without JavaScript** the checkbox is still there, still announced as a switch, and still takes Space, but nothing it does has an effect, because there is no sound without JavaScript. A `<small class="sg-sound-switch-note">` beside it says so in words; this element hides that note once it is running.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `register` | `quiet`, `warm`, `playful` | inherited |
| `seed` | any string (playful only: which arc breath this switch plays) | the element's `id`, or a fixed default |

## Registers

| | Look | Motion |
|---|---|---|
| quiet | the native switch, hairline, no drawing | none |
| warm | a small speaker beside the track; a struck-through line when off, two arcs when on | the switch fades between the two on a CSS transition, under 200ms |
| playful | the same speaker; the two arcs also breathe gently while it is on | a slow Web Animation, seeded so two switches never pulse in step; paused off screen and under reduced motion |

## Accessibility

- The checkbox carries `role="switch"`; a screen reader says "switch, Sound, on" or "off", from the `<label>` text you write.
- The speaker drawing is `aria-hidden`; the state is never carried by the drawing alone, only by the checkbox itself.
- Forced-colours mode returns the system's own checkbox in the system's own colours; the drawing is hidden.
- The "needs JavaScript" note means the no-JS page never implies sound is available when it is not.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The speaker drawing is `aria-hidden` and the `<label>` is the name: `packages/components/sound-switch/sound-switch.check.mjs`, "<register> still announced as a switch" reads `switch "Sound"` after each change. |
| 1.3.1 Info and relationships | Meets | A native `<input type="checkbox" role="switch">` inside its `<label>`. `sound-switch.check.mjs`, "no JS: it is announced as a switch, by its label" and, with JavaScript, "still announced as a switch" in each register. |
| 1.3.5 Identify input purpose | Not applicable | A sound switch holds no personal data. |
| 1.4.1 Use of color | Meets | State is never colour alone: the thumb sits on one side or the other, and the warm and playful speaker shows its arcs when on and a slash when off ("The state lives in a shape, never only a colour", `packages/components/sound-switch/sound-switch.css`). `sound-switch.check.mjs`: "<register> clicking turns it on, and the drawing follows" and "clicking again turns it off, and the drawing follows". |
| 1.4.3 Contrast (minimum) | Meets | The label is page text in `--sg-text`, and the "needs JavaScript" note `--sg-text-faint`, a text role: `packages/tokens/tokens.test.js` ("AA: <palette> <theme>: every text role on every surface is 4.5:1 or more"). axe: `tools/axe.mjs --url /packages/components/sound-switch/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent in a 320 px wide window (stricter than 200 percent alone), three registers, page width 320, nothing clipped (throwaway Playwright script). The switch is sized in `em`: `packages/components/sound-switch/sound-switch.css`. |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, page width 320, no sideways scroll (throwaway Playwright script). The label column is `minmax(0, 1fr)` in `sound-switch.css`, so a long label wraps. No check in the repository asserts it yet. |
| 1.4.11 Non-text contrast | Meets | Manual test, 2026-10-07: computed with `resolveRoles` from `packages/tokens/tokens.js` for every palette in light and dark (throwaway script). The accent track on the surface, sunk and raised grounds is 3.92:1 at the lowest (Susegad light, on the sunk ground); the off thumb, `--sg-text-soft` on the sunk ground, 4.93:1; the `--sg-rule-strong` track edge 3.11:1; `--sg-on-accent` thumb on the accent 4.69:1. The focus ring and control borders are also tested 3:1 or more in `packages/tokens/tokens.test.js`. The warm and playful drawing uses `--sg-text`, `--sg-text-soft` and text roles. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, page width 320 with no sideways scroll (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | Manual test, 2026-10-07 (throwaway Playwright script on the demo): in each register one Tab reaches the switch, Space turns it on, and Space again turns it off. The control is a native checkbox and `packages/components/sound-switch/sound-switch.js` adds only a `change` listener. `packages/components/sound-switch/sound-switch.check.mjs` turns it on and off by click in each register. |
| 2.1.2 No keyboard trap | Meets | Manual test: `packages/components/sound-switch/sound-switch.js` binds only a `change` listener and sets no `tabindex`; the native checkbox takes Tab and Shift+Tab as any checkbox does. |
| 2.4.3 Focus order | Meets | The native input is the only tab stop and keeps its place in the page's order; the drawing is `aria-hidden` with `pointer-events: none` and takes no focus (`packages/components/sound-switch/sound-switch.css`). |
| 2.4.7 Focus visible | Meets | `sound-switch.css` sets a `:focus-visible` outline in the token focus colour on the input; `tools/touch.check.mjs` Tabs onto the first focusable control in the component, in the quiet register, and requires an outline, ring or style change. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test: `packages/components/sound-switch/sound-switch.css` uses no `position: fixed` or `sticky` and no overlay. A sticky header or banner the page adds can cover the switch when it takes focus. |
| 2.5.3 Label in name | Meets | The accessible name is the visible label text: `sound-switch.check.mjs` reads `switch "Sound"` in each register, with JavaScript off and on. |
| 2.5.8 Target size (minimum) | Meets with author's part | Manual test, 2026-10-07: the click target is the whole `<label>`, 28.8 px tall in quiet and warm (31.5 px for the Devanagari and Kannada labels) and 102 px or more wide. The drawn switch alone is 41 by 23 px in quiet and 47 by 25 px in warm and playful (throwaway Playwright script, 1280 px). The input must stay inside the `<label>`. No check in the repository asserts target size for the switch yet. |
| 3.2.2 On input | Meets | `packages/components/sound-switch/sound-switch.js` stores the setting, plays its own confirming cue and updates other switches on the page; it moves no focus and navigates nowhere. `sound-switch.check.mjs`: "a second switch on the page follows the same setting". |
| 3.3.1 Error identification | Not applicable | A switch has no invalid state: it is on or off. |
| 3.3.2 Labels or instructions | Meets with author's part | The native `<label>` is the name and the "needs JavaScript" note tells a reader without scripts that nothing here will sound (`sound-switch.check.mjs`, "no JS: the "needs JavaScript" note shows"). The label wording and the note are the author's. |
| 4.1.2 Name, role, value | Meets | `sound-switch.check.mjs`: announced as `switch "Sound"` in each register, with JavaScript off and on; the checked state is the native one and is remembered ("the setting is remembered"). In forced colours the native control returns ("forced colours: the system's own control, drawing hidden"). axe: `tools/axe.mjs --url /packages/components/sound-switch/demo.html`: 0 violations across 6 runs (three registers, light and dark, desktop), 2026-10-07. |

**The page author owns:**

- The label text, in the language of the page, inside the `<label>` that wraps the input; `lang` on a label in another language (3.1.2).
- The note's wording, if the page changes it.
- Sticky headers and banners that could cover the switch when it takes focus (2.4.11).
- Where sound is offered at all: the switch only turns the library's cues on, and content sound (a recording, a voice) needs its own press.

## Budget

| File | Bytes |
|---|---|
| `sound-switch.js` + `sound-switch.core.js` (behaviour) | within 12 KB |
| `skins/quiet.js` | well under 8 KB |
| `skins/warm.js` | well under 8 KB |
| `skins/playful.js` | well under 8 KB |

Nothing runs per frame except a playful switch's single Web Animation, while it is on and on screen.
