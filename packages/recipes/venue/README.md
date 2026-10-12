# Venue (recipe)

Where the event is, in words first. A name and address, landmark directions in
plain speech, two links out to the phone's maps app, how to get there, and what
the place offers by way of access. It is "a map page" in small, without a map:
nothing is embedded, there is no iframe and no third-party script. Visitors
leave for the maps app they already use and trust.

The hall, the address, the directions and the transport notes in `index.html`
are **sample content**: the event and the hall are invented. The coordinates
point at central Panjim; replace them with your venue's.

## Mount it

```html
<link rel="stylesheet" href="susegad/recipes/venue/recipe.css">

<section class="sg-venue" id="venue" aria-labelledby="venue-h"
         data-lat="15.4989" data-lng="73.8278" data-name="Mandovi Riverside Hall">
  <h2 id="venue-h">The venue</h2>

  <p class="sg-venue-name">Mandovi Riverside Hall</p>
  <address class="sg-venue-address">Riverfront Road, Panjim (Panaji), Goa 403001</address>

  <h3>Finding it</h3>
  <p class="sg-venue-landmarks">Behind the Old Secretariat, facing the river. …</p>

  <p class="sg-venue-maps">
    <a class="sg-venue-link" data-map="app" href="geo:15.4989,73.8278?q=15.4989,73.8278(Mandovi%20Riverside%20Hall)">Open in your maps app</a>
    <a class="sg-venue-link sg-venue-link-web" data-map="web" href="https://www.google.com/maps/search/?api=1&amp;query=15.4989,73.8278">Open in a web map</a>
  </p>

  <section class="sg-venue-ways" aria-labelledby="ways-h">
    <h3 id="ways-h">Getting there</h3>
    <ul>
      <li><strong>By bus.</strong> …</li>
      <li><strong>By ferry.</strong> …</li>
      <li><strong>By car.</strong> …</li>
    </ul>
  </section>

  <section class="sg-venue-access" aria-labelledby="access-h">
    <h3 id="access-h">Access</h3>
    <dl>
      <div><dt>Step-free entrance</dt><dd>Yes, through the side gate. No steps.</dd></div>
      <div><dt>Lift</dt><dd></dd></div>  <!-- empty: not shown -->
    </dl>
  </section>
</section>

<script type="module">
  import { mountVenue } from 'susegad/recipes/venue/recipe.js';
  mountVenue(document.getElementById('venue'));
</script>
```

The demo page also has a small drawn locator (an inline SVG beside the words):
the river, the road, a landmark, the hall with a pin, the bus stop (`sg-loc-stop`)
and the walk from it to the hall (`sg-loc-walk`, a dashed line with no fill, drawn over a `sg-loc-walk-halo` in the surface colour so it stays 3:1 against the road; quiet a hairline,
playful dots). The route is a sketch, not a measured path, and the distance lives in the words
("about ten minutes' walk"), so the drawing never implies one the words contradict. Every
class in the locator has a rule in `recipe.css`; a shape you draw with a class of your own needs one
too, or the browser paints it black (the check fails on it). It is decoration (`aria-hidden`), it is optional, and the words say
everything it shows. Delete the `<figure class="sg-venue-locator">` and the page
simply goes one column.

## The words

- **Landmark directions** are the most useful thing on the page. Write them the
  way you would say them to someone on the phone: "Behind the Old Secretariat,
  facing the river. Walk through the yellow gate with the blue tiles; the hall's
  door is the second on your left." Not "Proceed to Gate 2".
- **Getting there** is a short list: bus, ferry, car. Name the stand, the ferry
  landing and the car park, and say how far it is on foot.

## The maps links

You write the coordinates once, as `data-lat`, `data-lng` and `data-name`.
`mountVenue()` fills two links from them:

| Link | Goes to | Why |
|---|---|---|
| "Open in your maps app" (`data-map="app"`) | a `geo:` link on Android, Apple Maps on an iPhone or iPad; hidden anywhere else | opens the phone's own maps app with the pin labelled, only where one is sure to answer |
| "Open in a web map" (`data-map="web"`) | a plain Google Maps link | works on every device, and is the only link on a desktop, where a `geo:` link may open nothing |

The hrefs you write in the HTML stay as the no-JavaScript truth, so with the
script off both links are there (the `geo:` one works on Android and may do
nothing on a desktop, which is why the web link is always beside it). On a build step, call
`venueLinks({ lat, lng, name }, { ua })` from `recipe.js` and write the result
into the page instead. Both links are ordinary links in a 44 px tall box, and
underlined, so they read as links. On a desktop only the web link shows.

**Judged in code, not on devices.** Which device gets which link is decided by
the user-agent text and unit-tested, and the checks click nothing that leaves the
page. It has not been tried on a real Android phone, an iPhone or a Windows
desktop; the owner can try the page on those and see which link opens what.

## Access

Fill only what is true and leave the rest empty. A row with nothing in it is
hidden, and when every row is empty the whole Access section is hidden. With
JavaScript, "nothing" includes white space (an editor's line breaks inside the
`<dd>`). Without it, only a truly empty `<dd></dd>` hides (CSS `:has()`), so
write empty answers as `<dd></dd>` if the page must also work with the script off. So write the template once with all four
rows, and an author with nothing to say about a quiet space simply leaves it
blank. Add rows for what your venue has (a hearing loop, accessible parking).

## Registers

| | Look |
|---|---|
| quiet | outlined links with square corners, a hairline locator with no fills, a hairline dashed route |
| warm | softly filled links with rounded corners, a tinted hall and river on the locator |
| playful | pill links in the hand, bolder strokes on the locator, a dotted route, its labels in the hand |

## The touch contract

The two links are the interactive parts. A press changes them in the same frame
with no transition on the way in: quiet settles 1 px and washes, warm shades the
colour toward the ink, playful gives (scale 0.97) with a colour wash. Under
reduced motion the colour change stays and the movement goes. Focus shows a ring.

## Without JavaScript

Everything reads, and both links work with the hrefs written in the page.
