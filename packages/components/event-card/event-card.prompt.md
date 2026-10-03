# Event card

*One workshop, class, supper club or pop-up: a pasta class at a partner kitchen, a chef's supper, a market-day pop-up, a yoga morning, a studio open day.*

The kind, the title, when and where, what you'll do and eat, the price per person and a way to book. It knows what time it is, so it says whether the event is coming up, today, on now or over, and it stops offering a booking link for something that has finished.

```html
<link rel="stylesheet" href="susegad/components/event-card/event-card.css">
<script type="module" src="susegad/components/event-card/event-card.js"></script>

<sg-event-card kind="workshop" start="2026-10-04T11:00" end="2026-10-04T13:00" seats-left="4">
  <article aria-labelledby="ev1">
    <p class="sg-event-kind">Workshop</p>
    <h3 id="ev1">Handmade pasta, from the dough up</h3>
    <p class="sg-event-when"><time datetime="2026-10-04T11:00:00+05:30">Sun 4 Oct, 11 am to 1 pm</time></p>
    <p class="sg-event-where"><span class="sg-event-venue">A kitchen studio</span>, <span class="sg-event-area">Aldona</span> <a href="https://maps.example/…">Map</a></p>
    <section class="sg-event-do"><h4>What you'll do</h4><ul><li>Mix and knead a dough by hand</li></ul></section>
    <section class="sg-event-eat"><h4>What you'll eat</h4><ul><li>Your own pasta, with a seasonal sauce</li></ul></section>
    <footer class="sg-event-stub">
      <p class="sg-event-price"><span class="sg-event-amount">₹2,000</span> per person</p>
      <p class="sg-event-cta"><a href="https://wa.me/919800000000?text=…">Save my seat</a></p>
    </footer>
  </article>
</sg-event-card>
```

## The prompt

Make an event card web component around an `<article>`: a small kind label (workshop, supper club, pop-up or class), the title as a heading, the date with its weekday in a `<time datetime>` and the time as a range ("Sun 4 Oct, 11 am to 1 pm"), the venue's name and area with an optional map link, a "what you'll do" list and a "what you'll eat" list, the price per person, and a call to action that is a plain link in a slot (it will usually open WhatsApp; take the link from the markup and never build it in the component). With JavaScript, read the clock in the venue's own time zone (Asia/Kolkata unless a `timezone` is given) and say in words which of four things is true: how far off it is ("In 2 days", "Tomorrow"), today ("Today at 11 am"), on now ("On now, until 1 pm"), or over ("This one has happened. Booking is closed."). Move on by itself when the clock passes the start or the end, using one timer that runs only while the card is on screen and catches up when it is seen again. Show a seats line ("4 seats left") only when a `seats-left` number is given, and call the event sold out only when `seats-left` is 0, then swap the booking link for an alternative if there is one. Hide the booking link on a finished event and show no seats line. Give it three registers. Quiet: a ruled card, the foot ruled off, the booking link an outline. Warm: a ticket, with a notch cut at each end of a perforated tear line (the holes drawn in code, each a little different, from a seed), the stub a tinted column at the right when there is room and a strip along the foot when there is not, set on at a small seeded lean. Playful: the same ticket in the hand, the kind label a hand-lettered pill, and the stub tears a little when the pointer or the keyboard focus is on the card: it lifts at its free corner and settles there with a spring, once, nothing loops. Under reduced motion nothing moves.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| the venue's own time zone | pure core | `parseWhen(text, zone)` reads "2026-10-04T11:00" as wall-clock time in the zone (an offset or Z in the text wins); `wall()` and `zoneOffset()` use `Intl` so no library is needed and summer-time zones work. |
| coming up, today, on now, over | `eventPhase(now, start, end, zone)` | The start is inclusive and the end is not. Days are the venue's calendar days, so 00:30 in Goa is already "today" for an event that day, though it is still the evening before in UTC. With no end an event is "today" until its day is over and never claims to be on now. |
| in words | `describeEvent()` | `awayInWords` (Tomorrow, In 5 days, In 3 weeks, then the date), `clock` ("11 am", "6:30 pm", "12 noon"), `formatWhen` ("Sun 4 Oct, 11 am to 1 pm", across midnight "Sat 3 Oct, 8 pm to Sun 4 Oct, 1 am"). |
| only when a number is given | `seatsOf(raw)` | Only a whole number of 0 or more counts. "lots", "", a missing attribute and "-2" are unknown, and an unknown number says nothing. Sold out is `seats-left="0"` and nothing else. |
| finished events stop offering booking | honesty | `showCta` is false once over or sold out; the element hides `.sg-event-cta`, shows `[data-when="sold-out"]` alternatives when sold out, and removes the seats line from a finished event. |
| moves on by itself | one timer | `nextChange()` gives the next boundary (midnight, start, end); `setTimeout` runs only while the card is visible (the shared IntersectionObserver) and the card refreshes the moment it is seen again. Inside an `<sg-event-list>` the list keeps the clock instead. |
| a notch at each end of a perforated tear line | warm skin | CSS masks cut two circles where the tear meets the edge; the skin measures where the stub starts (a column or a strip), tells the CSS, and draws the holes along it with `perforation(length, seed)`. |
| a small seeded lean | `lean(seed)` | 0.2 to 0.7 degrees, set once as `--sg-event-lean`. |
| the stub tears a little ... settles | CSS only | On `:hover` or `:focus-within` the stub gets a short `translate` and `rotate` about its free corner with the spring ease; reduced motion keeps it flat. No loops, no timers. |
| a call to action ... take the link from the markup | slot | The element never writes a link. It only shows or hides the `<a>` you put in `.sg-event-cta`. |

## Accessibility

- An `<article>` named by its heading; the date is a real `<time datetime>` with the offset.
- The state is words ("On now, until 1 pm", "Sold out"), with a shape (ring, half, dot, dash) as well; never colour alone.
- The booking link is an ordinary link: it takes Tab, shows a 2 px focus ring, and leaves the tab order when the event is over.
- The perforation is drawn in an `aria-hidden` SVG; the tear is decoration.
- Without JavaScript the markup you wrote shows in full: kind, title, date, venue, lists, price and link.
