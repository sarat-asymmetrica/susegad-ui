# Room details

A room card for a homestay's booking page. It keeps the card's shape until the room's details arrive, then shows them (in warm and playful, inking them in): a view from the room, the name, who it sleeps and in what beds, the rate in rupees, what is included, and whether there is a room left. If the details cannot be loaded, it says so and offers to try again.

It composes two library pieces:

| Piece | Used for |
|---|---|
| `<sg-skeleton>` | the card's placeholder, from the first moment until the details arrive, and never longer or shorter |
| `<sg-badge>` | availability: "2 rooms left" (warning), "Available" (success), "Fully booked" (neutral) |

## Files

| File | What it is |
|---|---|
| `source.js` | A fake source, pure and seeded: three rooms, a seeded delay where the network would be, and failures only when the world says so (`failNext()`). Swap it for anything with `load(id) → Promise<room>`. |
| `room.core.js` | The words (`STRINGS`), rupee formatting, availability, the load state machine and the view, all pure. |
| `recipe.js` | The wiring: `mountRoomDetails(card, { source, room })`, plus `stillRoom` for the gallery of states. |
| `recipe.css` | The card's look: layout, the painted view's frame and the type, all from tokens. |
| `index.html` | The demo: a live card, two buttons standing in for the network, and every state of the card. Works in a builder's project too. |
| `recipe.test.js` | Tests for the source, the formatting, the machine and the view. |

## Put it on a page

```html
<link rel="stylesheet" href="susegad/tokens/fonts.css">
<link rel="stylesheet" href="susegad/tokens/tokens.css">
<link rel="stylesheet" href="susegad/components/skeleton/skeleton.css">
<link rel="stylesheet" href="susegad/components/badge/badge.css">
<link rel="stylesheet" href="susegad/recipes/room-details/recipe.css">

<article class="room" data-room="garden"></article>

<script type="module">
  import { mountRoomDetails } from './susegad/recipes/room-details/recipe.js';
  const source = { load: id => fetch(`/api/rooms/${id}`).then(r => (r.ok ? r.json() : Promise.reject(new Error(r.statusText)))) };
  mountRoomDetails(document.querySelector('.room'), { source });
</script>
```

Your source returns `{ name, summary, sleeps, beds: { double, single }, rate, per: 'night' | 'week', included: [...], left }`. The card's look is in `recipe.css`, which the snippet links. Change it, or replace it with your own.

## What moves, and why

- The skeleton is shown the moment a load starts and stays until the source answers. There is no minimum time and no timer; the only waiting is the source's own.
- Only the latest load may change the card. A slow answer to an older request is ignored, so pressing "Load it again" twice never shows the first answer after the second.
- On failure, the skeleton is hidden but stays busy, so nothing announces "The room details loaded" when they did not. The error says what happened and what to do, in a `role="alert"` line with a Try again button.
- Try again moves focus to the card, so keyboard and screen reader users are not left on a button that has gone.
- Rates use `Intl.NumberFormat('en-IN')`: ₹3,200 a night, ₹1,25,000 a week.
- Availability is words first ("Fully booked"), with the badge's tone and shape as backup. A fully booked room offers "Ask about other dates" instead of "Choose your dates".

## Registers

Everything comes from the two components: quiet shows flat blocks and fades to the details; warm sketches the card in pencil and inks the outlines when the details arrive; playful adds colour and a wobble on twos while waiting. Reduced motion shows the details at once.
