# File drop

`<sg-file-drop>` is a file input that also takes dropped files, checks them, lists them, and still works as a plain file input without JavaScript.

## Usage

```html
<link rel="stylesheet" href="susegad/components/file-drop/file-drop.css">
<script type="module" src="susegad/components/file-drop/file-drop.js"></script>

<form action="/send" method="post" enctype="multipart/form-data">
  <sg-file-drop max-size="5 MB">
    <label for="id">Photo ID <span>One photo, JPG or PNG, up to 5 MB</span></label>
    <input type="file" id="id" name="id" accept="image/jpeg,image/png" required>
  </sg-file-drop>
  <button>Send</button>
</form>
```

Put a `<label for>` and an `<input type="file">` inside. Everything about what may be sent lives on the input: `accept`, `multiple`, `required`, `name`. The form sends the files the normal way.

## Attributes, properties and events

| Name | What it does |
|---|---|
| `max-size` | The largest file allowed, like `10 MB`, `500 KB` or a number of bytes. Larger files are turned away with a sentence saying so. |
| `handoff` | For pages that take files the moment they arrive, like an uploader. The zone hands each choice or drop to the page and posts the letter; the page does the checking, listing and saying (the file-upload recipe uses its field note and progress list). |
| `register` | `quiet`, `warm` or `playful`; overrides the page's register. |
| `remove(i)` (method) | Removes the file at index `i`. |
| `sg-files` (event) | Fires after every change, with `detail: { files, messages }`. |

Say the limits in the label's hint as well, for example "PDF or JPG, up to 10 MB each". The element also checks them, and says so if a file doesn't fit.

## Registers

- **Quiet:** a dashed hairline zone that turns solid while you drag a file over it. Nothing moves.
- **Warm:** a pillar post box. The letter lifts to the slot while you drag a file over, and is posted when files are kept.
- **Playful:** the letter drops in with a thunk.
- **Reduced motion:** the states change without animation.

## Accessibility

