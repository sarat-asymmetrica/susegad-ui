# File drop

*Post your files: the letter goes into the box only when they are really kept.*

A file input you can also drop files onto. Without JavaScript it is the browser's own file input and submits with the form. With it, the real input covers a drop zone. The element checks what the browser does not check on a drop, lists what was chosen, and says every change in words.

```html
<link rel="stylesheet" href="susegad/components/file-drop/file-drop.css">
<script type="module" src="susegad/components/file-drop/file-drop.js"></script>

<form action="/send" method="post" enctype="multipart/form-data">
  <sg-file-drop max-size="10 MB">
    <label for="plans">Floor plans <span>PDF or JPG, up to 10 MB each</span></label>
    <input type="file" id="plans" name="plans" accept=".pdf,image/jpeg" multiple>
  </sg-file-drop>
</form>
```

## The prompt

Build a file drop as a light-DOM custom element, `<sg-file-drop max-size="10 MB">`, around a native `<label>` and `<input type=file>`, so that without JavaScript it is the ordinary file input and the form sends the files. With JavaScript, move the label and input into a drop zone and stretch the input over the whole zone, transparent, so clicking, Enter and Space, and dropping onto it are all the browser's own, and show the input's focus on the zone. Also catch drops on the rest of the zone and put the files into the input itself, so the form still sends them. After every change, check what the browser does not check on a drop: the `accept` list read as the browser reads it, a size limit, and one file for an input without `multiple`. Keep what may stay by rebuilding the input's file list, and say in a status line what happened: "2 files chosen" and, for anything turned away, "setup.exe isn't a PDF or JPG, so it wasn't added." List each file with its size in words and a Remove button named for the file, and move focus to the next Remove button (or the input) when one goes. Give it three registers. Quiet: a dashed hairline zone that turns solid while a file is dragged over it, and nothing moves. Warm: a small pillar post box beside the words, with a letter waiting above the slot. It lifts to the slot while a file is dragged over, and is posted through the slot only when files are really kept, clipped so it vanishes at the slot. A turned-away file makes it shake. Playful: the letter drops in faster, the box gives a little as it lands, and three short marks say thunk. With reduced motion, change states without animation.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| stretch the input over the whole zone, transparent | native first | The real input lies over the zone with opacity 0. Every click, key and drop on it is the browser's own, and it stays in the form. |
| put the files into the input itself | `input.files` | A drop elsewhere on the zone sets `input.files = event.dataTransfer.files` and fires `change`, so the form sends exactly what is listed. |
| the `accept` list read as the browser reads it | pure matching | Extensions, `image/*` wildcards and exact types, ignoring case, in a pure function tested in Node. The browser's picker filters by `accept`; a drop does not, so the element does. |
| keep what may stay by rebuilding the input's file list | `DataTransfer` | A `new DataTransfer()` holds the files that pass, and its `files` replaces the input's. |
| say in a status line what happened | live region | One `role="status"` line: the count, then a sentence for each file turned away, in the person's terms ("a PDF or JPG", "over 10 MB"). |
| clipped so it vanishes at the slot | SVG clip path | The letter is clipped to the area above the slot. It slides down in front of the box and disappears exactly as it passes into it. |
| only when files are really kept | motion that follows the work | The letter is posted on a real change that kept at least one file, never on a timer or on hover alone. |
