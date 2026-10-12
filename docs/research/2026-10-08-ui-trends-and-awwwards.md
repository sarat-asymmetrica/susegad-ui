# UI/UX trends and the 2026 Awwwards scene, mapped to Susegad

*Sutradhar for the owner, 8 October 2026. Reads the 2026 award cycle and the
broader trend chatter, extracts the reusable mechanics, and marks where the
trend is walking toward Susegad rather than away from it. Companion to
`2026-10-08-pretext-ecosystem.md` (Pretext) and `2026-10-08-bake-and-reflow.md`
(the generalised pattern).*

## TL;DR

The 2026 award world converged on **immersive 3D + scroll-driven narrative** —
61% of Q1 Site-of-the-Day winners are 3D, up from 23% in 2024. But the *second*
half of the signal is the important one for this library: the correction is
**restraint and accessibility**. Winners now respect `prefers-reduced-motion`,
mobile Lighthouse 90+ is visible in winning entries, and the writeups are
explicit that generic particles and effect-mixing *lose*. That is Susegad's
thesis — beautiful *and* comfortable, with a reduced-motion still and a static
fallback — already shipped, and the awards are walking toward it.

## The winning formula (what actually wins)

> Scroll-driven narrative arc → camera spline / scene transitions → each scroll
> checkpoint reveals content, fires particles, or rotates to expose hidden
> geometry. Stack: Three.js + GSAP ScrollTrigger + custom post-processing.

Parallel numbers: of 47 Q1 SOTD winners, 29 used Three.js, 8 raw WebGL, 4
Babylon, 6 shipped with no WebGL (editorial/typographic, scoring on content).
~97% browser WebGL 2.0 support means 3D is now baseline, not a stretch ambition.

## The 13 named mechanics (component-level, from a winners sweep)

A component-level read of 14 case pages (coroboros/research) yields 13 mechanics,
each mapped below to a Susegad package. The best-evidenced, highest-novelty ones
are starred. Reliability legend: TAG/LABEL = from Awwwards; `(inferred)` =
extrapolated.

| # | Mechanic | Site(s) | Susegad home |
|---|---|---|---|
| 1 | Real-time interactive 3D product model (drag/scroll inspect) | GQ&AP, Floema, Oryzo | `stage3d` + `sg-scene` |
| 2 | Scroll-scrubbed real-time scene (live render, not video) | GQ&AP, Oryzo, Vectr | `engine` + `scenes` |
| 3★ | 3D→2D→3D dimensional morph transition | Oryzo | "one layout, two painters" (rung 5) |
| 4 | Cursor-reactive particle field | Oryzo | `engine` particles |
| 5 | Curtains.js DOM→WebGL plane distortion | Indigo | the *light* WebGL tier |
| 6★ | Per-chapter Web Audio scenes (crossfading ambient stems) | Indigo, 21hrs, GQ&AP | `sound` + `narration` |
| 7 | Draggable/zoomable spatial map + hotspot annotations | 21hrs | `veranda`/`toran` + `map-labels` |
| 8 | Playable in-page WebGL mini-game | Lacoste | most-playful register |
| 9★ | Scroll-driven Rive state-machine along a path | MindMarket | `walk`/`rasta` (needs native answer) |
| 10★ | Sticky stacked cards (pin + scale pile) | MindMarket | `scroll-section` + `postcard` |
| 11★ | Multi-plane parallax diorama + hidden-layer reveal | Renaissance | `khazan`/`ghat` scenes |
| 12 | Infinite draggable WebGL image gallery | Julien Calot | `gallery` + `tumble` |
| 13 | Playful character hover (spring/squash) | MindMarket | `doodle` + mascot physics |

Two dependencies the corpus needs that the rest of the stack doesn't: **Rive**
(the state-machine path-scroll) and **Curtains.js** (the DOM→WebGL ≈ light
plane). Both small and drop-in — but Rive is the one to think hardest about,
because Susegad already has the sketch engine and a path grammar, so a native
answer may beat a dependency.

## The code-drawn-scenes thread (the part that is squarely Susegad's)

- **"Generative painted scenes" is now an awardable mechanic.** The Renaissance
  Edition (a *Shopify* build) is described literally as "generative paintings
  with elements of modern commerce." The scene *is* the interface. Susegad's 19
  plates are ahead of this curve.
