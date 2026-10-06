# Member directory (recipe)

A list of `<sg-person-card>`s, filtered live by a text field and by track, with
the filter state in the address so a filtered view is shareable, and a kind
empty state.

## Mount it

```html
<link rel="stylesheet" href="susegad/components/field/field.css">
<link rel="stylesheet" href="susegad/components/check/check.css">
<link rel="stylesheet" href="susegad/components/person-card/person-card.css">
<link rel="stylesheet" href="susegad/recipes/member-directory/recipe.css">

<div class="sg-directory" id="directory">
  <form class="sg-directory-filters" action="./">
    <sg-field>
      <label for="q">Search the members</label>
      <input id="q" name="q" type="search" autocomplete="off">
    </sg-field>
    <fieldset class="sg-directory-tracks">
      <legend>Track</legend>
      <!-- one sg-check per track; the value is the track's own name -->
      <sg-check><label><input type="checkbox" name="track" value="AI for Kids"> AI for Kids</label></sg-check>
    </fieldset>
  </form>
  <p class="sg-directory-count" role="status">Showing 7 members</p>
  <ul class="sg-directory-list">
    <li><sg-person-card data-track="AI for Kids">…</sg-person-card></li>
  </ul>
  <div class="sg-directory-empty" hidden>
    <p>No one matches that yet. Try a shorter word, or a different track.</p>
  </div>
  <p class="sg-directory-share" hidden>This filtered view is in the address; copy it and anyone opening it sees the same members.</p>
</div>

<script type="module">
  import { mountDirectory } from 'susegad/recipes/member-directory/recipe.js';
  await Promise.all(['sg-field', 'sg-check', 'sg-person-card'].map(t => customElements.whenDefined(t)));
  mountDirectory(document.getElementById('directory'));
</script>
```

## How it behaves

- **The text field** matches any word against the name, the role and the
  building line of each card. Two words must both match. Accents are folded,
  so "fernandés" finds "Fernandes".
- **The track checkboxes** narrow to the tracks that are ticked; none ticked
  means every track. The card declares its own track with `data-track`.
- **Both together** narrow further. The list below updates as you type.
- **The address carries the filter**: `?q=aldona&track=AI%20for%20Kids` is a
  complete, shareable view. It is written with `history.replaceState`, so the
  back button still works, and it is read back on load into the controls.
- **The empty state** is the page's own words, not a blank list: "No one
  matches that yet. Try a shorter word, or a different track."
- **The count** is a `role="status"` region, so a screen reader hears each
  change once.

## Without JavaScript

The full list shows, unfiltered, and every card reads fine (name, role, work,
link). The filters still render but do nothing, and a note inside the form says
so plainly. Nothing breaks.

## Own the words

The count ("Showing 7 members") and the empty state are written by the recipe's
`STRINGS` in `recipe.js`. Change them there, and keep them kind.
