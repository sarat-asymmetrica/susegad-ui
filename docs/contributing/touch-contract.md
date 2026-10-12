# The touch contract

How a Susegad piece answers a finger, a mouse and a key. It exists because a phone in Goa is the first screen most guests and customers meet, and a control that does not answer when pressed feels broken whatever it looks like. The rules are small, and one check keeps them: `node tools/touch.check.mjs`, which runs inside `npm run check`.

Applies to every interactive component. A component with several controls (tabs, a stepper) applies it to each.

## 1. A press answers within one frame, in every register

CSS `:active`, nothing else, and **no transition on press-in** (`transition: none` on the `:active` rule). Release may ease back, in 150 ms or less.

| Register | What a press does |
|---|---|
| quiet | A 1 px settle (`translate: 0 1px`) and a faint wash or a border a few percent toward `--sg-text`. |
| warm | The pencil shades darker: the border, rule, stroke or fill mixed toward `--sg-text`, for example `color-mix(in oklab, <the colour>, var(--sg-text) 25%)`. Hairline strokes may go to 40 percent or all the way to `--sg-text`, since 25 percent of a thin line cannot be seen (on a dark page a warm check moved only 25 of 255 until its stroke went to full text colour). No movement. |
| playful | A small give: `scale: 0.97` (down to 0.93 on a small drawing), released on `--sg-ease-spring`. A colour shift with it. |

Rules that go with the table:

- Use the individual properties `translate` and `scale`, never `transform`: skins use `transform` for their own art, and a press must not fight it.
- Every register also carries a colour change, so that under reduced motion (below) a press still answers. A press that is only movement is not a press.
- Release easing goes on the resting rule, `transition: translate 120ms var(--sg-ease-out), scale 150ms var(--sg-ease-spring)`. Where an element already has a `transition`, add the two properties to its list; the `:active` rule's `transition: none` then applies to the press only.
- `translate` and `scale` do not apply to a non-replaced inline box. An inline link inside a sentence answers with colour and a thicker underline (`text-decoration-thickness`) in every register; links that are `inline-block`, flex or grid items (nav items, card links, footer links) take the movement too.
- Pressing a `<label>` or the drawn art of a check, radio or switch is pressing the control. Put the rule on the host (`sg-check:active …`): an ancestor of the pressed element is `:active` as well.
- A text field (an OTP code, a combobox input, a signature name) has no press: focus is its press, and its `:focus-visible` ring answers. The check knows this: a component whose markup has only text entry is exempt from the press rule, and says so.
- A disabled control does not answer a press.

## 2. Motion under 300 ms, and none on keyboard-repeated actions

Every transition a control makes is under 300 ms (`--sg-dur-quick` 140 ms, `--sg-dur-calm` 280 ms). Ambient motion that is not a response (a flame, a scene) is outside this rule.

A held or repeated arrow key must not animate. The mechanism is one attribute, set by `packages/core/input-modality.js` (imported by `core/component.js`, so every `sg-*` has it): `:root[data-sg-input="key"]` while a **moving** key is down (arrows, Home, End, PageUp, PageDown), and `"pointer"` once every moving key is released (the file tracks the set of held keys, so letting go of ArrowDown while ArrowRight is held keeps `"key"`) or on any pointer press. A single Space or Enter does not set it, so a toggle still slides when you press Space once. CSS then drops the motion:

```css
:root[data-sg-input="key"] sg-tabs *,
:root[data-sg-input="key"] sg-tabs *::before,
:root[data-sg-input="key"] sg-tabs *::after { transition: none !important; }
```

