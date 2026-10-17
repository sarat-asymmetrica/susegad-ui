# Menu

`<sg-action-menu>` wraps a button with `popovertarget` and a popover list of real links and buttons. A click opens and closes it, and every item is a real focusable control, with or without JavaScript. With JavaScript this adds the ARIA APG menu button keyboard model: a roving tabindex, arrow keys, Home, End and typeahead.

## Use

```html
<link rel="stylesheet" href="susegad/components/action-menu/action-menu.css">
<script type="module" src="susegad/components/action-menu/action-menu.js"></script>

<sg-action-menu>
  <button popovertarget="account-menu">Account</button>
  <ul id="account-menu" popover role="menu">
    <li role="none"><a href="/profile" role="menuitem">Profile</a></li>
    <li role="none"><button type="button" role="menuitem">Sign out</button></li>
  </ul>
</sg-action-menu>
```

Leave `id`, `popovertarget` and `role="menuitem"` off and the element wires them itself. The trigger may be wrapped in its own theatre (`<sg-button>`, for instance); the element looks for the first `[popovertarget]`, or the first button or link outside the menu, whichever it finds first.

## Attributes and properties

| | Values | Default |
|---|---|---|
| `register` | `quiet`, `warm`, `playful` | inherited |
| `open` (property, read only) | boolean | `false` |

## Registers

| | Look |
|---|---|
| quiet (and no JS) | a ruled list, a hairline between items |
| warm | an ink-ruled list: an accent margin, the rules and the hover/focus wash in ink |
| playful | a stamped list: a bolder frame, and a dashed stamp outline that lands on hover or focus |

The list arrives and leaves as a CSS transition from `@starting-style`: quiet is 120 ms of opacity and nothing else, warm adds a short rise, playful a longer one on the spring. Each item's own entrance follows the teental sixteen-beat stagger, capped so the last item of a long menu is never kept waiting past 600 ms. The stylesheet does the stagger with `sibling-index()` (the three khali beats stay silent); `talaDelay()` in `packages/tokens/tokens.js` is the same arithmetic and the source of truth, and the element sets the delays from it in a browser that lacks `sibling-index()`. Reduced motion turns every entrance off.

An item is pressed: the state answers in the same frame, with no transition, and eases back in under 150 ms. Quiet settles 1 px, warm shades the colour toward the ink, playful gives a little (scale 0.97, released on the spring). The keyboard never moves it, and under reduced motion the shade stays and the movement goes. Arrow keys do not press anything.

## Positioning

