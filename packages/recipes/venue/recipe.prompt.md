# Venue (recipe)

Make a venue recipe for an event page in Panjim, "a map page in small" with no map. Show the venue's name and address, then landmark directions in plain spoken words ("Behind the Old Secretariat, facing the river. Walk through the yellow gate with the blue tiles; the hall's door is the second on your left."), then two links out to the phone's maps app: a `geo:` link (with the name in the query, brackets encoded, so the pin is labelled) as "Open in your maps app" on Android, and a plain web link as "Open in a web map" everywhere. On an iPhone or iPad the app link is an Apple Maps link instead, because Safari does not open `geo:`; on any other device the app link is hidden, because a `geo:` link may open nothing there. Both are real links, underlined, in a box at least 44 px tall, with a press answer in each register and a focus ring. No embedded map, no iframe, no third-party script, nothing fetched. Then a short "Getting there" list (bus, ferry, car), and an "Access" list of fields the author fills (step-free entrance, lift, accessible toilet, quiet space): a row whose answer is empty (or only white space, with JavaScript) is not shown, and when every row is empty the whole Access section is not shown, by CSS alone. Optionally, a small drawn locator beside the words: an inline SVG sketch (river, road, a landmark, the hall with a pin, the bus stop and a dashed walking route from it to the hall, no fill on the route), decoration only (`aria-hidden`), with every fact also in the words. Three registers: quiet (hairline, square, no fills), warm (soft fills, rounded), playful (pill links in the hand, bolder strokes). The coordinates are written once as `data-lat`, `data-lng`, `data-name` and `mountVenue()` fills the links from them; the hrefs written in the page stay as the no-JavaScript truth. Without JavaScript everything reads. The hall and event are invented sample content.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a link to the phone's maps app | `geoUri({ lat, lng, name })` | `geo:15.4989,73.8278?q=15.4989,73.8278(Name)`; the app labels the pin. |
| the fallback | `mapsUrl({ lat, lng })` | a plain `https://www.google.com/maps/search/?api=1&query=…` link. |
| iPhones | `isApple(ua, touchPoints)`, `appleMapsUrl(...)` | Safari does not open `geo:`, so an iPhone or iPad (even one that calls itself a Mac) gets Apple Maps. |
| desktops | `venueLinks(...)` returns `app: null` | no sure maps app: the app link is hidden and the web link stands alone. |
| write the point once | `mountVenue(root)` reads `data-lat`, `data-lng`, `data-name` | sets the `[data-map="app"]` and `[data-map="web"]` hrefs; a bad point leaves the written hrefs alone. |
| a build step | `venueLinks(venue, { ua })` | the same links as data, to write into the page. |
| only what is filled | CSS `:has()` | `dl > div:has(> dd:empty)` is hidden; `.sg-venue-access:not(:has(dd:not(:empty)))` is hidden. |
| a drawn locator, cheaply | inline SVG, classes for each part | colours come from the tokens, so it follows theme and register; `aria-hidden`. |
| a finger-sized link | `min-height: 44px`, `display: inline-flex` | `:active` answers in the same frame, no transition on the way in. |

## Accessibility

- The directions, the address and the transport are text; the drawing is `aria-hidden` and shows nothing the words do not.
- The links are real `<a href>` elements with discernible names, 44 px tall, with a focus ring.
- The Access list is a `dl`; rows with nothing in them are not rendered at all, so a screen reader never meets an empty term.
- Nothing is embedded, so there is no frame to trap focus.
