# Empty state

`<sg-empty>` is what a place shows before there is anything in it. You write the words; the register brings the picture.

## Usage

```html
<link rel="stylesheet" href="susegad/components/empty/empty.css">
<script type="module" src="susegad/components/empty/empty.js"></script>

<sg-empty scene="paus">
  <h2>No messages</h2>
  <p>Guests can write to you from their booking. Their messages arrive here.</p>
  <button type="button">Write a welcome note</button>
</sg-empty>
```

Write three things: a heading that says what is empty, one sentence about what will appear and when, and the one action that moves things on. Avoid "Nothing to see here". Say what will be here.

## Attributes and properties

| Name | Type | What it does |
|---|---|---|
| `scene` | scene name (default `paus`) | The scene for warm and playful, and the drawing for quiet. Any scene in `susegad/scenes/` works; quiet has a drawing for Paus and a plain tray for the rest. |
| `scene-<param>` | text | Passed to the scene as `<param>`, for example `scene-intensity="0.5"`, `scene-fog="0.9"` or `scene-seed="4"`. Changes are forwarded as they happen. |
| `register` | `quiet`, `warm` or `playful` | Overrides the page's register for this element. |

## Registers

- **Quiet:** a small hairline drawing beside the words. Nothing moves, and the scene is never downloaded.
- **Warm:** the scene beside the words (above them on a narrow box), drifting slowly. It has its own pause button and pauses off screen.
- **Playful:** the scene in full, and interactive. In Paus you can wipe the fogged glass with a finger, the pointer or the arrow keys.
- **Reduced motion:** the scene shows its finished still. Its play button still plays it for anyone who asks.

## Accessibility

- The element is a `region` named by its heading. Without a heading it has no role.
- The words and action are your own HTML, in reading order, and never sit over the picture.
- In warm, the scene is an image with its own name. In playful it is a focusable interactive drawing with help text, reached by Tab before your action.
- The quiet drawing is `aria-hidden`.

## What moves, and why

An empty state has no progress to show. The scene is weather: it never suggests that something is loading or about to arrive. If something is loading, use a skeleton or a loader instead.
