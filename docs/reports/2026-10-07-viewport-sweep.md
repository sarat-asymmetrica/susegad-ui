# The phone sweep, 7 Oct 2026 (batch/viewport)

The question: with an honest yardstick, what was the old one hiding?

**Yardstick.** `tools/lib/overflow.mjs`, `sidewaysScroll(page, width)`: `documentElement.scrollWidth` minus the width the cell set (or `min(clientWidth, screen.width)` when none is given). Not `innerWidth`: in a Playwright `isMobile` context Chromium widens it to fit overflowing content. `tools/lib/overflow.test.mjs` is the fail-first fixture (a 700 px child on a 390 px phone: old yardstick reads 0, new reads 310; green in chromium, webkit, firefox).

**Sweep.** `node tools/viewport-sweep.mjs` (new): every component, recipe and scene page, every template page, depth-photo and the diagram demo, at 390 px (iPhone-class context: touch, isMobile, dpr 3), in each register, light theme. Chromium 153.0.8010.12, headless. Each cell is measured at rest and by a requestAnimationFrame probe that records the widest `scrollWidth` on any frame from page load on, so a transient is caught as well as a resting overflow. When a cell overflows the tool lists the elements that stick out (not clipped by a scroller of their own, shadow roots included). It also notes failed requests, so an unstyled page cannot pass as a fitting one.

**Result: 321 cells, 321 at 0 px, 0 not measured** (107 pieces x 3 registers). Last run after all fixes below; rows in `.shots/viewport-sweep/rows.json`.

What the instrument did find along the way:

| piece | cell | overflow | element | verdict |
|---|---|---|---|---|
| template event, repo source page (`packages/templates/event/index.html`) | all 3 registers, 390 | 654 px | `sg-lazy` (right edge at 1044) | not a bug in the template: the source page links `susegad/core/lazy.css`, a path that exists only after `susegad create` copies the library beside it, so in the repo the poster has no stylesheet and keeps its attribute size. The sweep now scaffolds the site with `susegad create` and sweeps the pages a visitor meets (en-IN, gom-Deva, gom-Latn): 9 cells, 0 px. |
| food-order recipe, end of the order journey | playful, 390 | 27 px (page scrollWidth 417) | `p.sg-wa-written`, box from -26 to 416 px | **real**, fixed: wa-order's playful "written" line stamps in with `scale(1.22) rotate(-3deg)`; on a full-width line that reaches 442 px wide for about 320 ms. A phone widens its layout and keeps it widened (innerWidth read 417 for the rest of the visit). Nothing at rest shows it, and the old end-of-journey read (`scrollWidth - innerWidth`) was 0 by construction. |
| voice-note, storybook-spread | all | 0 | | two aborted `.wav` preloads reported by the log; media, not styling; ignored. |

Pages with no `width=device-width` meta: none in the sweep (`metaViewport` is recorded per cell).

## Not covered

- 320 px, and dark theme, are not swept (the converted checks cover 320 for stamp, postcard, reach, qr, speakers).
- A transient that needs a press or a state the page does not start in (the Send stamp was one) is only seen by that piece's own check; the wa-order check now samples `scrollWidth` every frame around Send.
- Docs-site pages are checked by `apps/docs/check.mjs` and `site.check.mjs` (sample pages), not by this sweep.

## Table (overflow px per register)

