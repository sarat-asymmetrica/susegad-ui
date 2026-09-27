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

## What moves, and why

The letter is posted only when files are really kept. Nothing is uploaded until the form is sent, so the element says "chosen", not "uploaded".