- Without JavaScript it is the native file input, labelled by your label.
- With JavaScript it is still the native input, stretched over the zone, so Tab reaches it, Space or Enter opens the file chooser, and the label names it. The zone shows its focus ring.
- One status line says how many files are chosen and why any were turned away.
- Each file in the list has a Remove button named for it ("Remove plan.pdf"). Removing one moves focus to the next Remove button, or back to the input.
- `required` works as usual: the form waits, and focus goes to the input.
- The post box is `aria-hidden`.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The post box and the drawn zone are `aria-hidden="true"` (`packages/components/file-drop/skins/post.js`; the visual prompt in `packages/components/file-drop/file-drop.js` too), and the label names the input. The words are real text: the status line and each file's name and size. |
| 1.3.1 Info and relationships | Meets | The native `<input type="file">` and its `<label>` stay in place; the list is a real `<ul>` and the status line a `role="status"` (`file-drop.js`). `packages/components/file-drop/file-drop.check.mjs`: "no JS: the native file inputs show, with their labels", "<register>: a chosen file is listed with its size". |
| 1.3.5 Identify input purpose | Not applicable | A file chooser holds no personal data of a kind the criterion's list names. |
| 1.4.1 Use of color | Meets | A file turned away is said in words ("setup.exe isn't a PDF or JPG, so it wasn't added", "huge-scan.pdf is over 10 MB"): `file-drop.check.mjs`, "a drop lands in the input; a wrong type is turned away, and said why", "a file over the limit is turned away". |
| 1.4.3 Contrast (minimum) | Meets | The cue, list and status are `--sg-text` roles on the page surface: 12.6:1 light and 14.2:1 dark in the default palette (manual test, 2026-10-07, painted colours read from the demo), and 4.5:1 or more in every palette and theme in `packages/tokens/tokens.test.js`. Axe: `tools/axe.mjs --url /packages/components/file-drop/demo.html`, 0 violations across 6 runs (3 registers, light and dark), desktop, 2026-10-07. With two files chosen, one of them turned away, axe finds 0 violations in all three registers, light and dark (axe-core 4.13.0 run on that state, 2026-10-07). |
| 1.4.4 Resize text | Meets | Manual test, 2026-10-07: demo with the root font size at 200 percent, three registers, no sideways scroll and nothing clipped (throwaway Playwright script). |
| 1.4.10 Reflow | Meets | Manual test, 2026-10-07: demo at 320 CSS px, three registers, no sideways scroll (document width 320). With two files chosen at 390 px the page is still 390 wide. |
| 1.4.11 Non-text contrast | Meets | The zone's dashed border is `--sg-rule-strong`: 3.66:1 against the page in light and 3.69:1 in dark in the default palette, in all three registers (manual test, 2026-10-07, painted colours). `packages/tokens/tokens.test.js` asserts 3:1 or more for the rule and the focus ring on every surface for every palette and theme. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph 2em) injected on the demo, three registers, no clipped or overlapping text (throwaway Playwright script). No check in the repository asserts it yet. |
| 2.1.1 Keyboard | Meets | `file-drop.check.mjs`: "<register>: Tab reaches the real input, the zone shows focus, Space opens the chooser"; the Remove buttons are native buttons ("Remove takes the file out and keeps focus in the list"). Dragging is an extra way in, never the only one. |
| 2.1.2 No keyboard trap | Meets | Manual test, 2026-10-07: `packages/components/file-drop/file-drop.js` binds no `keydown` and sets no `tabindex`; focus moves between native controls with Tab. |
| 2.4.3 Focus order | Meets | `file-drop.check.mjs`: after Remove, focus goes to the next Remove button, or back to the input ("Remove takes the file out and keeps focus in the list"); otherwise the order is the page's. |
| 2.4.7 Focus visible | Meets | `tools/touch.check.mjs` Tabs onto the control in each register and requires a focus style; `file-drop.check.mjs` requires the zone to show a ring when the input is focused. |
| 2.4.11 Focus not obscured (minimum) | Meets with author's part | Manual test, 2026-10-07: `packages/components/file-drop/file-drop.css` uses no `position: fixed` or `sticky`. A sticky header or banner the page adds can cover the zone or a Remove button that is scrolled to. |
| 2.5.3 Label in name | Meets | The input's name is the visible label, and a Remove button's name is "Remove <file name>" (`file-drop.check.mjs`, focus on "Remove garden.jpg"). The button shows a "×" symbol, not words, so there is no visible word for the name to contain; this is our reading of the criterion, not a checked fact. |
| 2.5.7 Dragging movements | Meets | Dropping files on the zone is optional: the input is stretched over the zone, so a click or tap opens the chooser, and each file has a Remove button (`file-drop.check.mjs`, "Tab reaches the real input ... Space opens the chooser"; "Remove takes the file out"). |
| 2.5.8 Target size (minimum) | Meets | Manual test, 2026-10-07, 390 px touch: the input that is the whole zone is 340 by 136 px in quiet and 340 by 157 px in warm and playful, and each Remove button is 44.0 by 44.0 px. No check in the repository asserts target size for the file drop yet. |
| 3.2.2 On input | Meets | Choosing or dropping files only lists them and says so; it submits nothing and moves no focus (`file-drop.check.mjs`: "the form sends exactly the files listed" only once the form's own button is pressed). |
| 3.3.1 Error identification | Meets | A rejected file is named and the reason said in the status line, whether it is the wrong type, too big, or one too many for a single-file box: `file-drop.check.mjs`, "a wrong type is turned away, and said why", "a file over the limit is turned away", "a single-file box keeps the first of several, and says so". A `required` input is stopped by the browser, with focus on the input ("required: the form waits for the photo ID, and focus goes to it"). |
| 3.3.2 Labels or instructions | Meets with author's part | The native `<label>` names the input (`packages/components/file-drop/file-drop.check.mjs`, "no JS: the native file inputs show, with their labels") and the zone says what it takes ("PDF or JPG", the size limit, from `accept` and `max-size`). The label text and what the files are for are the author's. |
| 4.1.2 Name, role, value | Meets | The control stays the native file input with its label; each Remove button has a name. Axe with JavaScript off: `tools/axe.mjs --no-js --url /packages/components/file-drop/demo.html`, 0 violations across 6 runs, 2026-10-07. |
| 4.1.3 Status messages | Meets | One `role="status"` line says how many files are chosen and why any were turned away, and says it again on Remove: `file-drop.check.mjs`, "a chosen file is listed with its size" (`1 file chosen`), "Remove takes the file out ... ground-floor.pdf removed." |

**The page author owns:**

- The label text and what the files are for, in the language of the page, and `lang` on a label in another language (3.1.2).
- The `accept` and `max-size` the page asks for, and the page's own check on the server: the element only keeps files that match, and uploads nothing.
- Sticky headers and banners that could cover the zone or a Remove button when it takes focus (2.4.11).
- The colours the page sets behind the zone, if it overrides the tokens.

## What moves, and why

The letter is posted only when files are really kept. Nothing is uploaded until the form is sent, so the element says "chosen", not "uploaded".