Where CSS anchor positioning is supported the browser places the list: below its trigger, flipped above or across when it will not fit, with no script (a `popovertarget` trigger is the implicit anchor) and no scroll or resize listeners. Elsewhere the element measures and places it. Either way, the last step is fitting it to what a person can see: action-menu.js measures the open list against `window.visualViewport` (its `visibleBox()` in the core; without one, the document's `clientWidth`) and, if it sits outside, slides it back to 8 px inside with a `--sg-fit-x` custom property that the stylesheet turns into a `translateX`. Not `window.innerWidth`: mobile Chromium widens it to fit overflowing content, and an anchored panel's containing block follows, so on a phone a panel opened near the right edge used to spill past the screen. The fit runs once more in the frame after `beforetoggle` (so the first painted frame is already fitted, not one task later), and on resize and the visual viewport's resize and scroll. The fallback places from the trigger's top edge, never from `innerHeight`, which a phone widens. `fitShift()` is pure and tested; the phone cells of the check press it at 390 px on a clean page and on a widened one, with and without anchor positioning.

## Keyboard (ARIA APG menu button)

| Key, on the closed button | Does |
|---|---|
| Enter, Space, click | Opens the menu (the platform's own popover behaviour) |
| ArrowDown | Opens the menu, focused on the first item |
| ArrowUp | Opens the menu, focused on the last item |

| Key, inside the open menu | Does |
|---|---|
| ArrowDown / ArrowUp | Moves the roving focus, wrapping at both ends |
| Home / End | Jumps to the first or last item |
| A letter | Jumps to the next item starting with it (typeahead, cycling through repeats) |
| Enter, Space, click on an item | Activates it (the item's own native behaviour), closes the menu, returns focus to the button |
| Escape | Closes the menu and returns focus to the button (the platform's own `popover="auto"` behaviour) |
| Tab | Closes the menu and moves focus onward, as Tab always does |

Hovering an item with a pointer moves the same roving focus a keyboard user would land on, so the two ways of using the menu always agree on which item is "current".

## Accessibility

- The trigger carries `aria-haspopup="menu"` and `aria-expanded`.
- Every item is a real `<a>` or `<button>`; its own activation, not a synthetic one, does the work.
- Only the current item is a tab stop (`tabindex="0"`); the rest are `-1`, the APG roving-tabindex pattern.
- List border, item text and the hover/focus background hold WCAG contrast in every palette and theme (tested).

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The warm and playful stamps behind an item are decoration drawn behind the text and are never created under reduced motion (`packages/components/action-menu/action-menu.check.mjs`: "reduced motion, playful: the stamp is never even created, not just paused"). Items are text. |
| 1.3.1 Info and relationships | Meets | A `role="menu"` list in the browser's popover layer with `role="menuitem"` links and buttons, and a trigger that carries `aria-haspopup="menu"` and `aria-expanded` (`packages/components/action-menu/action-menu.js`). `action-menu.check.mjs`: "no JS: Tab reaches the first real item" shows the plain popover list works with no script. |
| 1.4.1 Use of color | Meets | An item is its words; the roving item is shown by an outline and a background, and the focused item is not told apart by colour alone (`packages/components/action-menu/action-menu.test.js`: "every register keeps a visible focus outline on the roving item"). |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/action-menu/action-menu.test.js`: "contrast: <palette> <theme>: the list's border, text and the focused item's background read" for every palette, light and dark. axe `color-contrast` is clean on the closed page and on the open menu: `tools/axe.mjs --url /packages/components/action-menu/demo.html`: 0 violation(s) across 6 run(s) (three registers, light and dark, desktop), 2026-10-07, and the same script run with the menu open (axe-core with the WCAG 2.2 AA tags, three registers, light): 0 violations, nothing to review. |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: the demo with the root font size at 200 percent in three registers (1280 px wide) and the menu open, nothing clipped, nothing wider than the screen; the list is 417 to 419 px wide and 363 to 398 px tall (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test at 320 CSS px with the menu open, three registers, 2026-10-07: no sideways scroll, the list 202 to 204 px wide, left edge at 16 px, inside the viewport (throwaway Playwright script). On a phone (a touch, `isMobile` context at 390 px, a trigger pinned to the right edge) `action-menu.check.mjs` "<register>, phone, <clean or widened page>[, JS fallback]: a list opened from the right edge stays inside the visual viewport" and "opening it adds no sideways scroll to the page" measure the open list against `visualViewport` and the page with `tools/lib/overflow.mjs`; before the fix the list sat past the screen on a widened page. |
| 1.4.11 Non-text contrast | Meets | The list border is `--sg-rule-strong` and the focus ring is `--sg-focus`, tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`; `action-menu.test.js` ("contrast: ...") tests the border and the focused item's background. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected with the menu open, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 1.4.13 Content on hover or focus | Not applicable | The list opens when the reader presses the trigger or an arrow key, not when the pointer hovers or focus lands. Hovering an item only moves the roving focus (`action-menu.check.mjs`: "hovering an item moves the roving focus to it"). |
| 2.1.1 Keyboard | Meets | `packages/components/action-menu/action-menu.check.mjs`: ArrowDown opens it on the first item, ArrowUp on the last, ArrowDown, ArrowUp, Home and End move (wrapping at both ends), typing a letter jumps to a matching item, Enter activates the item's own handler, Escape closes. All three registers. |
| 2.1.2 No keyboard trap | Meets | `action-menu.check.mjs`: "Escape closes the menu and returns focus to the trigger", "Tab closes the menu" and "Tab does not return focus to the trigger", so Tab leaves the list onward. |
| 2.1.4 Character key shortcuts | Meets | Typing a letter to jump to an item only works while focus is inside the open list (`#onMenuKey` in `packages/components/action-menu/action-menu.js`), which the criterion allows as a shortcut active only on focus. `action-menu.check.mjs`: "typing \"p\" jumps to an item starting with P". |
| 2.4.3 Focus order | Meets | `action-menu.check.mjs`: focus lands on the first item when the menu opens, "activating an item closes the menu" and "focus returns to the trigger". |
| 2.4.7 Focus visible | Meets | `action-menu.test.js`: "every register keeps a visible focus outline on the roving item", and `tools/touch.check.mjs` requires a focus style on the control in every register. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: at 320 by 640 px the menu opened and Tab pressed eight times in each register; every focused control was fully in the viewport and the element at its centre was itself (`elementFromPoint`). The list is in the browser's top layer, so a sticky bar of the page cannot cover it; a sticky bar can cover the trigger when it is scrolled to. |
| 2.5.3 Label in name | Meets | Items and the trigger are named by their visible text; the component adds no `aria-label` (`packages/components/action-menu/action-menu.js`). |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07: the items are 192 px wide and 42 to 46 px tall at 320 px, and no focusable control in the open menu is under 24 by 24 CSS px, in all three registers (throwaway Playwright script). The trigger is an `sg-button`, 44 px tall. |
| 4.1.2 Name, role, value | Meets with author's part | The trigger carries `aria-haspopup="menu"` and `aria-expanded` that follows the list, and items are `menuitem`s (`action-menu.js`). The list itself has no accessible name unless the page gives one: Manual test, 2026-10-07, Chromium: `ariaSnapshot` of the open warm menu reads `menu:` with three `menuitem`s and no name. axe: 0 violations, closed and open. The ARIA authoring practices for a menu button name the list by pointing `aria-labelledby` at the trigger, which is the page author's part here. |

**The page author owns:**

- The items' words, in the language of the page, and `lang` on an item in another language (3.1.2).
- `aria-labelledby` on the `role="menu"` list pointing at the trigger, so the list has a name (4.1.2).
- The `role="none"` on each `<li>` and `role="menuitem"` on each link or button, as the demo writes them.
- Sticky headers and banners that could cover the trigger when it takes focus (2.4.11).
- The colours the page sets behind the menu, if it overrides the tokens.

## Budget

Behaviour 6.7 KB (`action-menu.js` + `action-menu.core.js`); skins quiet, warm and playful are each a no-op mount, under 0.2 KB: the look is entirely in `action-menu.css`, keyed off `[data-skin]` and `[data-open]`.
