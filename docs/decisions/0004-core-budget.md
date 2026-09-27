# 0004: core budget is 28 KB of source

*Sutradhar, 24 September 2026, Wave 0. Status: accepted.*

0001 set core at 16 KB before the element's contract was written in full. The built `<sg-scene>` carries the reading layer and scrim, the WCAG 2.2.2 pause toggle, the keyboard path for interactive registers, calm rects, the throttled status for state params, register and theme observation across shadow roots, and colour resolution. Each is required by the charter. Core is 27.0 KB of source (about 21 KB without comments, 9 KB gzipped).

Decision: core's budget is **28 KB of source**, comments included. Growth beyond it needs a new decision; new behaviour that only some scenes need belongs in the scene or an opt-in module.
