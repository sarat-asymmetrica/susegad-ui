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

The list's entrance, and each item's own, follow the teental sixteen-beat stagger (`talaDelay()` from `packages/tokens/tokens.js`), capped so the last item of a long menu is never kept waiting past 600ms. Reduced motion turns every entrance off.

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

## Budget

Behaviour 6.7 KB (`action-menu.js` + `action-menu.core.js`); skins quiet, warm and playful are each a no-op mount, under 0.2 KB: the look is entirely in `action-menu.css`, keyed off `[data-skin]` and `[data-open]`.
