# Recipes

*Reference file for [`SKILL.md`](../SKILL.md), split out in rung 7 of docs/requests/2026-09-28-open-the-door.md so the top file stays short. Content moved verbatim; nothing here is new.*

## 7. Recipes

A recipe composes components into a flow for a real job. Recipes live in `packages/recipes/<name>/` (decision 0008) and are added like anything else: `susegad add file-upload` copies the recipe, every component it uses, and a demo `index.html` that opens in your project.

| Recipe | Composes | For |
|---|---|---|
| `file-upload` | Empty, Field note, Progress, Toast, Stamp | choosing photos and PDFs, a bar per file, a "Received" stamp at the end |
| `saving-footer` | Loader, Badge, Toast, Connecting | a form that saves itself when the person pauses, and says so |
| `room-details` | Skeleton, Badge | a homestay room card: held in shape until the details arrive, the rate in rupees (₹1,25,000), availability as a badge |
| `enquiry` | Form, Field, Field note, Select, Combobox | "Ask the house": a native form the browser checks, posting to your endpoint without JavaScript |
| `booking` | Form, Stepper, Date range, Select, Combobox, Radio group, Field, One-time code, Check, Toggle, Signature | a stay in four steps (dates, guests and room, your details, confirm and hold), with a quote the booking kernels work out night by night |
| `proposal` | Scene, Price table, Timeline, Diagram, Signature | a priced offer written in Markdown and built into one sealed Folio document (section 8) |
| `storybook-spread` | Scene (Paus), Narration, Player | two facing pages of a story, in English and Marathi, narrated with the word being read marked and the rain following the story (section 9) |

```js
import { mountFileUpload } from './src/lib/susegad/recipes/file-upload/recipe.js';
mountFileUpload(document.querySelector('#upload'), { transport: myTransport });

import { mountSavingFooter } from './src/lib/susegad/recipes/saving-footer/recipe.js';
mountSavingFooter(document.querySelector('form'), { transport: myTransport, toasts: document.querySelector('sg-toast-region') });

import { mountRoomDetails } from './src/lib/susegad/recipes/room-details/recipe.js';
mountRoomDetails(document.querySelector('article.room'), { source: { load: id => fetch(`/api/rooms/${id}`).then(r => r.json()) }, room: 'garden' });

import { mountEnquiry } from './src/lib/susegad/recipes/enquiry/recipe.js';
mountEnquiry(document.querySelector('sg-form.enquiry__form'), data => fetch('/enquire', { method: 'POST', body: data }).then(r => r.ok ? { message: 'Sent.' } : Promise.reject(new Error(`status ${r.status}`))));
```

```js
import { mountBooking } from './src/lib/susegad/recipes/booking/recipe.js';
await Promise.all(['sg-form', 'sg-stepper', 'sg-date-range'].map(t => customElements.whenDefined(t))); // and the rest in the README
mountBooking(document.getElementById('booking'), { blocks: [{ arrival: '2026-11-13', departure: '2026-11-16', kind: 'booking' }] });
```

The booking recipe is a prototype, and says so on the page: it shows the phone code instead of sending it, and answers the hold at once. For real bookings, send and check the code on your server, and resolve `sg-submit` with `{ message, stamp: 'Held' }` only once your server has made the hold. Use the enquiry recipe while bookings aren't open yet. In warm and playful the enquiry shows the house's front elevation beside its words, a still line drawing (`facade.svg`, 16 KB) used as a CSS mask in the register's ink: no JavaScript, `aria-hidden`, and hidden in quiet and in forced colours. For another house, draw its strokes in `facade.scene.mjs` and run `node packages/recipes/enquiry/facade.bake.mjs`.

A recipe's `recipe.js` only exports; importing it wires nothing. Where a demo page needs wiring of its own (the enquiry's prototype answer), it lives in `demo.js`, which your page leaves out.

How every recipe is built, and how to build the next one:

- **A pure core and a transport.** The words (`STRINGS`), the rules and the state machine sit in a pure `*.core.js`, tested in Node with a virtual clock. The page's only source of change is a transport object, a seeded fake in the demo and your `fetch`, `XMLHttpRequest` or websocket in production. Each recipe's README lists the few methods it needs (`start`/`poll`/`busy` for uploads, `request`/`poll` for saving, `load(id)` returning a promise for a room).
- **The screen never runs ahead of the transport.** A bar shows only bytes reported. An upload's bar reaches its end only when the server confirms the file. "Saving" shows only while a save is in flight, and "Saved at 14:32" is the time the save finished. Timers may decide when to start work (the typing pause); they never show progress.
- **Failure is said, then fixed.** A dropped file keeps its bar where it stopped and gets a "Try again" button. A failed save gets one error toast per outage, cleared by itself when the save succeeds. A room card that could not load hides its skeleton without clearing `busy`, so nothing announces an arrival that did not happen, and only the latest request may change the card.
- **The register is the page's.** A recipe draws nothing of its own. Each component reads `data-register`, so one attribute changes the whole flow.
- **One set of words.** Screen readers hear each state once: one status line or one live component per piece of news, with the pictures `aria-hidden`.
