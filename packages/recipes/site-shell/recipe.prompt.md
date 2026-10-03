# Site shell

*A header with tabs and a menu, a dialog, a drawer, a scene that moves with scroll, and a curtain between two steps of booking a stay, all on one page, none of them in each other's way.*

## The prompt

Build a homestay's site shell that proves a library's navigation and overlay pieces genuinely work together, not just alone. Put a tabbed navigation and an account menu in the header; give the tabs three sections in the page body (an overview, the rooms, booking), connected by id rather than nested inside the tablist, since that is how a real site's header and content are actually laid out. From the overview, open a dialog asking the house a question; from the rooms section, open a drawer listing every room; both openers are real links to a real fallback page, so nothing is unreachable without JavaScript. Put a scene behind a "come for the rain" heading, inside a section whose scroll drives the scene's own progress, never a timer. Give the booking section a two-step flow, dates then held, with a curtain interlude between the two steps timed by a small simulated hold, never a fixed length. Add no new theatre of your own: every one of these is a part the library already ships, used exactly as its own docs describe. Prove the composition with a check that clicks and scrolls through every one of these paths in a real browser, not just at rest.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| connected by id rather than nested inside the tablist | reuse | `tabs.js` already looks inside itself first, then falls back to `document.getElementById` for a linked panel — this recipe is the first place that fallback path is actually exercised, proving it rather than assuming it. |
| real links to a real fallback page | native first | `data-sg-dialog`/`data-sg-drawer` openers keep their own `href="./no-js.html"`; Dialog and Drawer both already treat the attribute as optional theatre and the link as the truth. |
| a curtain interlude … timed by a small simulated hold, never a fixed length | reuse, honesty | `recipe.js`'s only real wiring: `runKantar(stage, { work: new Promise(r => setTimeout(r, holdMs)), swap: () => showStep2(stage), … })`. The "work" is a stand-in for a real request (a seeded delay, per the charter's "the screen never runs ahead of the transport"), never resolved before the time it stands for would really have passed. |
| add no new theatre of your own | composition discipline | `recipe.js` imports every component module (which self-register their custom elements) and writes exactly one small function, `mountSiteShell()`, whose only job is the one thing static markup cannot do: start the Kantar interlude on a click and swap the booking step when it resolves. Everything else — Tabs switching, Menu's keyboard model, Dialog and Drawer's focus trap, the scroll section's progress — needs no glue at all. |
| prove the composition with a check … not just at rest | evidence | `recipe.check.mjs` clicks through every tab, opens and closes the menu with the keyboard, opens and closes both Dialog and Drawer (checking the focus trap and the return of focus), scrolls the page to move the scroll section's progress and checks the child scene receives the same number, and runs the booking flow's Kantar interlude end to end, watching for the curtain covering the stage mid-wait and step 2 landing once it rises. 37 checks, warm and playful, plus a quiet run and a no-JavaScript run. |

## Accessibility

Nothing here is new: every check above is really re-verifying each component's own accessibility contract still holds once the pieces sit on one page together (a live region doesn't get stolen by another component's own live region, a focus trap doesn't leak into a hidden tab panel, a keyboard model doesn't conflict with another's). 0 axe violations across quiet/warm/playful × light/dark confirms it.

## Credit

Not a harvested plate. Casa Aldona is this repo's recurring fictional homestay (used across the SKILL doc's own examples); nothing about it is a real property.