| kind | piece | quiet | warm | playful |
|---|---|---|---|---|
| component | accordion | 0 | 0 | 0 |
| component | action-menu | 0 | 0 | 0 |
| component | badge | 0 | 0 | 0 |
| component | bloom | 0 | 0 | 0 |
| component | button | 0 | 0 | 0 |
| component | chat-thread | 0 | 0 | 0 |
| component | check | 0 | 0 | 0 |
| component | combobox | 0 | 0 | 0 |
| component | connecting | 0 | 0 | 0 |
| component | data-table | 0 | 0 | 0 |
| component | date-range | 0 | 0 | 0 |
| component | dialog | 0 | 0 | 0 |
| component | doodle | 0 | 0 | 0 |
| component | drawer | 0 | 0 | 0 |
| component | empty | 0 | 0 | 0 |
| component | event-card | 0 | 0 | 0 |
| component | event-list | 0 | 0 | 0 |
| component | field | 0 | 0 | 0 |
| component | field-note | 0 | 0 | 0 |
| component | file-drop | 0 | 0 | 0 |
| component | form | 0 | 0 | 0 |
| component | gallery | 0 | 0 | 0 |
| component | lang | 0 | 0 | 0 |
| component | link | 0 | 0 | 0 |
| component | loader | 0 | 0 | 0 |
| component | menu | 0 | 0 | 0 |
| component | now-note | 0 | 0 | 0 |
| component | otp | 0 | 0 | 0 |
| component | person-card | 0 | 0 | 0 |
| component | popover | 0 | 0 | 0 |
| component | postcard | 0 | 0 | 0 |
| component | progress | 0 | 0 | 0 |
| component | qr | 0 | 0 | 0 |
| component | quote | 0 | 0 | 0 |
| component | radio | 0 | 0 | 0 |
| component | reach | 0 | 0 | 0 |
| component | scroll-section | 0 | 0 | 0 |
| component | select | 0 | 0 | 0 |
| component | signature | 0 | 0 | 0 |
| component | site-footer | 0 | 0 | 0 |
| component | site-nav | 0 | 0 | 0 |
| component | skeleton | 0 | 0 | 0 |
| component | sound-switch | 0 | 0 | 0 |
| component | stamp | 0 | 0 | 0 |
| component | stepper | 0 | 0 | 0 |
| component | tabs | 0 | 0 | 0 |
| component | tile-band | 0 | 0 | 0 |
| component | toast | 0 | 0 | 0 |
| component | toggle | 0 | 0 | 0 |
| component | tooltip | 0 | 0 | 0 |
| component | tumble | 0 | 0 | 0 |
| component | voice-note | 0 | 0 | 0 |
| component | wa-order | 0 | 0 | 0 |
| recipe | agenda | 0 | 0 | 0 |
| recipe | booking | 0 | 0 | 0 |
| recipe | enquiry | 0 | 0 | 0 |
| recipe | file-upload | 0 | 0 | 0 |
| recipe | food-order | 0 | 0 | 0 |
| recipe | greeting-card | 0 | 0 | 0 |
| recipe | member-directory | 0 | 0 | 0 |
| recipe | proposal | 0 | 0 | 0 |
| recipe | room-details | 0 | 0 | 0 |
| recipe | saving-footer | 0 | 0 | 0 |
| recipe | site-shell | 0 | 0 | 0 |
| recipe | speakers | 0 | 0 | 0 |
| recipe | storybook-spread | 0 | 0 | 0 |
| recipe | studio-home | 0 | 0 | 0 |
| recipe | venue | 0 | 0 | 0 |
| scene | abri | 0 | 0 | 0 |
| scene | chai | 0 | 0 | 0 |
| scene | chiro | 0 | 0 | 0 |
| scene | dar | 0 | 0 | 0 |
| scene | ferry | 0 | 0 | 0 |
| scene | ghat | 0 | 0 | 0 |
| scene | kairi | 0 | 0 | 0 |
| scene | kantar | 0 | 0 | 0 |
| scene | khazan | 0 | 0 | 0 |
| scene | kolam | 0 | 0 | 0 |
| scene | mankurad | 0 | 0 | 0 |
| scene | maun | 0 | 0 | 0 |
| scene | mithagar | 0 | 0 | 0 |
| scene | mosaico | 0 | 0 | 0 |
| scene | neel | 0 | 0 | 0 |
| scene | nod | 0 | 0 | 0 |
| scene | pahat | 0 | 0 | 0 |
| scene | paus | 0 | 0 | 0 |
| scene | posta | 0 | 0 | 0 |
| scene | prahar | 0 | 0 | 0 |
| scene | rampon | 0 | 0 | 0 |
| scene | saanj | 0 | 0 | 0 |
| scene | shet | 0 | 0 | 0 |
| scene | taverna | 0 | 0 | 0 |
| scene | themb | 0 | 0 | 0 |
| scene | tinto | 0 | 0 | 0 |
| scene | tollem | 0 | 0 | 0 |
| scene | toran | 0 | 0 | 0 |
| scene | vaati | 0 | 0 | 0 |
| scene | vad | 0 | 0 | 0 |
| scene | vahi | 0 | 0 | 0 |
| scene | vel | 0 | 0 | 0 |
| scene | veranda | 0 | 0 | 0 |
| template | community-square | 0 | 0 | 0 |
| stage3d | depth-photo | 0 | 0 | 0 |
| folio | diagram | 0 | 0 | 0 |
| template* | event (en-IN) | 0 | 0 | 0 |
| template* | event (gom-Deva) | 0 | 0 | 0 |
| template* | event (gom-Latn) | 0 | 0 | 0 |
