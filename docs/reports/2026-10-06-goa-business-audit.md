# Audit: what Goan businesses need, what the shelf has, and how it responds to a touch

*6 October 2026. From the owner's ask, written by the Sutradhar (Claude Opus 5.5) from the registry (116 items on main) plus the three unmerged food branches, and a read of every component's source. Gaps marked **missing** were checked against the code with a search, not assumed. Purpose: material for the next long-horizon goals, so each one can mix a vertical, the foundations it needs, and a microinteraction sweep.*

## 1. Who we are building for

| Business | Typical flow | What we have | What's missing |
|---|---|---|---|
| Homestay, villa, guesthouse | browse rooms → pick dates and guests → enquire or book → pay a deposit → arrival details | booking, date-range (with booked nights), room-details, enquiry, gallery, kernels-booking, site-shell | guest-count stepper, seasonal rate card, deposit by UPI, directions by landmark, arrival info card (Wi-Fi, house rules, check-in), reviews summary |
| Restaurant, café, shack, home baker | see the menu → is it open now? → order on WhatsApp or reserve a table | menu, wa-order, food-order, haldi palette, doodle, tumble, vaati (branches) | opening hours honest by the clock (seasons, feast-day closures), table reservation by time slot, "sold out today", UPI pre-pay |
| Tours and activities (dolphin trips, kayaking, spice farms, heritage walks, diving) | pick a date → pick a slot with seats left → people count → pay → ticket | event-card, event-list, form, signature (waivers) | time-slot picker with capacity, per-person price total, weather or tide notice, ticket with QR |
| Rentals (scooters, cars, cycles) | pick a vehicle → dates and times → upload licence → deposit | date-range, file-drop, file-upload, stepper | choice cards (a vehicle as a rich radio), hourly ranges, deposit by UPI |
| Events, feasts, tiatr nights, gigs | see what's on → lineup or schedule → tickets → share | event-list, event-card, kantar scenes | ticket tiers with quantity, schedule or timetable, countdown, share to WhatsApp |
| Clinics, yoga, ayurveda, wellness | pick a practitioner → pick a slot → intake form | person-card, stepper, form, otp | appointment slots, package price table |
| Artisans and shops (azulejo, cashew, feni, khadi, pottery) | browse → choose a variant → cart → order or pay → ship | gallery, menu (food-shaped), wa-order (food-shaped), tile-band | product card with variant swatches, a general cart → WhatsApp (wa-order beyond food), shipping note, reviews |
| Property and real estate | filter listings → see specs → enquire | data-table, gallery, enquiry, combobox | listing card, filter chips over a list, spec sheet, EMI calculator |
| Schools, NGOs, parishes, temples, clubs | notices → timings (Mass times, classes) → donate or volunteer | event-list, member-directory, form | notice board or announcement banner, weekly timetable, donation by UPI |
| Studios and professionals (architects, CAs, designers) | portfolio → proposal → invoice → paid | studio-home, postcard, proposal (Folio), stamp, signature | invoice and receipt in Folio, pay link on the invoice |

## 2. The flows with no clean option yet

Ordered by how many of the businesses above need them.

1. **Pay by UPI.** Missing (no `upi:` anywhere). An intent link on a phone, a QR code on a laptop, the amount and a reference in words, "I've paid" with the reference typed back, then a `stamp` (paid, pending). No gateway, no keys: the business checks its own UPI app. Needs a **QR primitive** too (also for tickets and guest Wi-Fi).
2. **Time slots with capacity.** Missing. A day's slots as native radios, "4 seats left" in text, full slots disabled and saying why, honest by the clock (past slots go). Shared by tours, clinics, table bookings and classes.
3. **Opening hours, honest by the clock.** Missing. "Open now, closes at 11", the week as a table, seasons (shacks close June to September), feast-day and holiday closures, IST always. event-list already proves the "honest by the clock" pattern.
4. **Quantity and guest-count stepper.** Partial: `stepper` is the multi-step form, and quantity lives inside wa-order. A standalone native `input type=number` with − and + buttons, limits stated in words.
5. **Choice cards.** Missing. A radio group whose options are rich cards (a room, a vehicle, a ticket tier, a package): image, price, one line, still a real fieldset.
6. **Rate card and seasonal pricing.** Missing. Peak, shoulder and monsoon rates; per night, per person; `en-IN` money formatting (₹1,25,000, lakh grouping) as a shared helper, since 5 components format prices on their own today.
7. **Where we are.** Missing (no map links anywhere). Goan addresses are landmarks ("behind the chapel, after the bakery"). A directions block: the landmark text, a link out to the phone's maps app (`geo:` and a maps URL), optional drawn locator. No embedded map, no third-party script.
8. **Reviews summary.** Partial: `quote` is one testimonial. A summary (count, average in words, not stars alone) plus a list of quotes, with the source named.
9. **Filter and search a list.** Partial: member-directory filters person-cards. Generalise it into filter chips plus a text filter over any list of cards (listings, products, events), state in the URL.
10. **Share.** Missing. `navigator.share` with a WhatsApp link fallback, and copy-link feedback. Copy exists only inside reach.
11. **Announcements.** Missing. One dismissible site-wide banner ("Closed for the monsoon, back 1 October"), remembered per visitor.
12. **Language.** Missing as a component (only storybook-spread switches). A switcher for English, Konkani (Romi and Devanagari), Marathi and Hindi; `hreflang`; the type tier already carries Devanagari.
13. **Product card and variants.** Missing. Swatches as radios (size, glaze, weight), price that follows the choice, add to a cart that ends in wa-order.
14. **Ticket.** Missing. A Folio-style ticket or booking confirmation with a QR, printable and savable, readable offline.
15. **Weak signal.** Partial: `connecting` and `saving-footer` exist. Missing an offline page and a small service-worker recipe, so a guest's booking confirmation opens with no signal in a monsoon.
16. **Consent notice under India's DPDP Act.** Missing. A plain notice for forms that collect personal data (what, why, how long, how to withdraw), tied to `form`.

