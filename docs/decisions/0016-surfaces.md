# 0016: surfaces, a registry type for drawn backdrops

*Sutradhar, 25 September 2026, Wave 5. Status: accepted.*

Carepa (`packages/surfaces/carepa/`) is a drawn backdrop: a pure model, a renderer and a still, like a scene, but with no slotted reading zone. Components mount it behind their own content (Dialog, Drawer). It is neither a scene (nothing is slotted into it) nor a package (it draws, has registers and a still). The Wave 7 Maun field will be one too.

Decision:
- the registry type `surface` joins the schema, between `scene` and `component` in the CLI's order;
- a surface lists only the registers that use it (Carepa: warm and playful; quiet keeps a plain dimmed backdrop), so it is exempt from the three-register warning;
- a surface declares its own budget with a reason, like a component (0009). Carepa: 23,552 bytes, raised from 19,456 when the dusk palette for dark theme landed (`a4d981f`).
- **Amended the same day:** the Wave 5 perf round (`8edd386`) added an idle skip and a Paus-style quality governor, which took Carepa to 28,803 bytes. The budget is now 30,720 bytes, still under a scene's 40 KB default. Idle perf is 0.95x to 0.98x Paus; a continuous pointer drag is 1.13x, recorded as a residual.
