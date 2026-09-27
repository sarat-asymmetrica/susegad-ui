// Builds demo.html: the diagrams rendered here, at build time, exactly as a
// Folio document would carry them, so the page reads without JavaScript.
//   node packages/folio/diagram/demo.mjs
import { writeFileSync } from 'node:fs';
import { renderDiagram } from './render.js';

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const examples = [
  {
    heading: 'Step through it',
    note: 'Four steps, each with its own words. Use the buttons or the arrow keys.',
    opts: { steps: true, id: 'booking' },
    src: `title: How a booking at Casa Exemplo travels
Portal = Booking portal
group Casa Exemplo: Owner, Caretaker
Guest -> Portal: books a stay
> The guest picks the dates and pays a deposit on the booking portal.
Portal => Owner: asks to hold
> The portal asks the owner to hold those dates, and the request waits in the owner's queue.
Owner -> Caretaker: readies the house
> The owner tells the caretaker, who airs the rooms and makes up the beds.
Owner -> Guest: confirms
> The owner confirms, and the guest gets the address and the caretaker's number.`,
  },
  {
    heading: 'Flows, running down',
    note: 'A flow (=>) has something moving along it. It stays still in quiet and when motion is reduced.',
    opts: { id: 'rain' },
    src: `title: Where the monsoon rain goes
direction: down
Roof => Gutter: runs off
Gutter => Tank: fills
Tank => Garden: overflows
Tank -> Kitchen: after the filter
group The house: Roof, Gutter, Tank, Kitchen`,
  },
  {
    heading: 'A loop back, and numbers on a narrow page',
    note: 'A connection that goes back against the flow loops round the side that meets no other box. Where a label cannot sit clear beside its own line, every connection carries its number instead, matching the steps.',
    opts: { steps: true, id: 'direct' },
    src: `title: How a direct booking reaches you
Guest = Guest
Site = Your site
Bank = Your bank
Guest -> Site: chooses dates
> The guest picks dates on your own site.
Guest => Razorpay: pays
> They pay by UPI or card, through Razorpay.
Site -> Guest: confirms, with the house manual
> Your site confirms the stay and sends the house manual.
Razorpay => Bank: the payment, less the fee
> Razorpay pays the money into your bank, less its fee.`,
  },
  {
    heading: 'Lines both ways',
    note: 'A plain line (--) and a two-way arrow (<->).',
    opts: { id: 'people' },
    src: `title: Who talks to whom during a stay
Guest <-> Caretaker: day to day
Caretaker <-> Owner: every evening
Guest -- Owner
Owner -> Cleaner: books
Cleaner -- Caretaker`,
  },
];

const body = examples.map(x => `  <section>
    <h2>${x.heading}</h2>
    <p class="note">${x.note}</p>
    ${renderDiagram(x.src, x.opts).html}
    <details class="source"><summary>The source</summary><pre>${esc(x.src)}</pre></details>
  </section>`).join('\n');

writeFileSync(new URL('./demo.html', import.meta.url), `<!doctype html>
<html lang="en">
<head>
<script src="/tools/harness/demo.js"></script>
<link rel="stylesheet" href="/packages/tokens/fonts.css">
<link rel="stylesheet" href="/packages/tokens/tokens.css">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagram</title>
<link rel="stylesheet" href="./diagram.css">
<style>
  body { margin: 0; background: var(--sg-surface); color: var(--sg-text); font: var(--sg-step-0) / var(--sg-leading-body) var(--sg-font-body); }
  main { max-width: 60rem; margin: 0 auto; padding: var(--sg-space-5) 16px var(--sg-space-6); }
  h1 { font: 400 var(--sg-step-4) / var(--sg-leading-tight) var(--sg-font-display); margin: 0 0 var(--sg-space-2); }
  h2 { font: var(--sg-weight-medium) var(--sg-step-1) / 1.3 var(--sg-font-body); margin: var(--sg-space-6) 0 var(--sg-space-2); }
  .lede, .note { margin: 0; max-width: var(--sg-measure); color: var(--sg-text-soft); }
  .note { font-size: var(--sg-step--1); }
  .source { font-size: var(--sg-step--1); color: var(--sg-text-soft); }
  .source summary { cursor: pointer; width: fit-content; }
  .source summary:focus-visible { outline: var(--sg-focus-width) solid var(--sg-focus); outline-offset: 2px; }
  pre { font: var(--sg-step--1) / 1.5 var(--sg-font-mono); background: var(--sg-surface-sunk); padding: var(--sg-space-3); border-radius: var(--sg-radius-2); overflow-x: auto; }
</style>
</head>
<body>
<main>
  <h1>Diagram</h1>
  <p class="lede">A few lines of text become a diagram, drawn when the document is built. It reads and prints without JavaScript, and every diagram carries the same content in words.</p>
${body}
</main>
<script type="module" src="./diagram.js"></script>
</body>
</html>
`);
console.log('wrote demo.html');