## 3. Microinteractions today

**Strong:**
- One motion resolver for every component (`core/component.js`, `componentMotion`): still under reduced motion, state changes only in quiet, ambient or full above. Reduced motion is honoured centrally, not per component.
- A synthesised sound vocabulary (tick, confirm, complete, gentle error) behind one site-wide `sound-switch`, and haptic patterns paired to it (`sound/haptics.js`).
- Feedback pieces exist: toast (polite and alert regions, never takes focus), stamp, progress, loader, skeleton, connecting, the saving footer, field-note.
- Cross-document View Transitions (`transitions`) and the tala stagger (`talaDelay`, `--sg-tala-beat`).

**Thin** (counts are over the 48 component folders, source files only):

| Pattern | Coverage | Gap |
|---|---|---|
| A press state (`:active`) | 2/48 (button, wa-order) | Check, toggle, radio, tabs, select and the cards don't answer a press. A quiet press could be a 1 px settle, a warm one a pencil shading darker, a playful one a small give. |
| Sound | 5/48 (date-range, form, sound-switch, stamp, toast) | Confirm and complete don't fire on toggle, check, stepper or a submitted order. |
| Haptics | patterns exist, wired only through `play()` | On a phone in Goa, a light tick on a stepper press or a slot choice is the most felt microinteraction we have, and it's barely used. |
| Tala stagger | 2/48 | Lists that arrive (menu, event-list, gallery, data-table rows) could stagger by the cycle. |
| Entry animation (`@starting-style`) | 2/48 | Popovers, toasts and the drawer could enter with CSS alone. |
| Live announcement | 15/48 | Fine for statics, but steppers, slot pickers and carts will need announced totals ("3 people, ₹4,500"). |
| A shared success moment | none | Each flow ends its own way. A finished booking, order or payment should end in one recognisable moment: stamp + confirm sound + haptic + a line of text, in every register. |
| Undo | none | Toast has no action. "Removed from your order. Undo" is the friendliest pattern for a cart. |

**Missing as a check:** none of the above is linted. The lighter gate's style suggests a microinteraction check: every interactive component has a press state, a focus-visible style and a reduced-motion still, and every flow's last step uses the shared success moment.

## 4. Goals that mix

Each goal pairs one or two verticals with the foundations they need, and sweeps the microinteractions of every piece it touches, so no goal is only foundations or only polish.

**A. Pay and confirm.** UPI pay (intent link, QR, reference, "I've paid", stamp), the QR primitive, copy feedback generalised out of reach, toast with an undo action, and the shared success moment. Verticals: a homestay deposit and a home baker's pre-order. Sweep: sound and haptics on confirm across form, stamp and toast.

**B. Time and place.** Opening hours, time slots with capacity, guest and quantity stepper, choice cards, directions by landmark, the `en-IN` money and date helpers. Verticals: a dolphin-trip operator and a café's table booking. Sweep: press states on radio, check and toggle; announced totals.

**C. Shop and trust.** Product card with variants, a general cart that ends in wa-order, filter chips over any list, reviews summary, share, rate card. Verticals: an azulejo studio's shop and a scooter rental. Sweep: tala stagger on arriving lists, `@starting-style` entries.

**D. Many tongues, weak signal.** Language switcher with hreflang, announcement banner, the ticket with QR, an offline page and service-worker recipe, the DPDP consent notice. Verticals: a parish feast and a tiatr night (schedule, tickets, Konkani). Sweep: the microinteraction check itself, fail-first, added to `npm run check`.

Already queued work fits alongside: the food branches belong next to C, the templates request (Casa Exemplo, food workshop, `npx susegad create`) can take A to D's verticals as its templates, and agent profiles stays its own goal.

## 5. Notes for whoever runs these

- Native first, as every piece here is: a slot picker is radios, a stepper is `input type=number`, a QR is an image with its text beside it.
- No payment gateway, map embed or third-party script. UPI and maps leave the page by link.
- Honest by the clock means IST and the business's own seasons, and tests that fake the date.
- Motif and copy lints apply: azulejo, kaavi and feast imagery go through the tier lint; no "Book now!" urgency in the copy.
