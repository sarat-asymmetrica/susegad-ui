# Speakers (recipe)

A grid of `<sg-person-card>`s for an event's speakers, built after
the `member-directory` recipe. Each card gives a name, a
role and organisation, one line on the talk, and the **talk's title as a link to
its slot in the `agenda` recipe**. An optional row of track
checkboxes narrows the grid, and the choice lives in the address.

The speakers, organisations and talks in `index.html` are **sample content**:
invented for the demo, with made-up people. Replace them with your own, and only
list a person who has said yes.

## Mount it

```html
<link rel="stylesheet" href="susegad/components/check/check.css">
<link rel="stylesheet" href="susegad/components/person-card/person-card.css">
<link rel="stylesheet" href="susegad/components/bloom/bloom.css">
<link rel="stylesheet" href="susegad/recipes/speakers/recipe.css">

<section class="sg-speakers" id="speakers" aria-labelledby="speakers-h">
  <h2 id="speakers-h">Speakers</h2>

  <!-- optional: delete this form and the grid is just a grid -->
  <form class="sg-speakers-tracks-form">
    <fieldset class="sg-speakers-tracks">
      <legend>Track</legend>
      <div class="sg-speakers-tracks-row">
        <sg-check><label><input type="checkbox" name="track" value="AI for Kids"> AI for Kids</label></sg-check>
      </div>
    </fieldset>
  </form>
  <p class="sg-speakers-count" role="status">Showing 7 speakers</p>

  <ul class="sg-speakers-list">
    <li><sg-person-card data-track="AI for Kids">
      <article aria-labelledby="sp1">
        <h3 id="sp1">Priyanka Naik</h3>
        <p class="sg-person-role">Teacher, Aldona Learning Circle</p>
        <p class="sg-person-building">Reads Konkani picture books aloud and waits for the child to answer.</p>
        <!-- the talk title, linked to its slot: the id of the agenda's <li class="sg-session"> -->
        <p class="sg-person-link"><a href="#storybook-reader">A storybook that reads aloud, in Konkani</a></p>
      </article>
    </sg-person-card></li>
  </ul>

  <div class="sg-speakers-empty" hidden><p>No speaker is on that track yet. Try another track, or clear them all.</p></div>
</section>

<script type="module">
  import { mountSpeakers } from 'susegad/recipes/speakers/recipe.js';
  await Promise.all(['sg-check', 'sg-person-card', 'sg-bloom'].map(t => customElements.whenDefined(t)));
  mountSpeakers(document.getElementById('speakers'));
</script>
```

On a one-page event site the agenda and the speakers share the page, so the
link is just `#storybook-reader`. The demo keeps them on two pages
(`../agenda/index.html#storybook-reader`), which is why this recipe lists
`agenda` as a dependency: the links should land somewhere.

## How it behaves

- **The track checkboxes** narrow to the tracks that are ticked; none ticked
  means every speaker. The card declares its track with `data-track`, as in the
  member directory.
- **The address carries the choice**: `?track=AI%20for%20Kids,Tech%20for%20Good`
  is a complete, shareable view, written with `history.replaceState` and read
  back on load. Only `?track` is touched: `?register`, `?lang`, `?utm_*` and the
  `#hash` stay (`urlWithTracks()`).
- **The count** is a `role="status"` region (someone just ticked a box, so
  hearing the new count once is the right amount of talk); the empty state is
  the page's own kind words.
- **Without JavaScript** every speaker shows, the talk links work, and a note
  says the filter does nothing.

## No photo: a bloom

A speaker without a photo gets a small marigold, `<sg-bloom kind="zendu" seed-from="Priyanka Naik">`, in the person-card's round disc. It is grown from the name, so the same speaker always gets the same flower and two speakers get different ones. It is decoration: the bloom has no label and no words, so it is hidden from assistive technology, and the disc around it is `aria-hidden` anyway; the name is already the card's text. In quiet it is single-ink dots, in warm the marigold's own colours, in playful the same flower, which grows when first seen (and not under reduced motion).

A photo goes in only when the person gave it and their consent is recorded: write an `img.sg-person-photo` into their card (as the person-card docs say) and the disc, bloom and all, steps aside.

With JavaScript off there is no disc at all (the person-card draws it), so the card is the name, the role, the talk line and the link, which is all the page needs.

To change the drawing, pass the hook:

```js
mountSpeakers(root, { avatar: (card, { name, seed }) => someDrawnNode }) // your own
mountSpeakers(root, { avatar: null })                                     // initials everywhere
```

It is called once per card; a returned node goes in the disc in place of the letters, and returning `null` keeps this card's initials. Add `bloom.css` beside `person-card.css`.

## Registers

The three registers come from the person-card (quiet: a hairline card and a
plain disc; warm: a soft card, initials in the hand; playful: a colour disc and
a small seeded tilt). The recipe only lays the cards in a grid (one column on a
phone, as many as fit above) and gives the talk link a 44 px tall target.

## Own the words, and the language

The count and the empty line are in `recipe.strings.js`, by language (decision 0025). They follow the nearest `lang`. A language whose table lacks a key shows the English and marks that text `lang="en"`, so a screen reader reads it in English's voice. The Konkani tables (`gom-Deva`, `gom-Latn`) are empty, for a Kathakar to write and a native reader to check. Leave `.sg-speakers-empty > p` blank and the recipe writes its line in the page's language. The speakers' own words (names, roles, talk titles, tracks) are yours, in your language. (`?lang=gom-Deva` on the demo page pretends the page is in Konkani.)
