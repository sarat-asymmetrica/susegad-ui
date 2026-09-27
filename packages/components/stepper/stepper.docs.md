# Stepper

`<sg-stepper>` walks a long form one step at a time, and falls back to the whole form, in order, without JavaScript.

## Usage

```html
<link rel="stylesheet" href="susegad/components/stepper/stepper.css">
<script type="module" src="susegad/components/stepper/stepper.js"></script>

<form action="/book" method="post">
  <sg-stepper>
    <fieldset><legend>Your dates</legend> … </fieldset>
    <fieldset><legend>Who is coming</legend> … </fieldset>
    <fieldset><legend>Your details</legend> … </fieldset>
    <button type="submit">Send the request</button>
  </sg-stepper>
</form>
```

Each step is a `<fieldset>` with a `<legend>`, a direct child of the element. The one submit button goes last. Use the form's own validation (`required`, `min`, `type=email`): the stepper uses it at every step.

## Attributes, properties, methods and events

| Name | What it does |
|---|---|
| `seed` | Changes the map in warm and playful. The same seed always draws the same map. |
| `register` | `quiet`, `warm` or `playful`; overrides the page's register. |
| `index` (property) | The step showing, from 0. |
| `next()` | Checks the current step and moves on if it is complete. Returns `true` if it moved. |
| `go(i)` | Shows step `i` without checking, for example to jump back to a step from a summary. |
| `sg-step` (event) | Fires on every change, with `detail: { index, from }`. |

## Registers

- **Quiet:** numbered stations joined by a hairline. Nothing moves.
- **Warm:** a small survey map of the walk. The road you have walked is inked; moving on inks the next leg and stepping back lifts it.
- **Playful:** the map in the accent colour, with footprints along the road.
- **Reduced motion:** the walk is drawn at once.

## Accessibility

- Without JavaScript, every step shows, numbered, and the form submits normally.
- One step shows at a time. The others are hidden, not removed, so nothing typed is lost and hidden steps still submit.
- Focus moves to each new step's legend, which is described by the "Step 2 of 3" line.
- Next checks the current step and focuses the first problem with the browser's own message. If you submit with a problem in another step, the stepper takes you there first.
- Enter in a one-line field moves to the next step instead of submitting early.
- The map is `aria-hidden`; everything it shows is in words.

## What moves, and why

The map moves only when you change step, and only as far as you went.
