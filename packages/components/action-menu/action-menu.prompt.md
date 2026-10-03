# Menu

*A short list, offered at the press of a name: ruled, ink-ruled, or stamped.*

A button with `popovertarget` and a popover list of real links and buttons. With JavaScript, the ARIA APG menu button keyboard model rides on top of behaviour the browser already gives you.

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

## The prompt

Make a menu button web component around a real `[popovertarget]` button and a `[popover][role="menu"]` list of real `<a>` and `<button>` items, so a click already opens, closes and activates it with no script. Fill in the wiring a builder left off: the panel's `id`, the button's `popovertarget`, `aria-haspopup="menu"` and `aria-expanded`, and `role="menuitem"` on any bare link or button inside the list. Find the trigger by searching descendants, not only direct children, since a builder may wrap it in its own theatre (a `<sg-button>`). Add the ARIA APG menu button keyboard model: on the closed button, ArrowDown opens the menu focused on its first item and ArrowUp on its last; inside the open menu, ArrowDown/ArrowUp move a roving `tabindex` (only the current item is `0`, the rest `-1`) with wraparound, Home/End jump to the ends, a letter key jumps to the next item that starts with it (typeahead, cycling through repeats within half a second), and hovering an item moves the same roving focus a keyboard user would land on. Let Enter, Space and a click activate the focused or clicked item exactly as the browser already would (a real link navigates, a real button's own click fires); after that, close the menu and return focus to the trigger button. Tab closes the menu too, but lets Tab's own default focus change carry on, never trapping focus on the trigger. Leave Escape and outside-click alone: `popover="auto"` already closes the menu and returns focus on Escape, so the component adds nothing there. Stagger the list's entrance and each item's own with the teental sixteen-beat cycle (`talaDelay()`), and turn every entrance off under reduced motion.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a real `[popovertarget]` button and a `[popover][role="menu"]` list | native first | Opening, closing, light-dismiss, Escape-with-focus-return, and every item's own activation are the platform's; the component only adds the keyboard model on top. |
| search descendants, not only direct children | robustness | `this.querySelector('[popovertarget]')`, falling back to the first button or link outside the menu, so a trigger nested in `<sg-button>` is still found. Menu's first draft used `this.children`, which missed exactly this case; fixed once the demo (which does wrap the trigger) caught it. |
| a roving `tabindex` … with wraparound | the APG pattern | `action-menu.core.js`'s `wrap(index, delta, n)` is the one piece of arithmetic; `#move()` sets `tabindex` on the old and new current item and calls `.focus()` on the real element, so native Enter/Space activation needs no extra code. |
| a letter key jumps to the next item … cycling through repeats | typeahead | `typeaheadIndex(labels, query, from)` searches forward from just after the current item and wraps once, so pressing the same letter twice moves past the first match to the next. |
| close the menu and return focus to the trigger button | closing after a real choice | `#choose()` calls `hidePopover()` then `trigger.focus()`, run from a `click` listener delegated on the menu, so it fires whether the item was reached by mouse, keyboard, or its own native activation. |
| never trapping focus on the trigger | Tab is different from Escape | `#close()` (Tab) only calls `hidePopover()`, without moving focus, so Tab's own default still lands wherever it would have; `#choose()` (a real selection) is the only path that pulls focus back to the trigger. |
| stagger … with the teental sixteen-beat cycle | ported timing | `talaDelay(i)` from `packages/tokens/tokens.js` sets `--sg-item-delay` per item; `action-menu.css` reads it in an `animation-delay`, off entirely under reduced motion. |

## Accessibility

- `aria-haspopup="menu"` and `aria-expanded` on the trigger; `role="menu"` and `role="menuitem"` on the list and its items.
- Only the current item is a tab stop; arrow keys, not Tab, move through the menu while it is open, per the APG.
- Escape and outside-click close the menu and return focus to the trigger, both native.
- List border, item text and the current item's highlight hold WCAG contrast in every palette and theme (tested).

## Credit

The stamped skin's dashed outline is a general block-print idiom, shared with the Wave 1 Stamp; no specific credit is owed beyond that component's own.
