# 0021: an open keep-away list, and words you can move

*29 September 2026. karigar-glass; accepted by the Sutradhar the same day (merged at `404df6e`, core diff reviewed line by line, gates re-run). Status: accepted.*

## Context

Words over a scene make a world that has to make room for them (`docs/requests/2026-09-28-words-in-the-world.md`). The owner then asked whether the words could be a transparent box you drag around the page, and we noticed what that means: once the words take up space in a world that makes room, where you put them starts to carry meaning (`docs/requests/2026-09-29-glass-and-depth.md`).

Two things in core stood in the way.

- `calm`, the list of rects a renderer keeps motion out of, is only the slotted words' rects. Anything else that needs room (a pane, a badge, a note) has no way to join.
- The rects go stale when the panel moves without resizing. `--sg-reading-place` on the element's style, a class on an ancestor or a stylesheet all move the panel, and the ResizeObserver that triggers `#measure` never fires. The demos set the place before the scene measures to avoid it (ledger, 2026-09-28).

Core has 540 bytes of headroom (28,132 of 28,672 raw), and decision 0004 says behaviour only some scenes need belongs in an opt-in module.

## Decision

1. **The keep-away list is open.** `<sg-scene>` gains:
   - `keepClear(id, rect | null)`: a rect in the scene's logical units (0..W, 0..H) joins the list; the same id replaces it; `null` removes it. Non-finite rects are refused. The scene redraws, also when held still.
   - `get calm`: the merged list (the slotted words' rects, then the keep-clear rects), as a copy. A renderer still receives it as `frame.calm`; with no keep-clear rect, it is the same array core built before, so no scene changes.
2. **The stale-calm bug is fixed in core.** A MutationObserver on the element and every ancestor (through shadow roots) for `style`, `class`, `hidden` and the register, theme and palette attributes, and on the document's head (a `<style>` added or edited), re-measures when the panel's rect has really moved. A first version also checked the panel's place on every drawn frame. It caught a stylesheet-only change too, but it made a scene's second frame use a fresh calm one frame earlier than today's core (a font settling had moved the panel), so a scene without `movable` no longer drew pixel for pixel what main's core draws (26 pixels of Tinto warm, 64 canvas pixels, at 4 s on a frozen clock). It was dropped: the gate that a scene without `movable` is unchanged comes first.
3. **`movable` is opt-in, and is not in core.** `<sg-scene movable>` loads `movable.js` with a dynamic `import()`, and only then. Without the attribute nothing loads and nothing runs, so behaviour is as before, pixel for pixel (checked against main's core). A copy of core without `movable.js` fails safe: no grip, the words stay where the reading layer puts them.
   - **The grip.** A real `<button>` named "Move the words" at the panel's top-right corner. You drag by the grip (Pointer Events with capture, `touch-action: none` on the grip only), so selecting text and scrolling a phone still work. Arrow keys move the words by 3% of the stage's width (9% with Shift), Home puts them back. A polite status line says where they are in plain words, never coordinates ("Words moved to the top right").
   - **Moving is a CSS `transform`** on the panel, clamped inside the stage (14 px in, so the grip that hangs 13 px over the corner stays inside it). Calm is re-measured on each move, at most once a frame, so a scene's people and rain make room live.
   - **The pane is a keep-clear rect, not only its words.** `movable.js` calls `keepClear('glass', rect)` with the whole panel's box on every measure. Tinto's caption cards and walkers are kept out of the padding round the lines too; with only the line boxes clear, a white card beside the words bled into them through the blur (1.7:1 at the top right, before; 7.4:1 the worst pixel, after).
   - **The pause button stays reachable** (WCAG 2.2.2). Where the panel would meet it, it steps below it or aside, whichever is the smaller move that still fits, 22 px clear (the grip's overhang and 8 px); a key press that can move nothing because of it says "as far … as they go".
   - **Off** in quiet, in `stacked` (words below the picture, which is what a phone or 200% text gives), when nothing is slotted, and when there is less than 48 px of room to move in. The words are then flat, as today.
   - **Remembering is the page's job.** The element fires `sg-words-moved` (`detail: { x, y, home }`) and accepts `words-at="x y"`. Both are fractions of the stage's free room for the panel: 0 is flush to the top or left, 1 is flush to the bottom or right, so the same link puts the words in the same place at another width. `wordsAt` returns `{ x, y }`, or `null` at home. Nothing is stored inside core.
   - **Frosted glass.** In warm and playful the panel takes `backdrop-filter: blur()` and a tint of the raised paper, from tokens (`--sg-glass-blur` 14 px and `--sg-glass-tint` 74% in warm, 18 px and 66% in playful, set per register in `packages/tokens/tokens.js`; quiet is 0 px and 100%, an opaque plate). Measured through real screenshot pixels, the words hold 7.4:1 or better against everything under them at both, light and dark; a 20% tint fails. Without `backdrop-filter`, the scrim as today. In forced colours, a plain bordered panel.
4. **Budgets.** Core's budget moves from 28,672 to 31,744 raw bytes for the generic parts above (about 1.6 KB). The movable behaviour is its own registry item, `core-movable`, beside core (as `core-component` is), at 16,384 raw bytes: the element side (grip, pointer capture, keys, status, glass, the pause-button step) plus its pure geometry (`movable.core.js`, tested in Node), counted apart per decision 0010. Core depends on it (the registry follows the dynamic `import()`), so a copy of core carries it, and it costs nothing until `movable` is set.

## Consequences

- The pane in the veranda batch (`B2`) joins the list with `keepClear('pane', rect)`, and reads `wordsAt` and the event, instead of adding a second mechanism.
- A scene that draws its words itself (the type tier, decision 0019) can also `keepClear` for anything that isn't a line box.
- Reversible: remove `movable.js`, its registry item and the `movable` hook, and the words are flat again. The keep-away list and the stale-calm fix stand alone.
- Known limit: a change that moves the panel with no attribute change on the element or an ancestor, no `<style>` change in the head and no resize (a stylesheet's `disabled` flag flipped, or a media query on something other than width, such as the colour scheme) is not seen until something else re-measures.
