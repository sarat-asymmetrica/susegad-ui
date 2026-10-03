# Copy standards, the done checklist and the gates

*Reference file for [`SKILL.md`](../SKILL.md), split out in rung 7 of docs/requests/2026-09-28-open-the-door.md so the top file stays short. Content moved verbatim; nothing here is new.*

## 11. Copy standards

Plain, warm, specific, active voice. Sentence case. No marketing adjectives. No em dashes in anything a person reads. Numbers stated plainly. Errors say what happened and how to fix it, and never blame the person. Never announce honesty or transparency; be accurate. The Humane Register Doctrine (in the workspace's `kernel-eval` repo) applies to every word.

| Do | Don't |
|---|---|
| The file did not upload. Check your connection and try again. | An error occurred. |
| No bookings yet. When someone books, they'll appear here with their dates and what they paid. | No data found. |
| Save changes | SAVE CHANGES, or Save Changes |
| 3 of 5 photos uploaded | Uploading... please wait! |
| Our lowest rate, June to September. | Unbeatable monsoon deals, don't miss out! |
| The glass clears as the work completes. | To be transparent, this shows real progress. |
| Your card was declined. Try another card, or call your bank. | Oops! Something went wrong 😢 |

The same moment in each register (a file failed to upload):

- **quiet:** "The file did not upload. Check your connection and try again."
- **warm:** "That one didn't go through. Check your connection and we'll try again."
- **playful:** "Hmm, that file got lost on the way. Check your connection and give it another go."

The higher the stakes (money, errors, deadlines), the calmer the words, whatever the register. Never colder.

## 12. Before you say "done"

Run this list. A check that did not run is written as "not run", never as passed.

- [ ] The register is chosen on purpose, and the piece looks right in quiet, warm and playful, light and dark.
- [ ] Reduced motion shows a finished still, not a blank or a half-drawn frame.
- [ ] Keyboard and screen reader work. Nothing is said only by the drawing: every state it shows is also text.
- [ ] axe reports zero violations in every register and theme.
- [ ] Motion marks something real. `progress` moves only when the work moves. No fake progress, no decorative loaders that loop forever.
- [ ] Colours come from tokens, and text meets 4.5:1 (3:1 for focus rings and control borders).
- [ ] It works at 390 px wide with no sideways scroll, and a tap lands where it looks like it should.
- [ ] Fallbacks hold: without JavaScript, WebGL, the fonts or sound, the page is still usable and dignified.
- [ ] Byte budget and frame time are measured, not hoped for. Frame time is within 10% of the Paus baseline measured in the same run.
- [ ] It pauses off screen.
- [ ] Indian-language text is marked with `lang`, renders in the right face, and has been read by a native speaker. Money shows the rupee and lakh and crore where the reader expects them.
- [ ] No tracking, no requests to anyone else's servers.
- [ ] Motifs respect their tier (pan-Indian, shared practice, local, sacred). Sacred motifs only when the client leads. Traditions and artisans are credited.
- [ ] The prompt and the map ship with the code, and the map's numbers match the code.
- [ ] The copy meets section 11.
- [ ] No console errors or page errors in any matrix cell.

## 13. Gates and tools

Every tool starts its own server and headless Chromium. Output goes to `.shots/` unless you pass `--out`. On Git Bash for Windows, set `MSYS_NO_PATHCONV=1` before passing `--url /...`.

```sh
npm test                                            # every unit test: engine, core, tokens, scenes, tools, CLI, registry
node tools/serve.mjs 5173                           # then open /tools/harness/scene.html?name=paus&register=playful&theme=dark
node tools/shot.mjs paus 1 3 --register playful     # screenshots at 1 s and 3 s; exits 1 on console errors
node tools/matrix.mjs --scene paus --content        # 15 cells: 3 registers x desktop and phone x light and dark, plus reduced motion
node tools/axe.mjs --scene paus --content           # WCAG 2.2 AA in every register and theme; exits 1 on any violation
node tools/matrix.mjs --url /packages/components/toast/demo.html   # a component: every tool takes its demo page
node tools/perf.mjs --scene tollem                  # mean, p95 and worst frame time and JS bytes, next to the Paus baseline
node tools/diff.mjs --scene kolam --seed 3 --at 2 --update   # make a visual baseline
node tools/diff.mjs --scene kolam --seed 3 --at 2            # compare with it
node registry/build.mjs --check                     # manifests, files, dependencies and budgets; fails if the index is stale
node packages/cli/e2e.mjs scene-paus                # add to a fresh project outside the repo, load it, pass on sg-ready and a clean console
node apps/docs/build.mjs && node apps/docs/check.mjs  # build the docs site, then screenshots, axe, overflow and Look closer
```

- The matrix writes a contact sheet at `.shots/matrix/<target>/index.html`. Open it and look. Generating screenshots is not the same as seeing them.
- Headless Chromium caps frames at 60 Hz and draws WebGL on the CPU. Read perf as a ratio to Paus measured in the same run, and use `--uncapped` to see the real cost of a frame.
- `--param key=value` sets a scene attribute in any tool; `--content` slots a sample heading and paragraph so you can check the scrim and calm zone.
- `tools/README.md` has every flag.