List the pseudo-elements: `*` does not match `::before` or `::after`, and `:is()` cannot hold them (a radio's dot is a `::before` that transitions `transform`; the first draft of the rule missed it and the check caught it).

Components that move a selection with arrows (tabs, radios, and any menu or listbox) carry this rule. The check holds ArrowRight on a radio or tab and fails if a CSS transition is running.

## 3. Reduced motion keeps the colour and drops the movement

Under `prefers-reduced-motion: reduce`: no `translate`, no `scale`, no release easing; the colour change stays. Either a `@media (prefers-reduced-motion: reduce)` block in the component's CSS, or a skin that reads `ctx.motion` (which the core holds at `still`). A component that never moves needs no block. The check presses each control under reduced motion and fails if anything moved.

## 4. Focus

Every interactive component has a `:focus-visible` style (an outline, ring or underline) that shows on the control, or on the zone around it when the control itself is invisible (the file drop). Use `--sg-focus`, `--sg-focus-width` and `--sg-focus-offset`.

## 5. Sound and haptics: confirm and complete, never every tick

Use `cue(name, { register })` from `packages/sound` (`play()` and `haptic()` together, with the same gates: the sound switch is on, a gesture has happened, never on load). Call it on **confirm** and **complete** only:

| Moment | Word |
|---|---|
| a switch turned on, the sound switch turned on | `confirm` |
| a form, an order or a copy that succeeded | `confirm` |
| a set finished (every box checked, the last step done) | `complete` |
| something failed, said kindly | `error` |

Never on a tick: moving between tabs, stepping through radios, a keystroke, a hover. Turning something off is quiet.

`haptics.js` keys its patterns by the Web Haptics proposal's effect names: `tick`, `success`, `error`, plus `complete` (no proposal equivalent yet). The old sound words stay as aliases (`confirm` plays `success`), so `patternFor('confirm')` and `patternFor('success')` are one pattern, and a future `navigator.playHaptics(effect)` is a one-line change inside `haptic()`.

## 6. The native switch

`sg-toggle` and `sg-sound-switch` set `switch` on their checkbox (`<input type="checkbox" role="switch" switch>`). On an iPhone a real tap on a native switch gives the system haptic, the only sanctioned web haptic on iOS. Other engines ignore the attribute. Do not click a hidden switch from script to fake it: iOS 26.5 closed that path.

Tested (`toggle.check.mjs`, in Chromium, Firefox and WebKit, three registers): the skins look the same with and without the attribute, the element exposes `switch "…"`, and Space still turns it. **Not tested here:** the haptic itself. Playwright's WebKit on Windows (26.6) does not implement the attribute (the native control is the same 12 px box either way, and `input.switch` is undefined), so the system haptic and the native switch look need a real iPhone.

## 7. The check

`node tools/touch.check.mjs` (`--static` skips the browser, `--only tabs,toggle` picks components, `--json` for data). It runs the fixtures first (broken components in `tools/fixtures/touch/`, which must go red for the reason named in each `expect.json`, and the good one must stay green), then the library.

**Which components are interactive** is decided from data, not a list: a component is interactive when its own demo markup, inside its own tag, holds a `button`, `a[href]`, `summary`, `select`, `textarea`, a non-hidden `input`, or an element with a `tabindex` or a control `role`; or when its scripts create one (`createElement('button')`, or the small builders components keep: `mk('button', …)`, `h('a', …)`) or set a `tabindex`. CSS kept in a script's `const CSS = ...` template is read too. A demo's own buttons outside the component (a replay button) do not count. `NOT_INTERACTIVE` in the check is the place for an exclusion, with a reason; it is empty.

**Static pass**, per interactive component, from its CSS and scripts:

- a press state: an `:active` rule (not inside `:not(:active)`, not only under reduced motion) that sets something visible: `translate`, `scale`, a colour, a border, a shadow, a fill, a filter. A rule that sets only `transition` does not count;
- a `:focus-visible` rule that sets an outline, shadow, border, background or underline;
- if the component has any `transition`, `animation` or `.animate()`, reduced-motion handling (a media block, or a skin reading `ctx.motion`).

**Browser probe**, because a static scan can be fooled by an `:active` rule that sets a colour to the colour it already was. On the component's own demo, in each register, with and without reduced motion: hover the control and settle, press the mouse, wait one frame, and require a computed-style change on a node that can be seen (a box, shown, not transparent) somewhere in the component and **no CSS transition running** on the way in. Under reduced motion require the change and **no movement**. Then Tab onto the control and require a focus ring or a style change, and hold an arrow key on a radio or tab and require no transition. The fixtures include one for each way to fool the scan (`hollow-press`, `hidden-press`, `ring-none`, `slow-press`, `arrow-motion`), and one for controls built by a helper (`mk-built`).

What the check cannot see: that the press is *pleasant*, that its colour has contrast, and presses on controls that the demo does not show (a combobox's open list, a menu item). Those are for the screenshots.