- **The anti-AI-stock backlash is a tailwind.** KOTA/ZarmaType's 2026 read:
  *grain, noise, scuffed edges, hand-drawn type, visible assembly — "a human made
  this on purpose."* MindMarket (Site of the Month) brands itself "no stock, no
  AI visuals," a hand-drawn system.
- **Typography is the most AI-resistant surface.** The sharpest line, from the
  trend reads: *"typography is the most resistant element to generic AI output...
  a genuinely distinctive type treatment still requires taste and intent."*
  Kinetic typography — text moving, morphing, reacting — is now a primary
  interface element, not decoration. This lands on Pretext + the sketch engine.

Combined, those three point at exactly where Susegad already stands:
**kinetic, hand-drawn, procedural scenes with text as a first-class surface.**

## The honest filter (your buyer is not the Awwwards buyer)

Svilenković (who builds these for a living) is the useful cold water:

- **Reject:** NFT-aligned 3D, metaverse-themed sites, "AI-generated 3D website"
  tools ("great for prototypes, brittle for production").
- **Award-theatre:** 60lbs of custom GLSL for a landing page a tier-2 shop opens
  once on a ₹15k Android.
- **Steal / keep:** portfolio differentiation, product configurators, virtual
  showrooms, scrollytelling "about us" — the *boring* uses that actually convert.

Rule to write into any goal: **steal the mechanics, reject the spectacle-cost.**
A `khazan` diorama that still ships an `sg-scene` still on a weak phone and a
reduced-motion flat layer is better than any Awwwards winner, because it survives
the conditions the award world ignores.

## Three north-star experiences (recon-sharpened)

1. **`sg-story-scroll`** — mechanics #11 + #2 + #6 combined: a depth diorama that
   scrolls through a scene, captions in the z-gaps, ambient sound per chapter,
   collapsing to a perfect flat experience on a weak phone. Floema/Renaissance
   quality with Susegad's degradation on top.
2. **`sg-morph-hero`** — mechanic #3, the single most novel of the 2026 corpus: a
   product/logo arrives as a live 3D scene, *flattens* into the 2D editorial
   layout, re-inflates on scroll. Literally "one layout, two painters" wearing a
   transition.
3. **`sg-walk`** — mechanic #9's *native* answer: a `doodle` character advances
   along a `rasta` path as you scroll, using the sketch engine and the path
   grammar instead of a Rive dependency.

## Caveats on the sources

- X threw a login wall (redirect to onboarding) — live developer chatter there
  was not captured; the browser route requires a logged-in session.
- The mechanics sweep's own caveat stands: nobody drove the live SPAs; every
  mechanic rests on Awwwards tags + author descriptions, not observed behaviour.

## Source index

Read directly:

- Coroboros "Awwwards 2026 Winners — Mechanics Sweep" (the 13 mechanics) —
  https://github.com/coroboros/research/blob/main/articles/award-winning-websites-2025-2030/winners/awwwards-2026-winners.md
- Svilenković "Awwwards 2026 3D — What's Winning SOTD" (restraint + reject list) —
  https://svilenkovic.com/3d/awwwards-2026-3d
- digitalstrategyforce "Why immersive experiences dominate 2026 Awwwards" —
  https://digitalstrategyforce.com/journal/why-are-immersive-experiences-dominating-the-2026-awwwards/
- pixelwall "Web Design Trends 2026" (Liquid Glass, generative video) —
  https://www.pixelwall.ca/news/immersive-web-design-2026-threejs-gsap-and-the-rise-of-cinematic-web/
- freezygig "State of Web Design Innovation 2026" (GenUI, kinetic type) —
  https://www.freezygig.com/2026/01/the-state-of-web-design-innovation-2026.html
- designrush "16 Website Design Trends 2026" (neobrutalism, kinetic type) —
  https://www.designrush.com/agency/website-design-development/trends/web-design-trends
- KOTA "Branding trends 2026" (tactility, human-made-on-purpose) —
  https://kota.co.uk/blog/branding-inspiration-brand-design-trends-for-2026
- studiomeyer "Web Design Trends 2026" — https://studiomeyer.io/en/blog/webdesign-trends-2026
- Midrocket "UI Design Trends 2026" — https://midrocket.com/en/guides/ui-design-trends-2026/