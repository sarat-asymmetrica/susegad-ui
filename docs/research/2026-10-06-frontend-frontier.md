# The front-end frontier, October 2026: what Susegad UI should adopt, watch or avoid

*6 October 2026. A research pass for the Sutradhar, written from web sources checked on this date. Browser support comes from the `web-features` dataset (version 3.40.1, read today through unpkg and the webstatus.dev API), chromestatus.com, vendor release notes and standards-position trackers. Repository numbers come from the GitHub API today. Anything that could not be checked against a primary source is marked **unverified**.*

## Summary

The platform has caught up with most of what Susegad's components do by hand. Anchor positioning, invoker commands, the Navigation API, same-document view transitions, `@starting-style`, `field-sizing`, `sibling-index()`, `ariaNotify()`, `@scope`, container style queries and `contrast-color()` are all now in Chromium, Gecko and WebKit, and customizable `<select>` reached Safari 27 on 14 September 2026 (Firefox has not shipped it yet). The biggest gaps between engines are scroll-driven animations and cross-document view transitions (no Firefox), CSS `if()` and `@function` (Chromium only), Temporal (no Safari stable) and WebGPU (no Firefox on Linux or Android). Beyond the platform, the year's most interesting libraries take over a layer the browser owns: Pretext for text, Yoga, Taffy and Blitz for layout, Vello and TypeGPU for rendering, htmx 4 and Datastar for state in HTML. The next step for "canvas with real text" is HTML-in-Canvas, now in a Chrome origin trial that runs to Chrome 160, with a positive signal from WebKit. Component distribution has settled on Susegad's own shape: a headless core with copy-in skins (Base UI 1.0, shadcn CLI v4), light-DOM "HTML web components", and agent-facing surfaces (Agent Skills, MCP, MCP Apps). The most valuable moves for Susegad are small and native: replace the JavaScript positioning in popover, tooltip and action-menu with anchor positioning; use `ariaNotify`, `@starting-style`, `sibling-index()` and invoker commands to close the microinteraction gaps the business audit found; export the tokens as DTCG 2025.10; and give the MCP server's `preview` an MCP Apps view.

**A note on versions.** Chrome and Firefox moved to two-week stable releases in September 2026 (web.dev, "New to the web platform in September"). The current stable releases are Chrome 154 (22 September), Firefox 157 (29 September) and Safari 27 (14 September). `docs/BROWSERS.md` records Firefox 155 and WebKit 26.6 as the versions under test, so it is already two Firefox releases and one Safari major behind.

---

## 1. Libraries that rethink a layer the browser owns

Stars and last push are from the GitHub API on 6 October 2026.

### Text

| Repo | Author | Stars, activity | The idea | Maturity |
|---|---|---|---|---|
| [chenglou/pretext](https://github.com/chenglou/pretext) | Cheng Lou (React core, React Motion, ReasonML; now Midjourney) | 50.7k, pushed today | Measure and lay out multiline text without touching the DOM. `prepare()` segments the text once and caches glyph widths from canvas `measureText`; `layout()`, `layoutWithLines()`, `walkLineRanges()` and `layoutNextLineRange()` then wrap with arithmetic, so a variable-width line (an arch, a slant) costs no reflow. `prepareRichInline()` mixes fonts and inline boxes. | Launched 27 March 2026. npm is still 0.0.x, so Susegad pins `main` (decision 0019, vendored at `e73081f`, 27 September). Stated limits: needs Canvas 2D and `Intl.Segmenter`; no `font-variation-settings` or optical sizing. |
| Pretext ports and wrappers | many | small | Swift, .NET, Dart, PHP and React Native ports; `fitbox` (darkroom.engineering: fit text to a box); `vite-pretext` (measure in a worker to remove text-driven layout shift); `layout-sans` (flex and grid on top of Pretext). Listed in [awesome-pretext](https://github.com/bluedusk/awesome-pretext). | Experiments. "Textura" (Pretext plus Yoga), widely cited in April, is gone: `razroo/textura` returns 404 and the only copy left is a one-star fork. Treat the ecosystem as volatile. |
| [linebender/parley](https://github.com/linebender/parley) | Linebender | 750, active | Rich text layout in Rust (shaping, bidi, line breaking) for native and Wasm UIs. | Pre-1.0. Shows where a Wasm text engine could come from if canvas measurement ever falls short. |
| [vercel/satori](https://github.com/vercel/satori) | Vercel | 14.0k, active | A subset of HTML and CSS rendered to SVG without a browser, with its own text layout. | Production (OG images). Relevant to scene export and Folio social cards. |

The platform is answering the same need. Three proposals in Chromium affect Pretext-style work directly:

- **HTML-in-Canvas** ([WICG/html-in-canvas](https://github.com/WICG/html-in-canvas), 4.0k stars): a canvas opts in (now `content="drawable"`, formerly `layoutsubtree`), its child elements are laid out and styled by the browser, and the page draws them with `drawElementImage()` (2D), `texElementSubImage2D()` (WebGL) or `drawElementImageToTexture()` (WebGPU). In 2D the browser keeps hit-testing and screen-reader focus rings in step with the drawn position; in 3D the page calls `canvas.updateElementGeometry()` with a matrix. Origin trial extended through Chrome 160 (Chrome for Developers, updated 29 September 2026); chromestatus shows "In development", target 157, Safari **positive**, Firefox no signal.
- **Enhanced Canvas TextMetrics** (chromestatus: proposed, target 157, Safari **negative**): selection rects, caret positions and per-range bounds for canvas text.
- **Language support for canvas text** (`lang` on `CanvasTextDrawingStyles`, chromestatus: developer trial, Safari "support"): language-correct shaping and glyph choice in canvas, which matters for Konkani in Devanagari and for Marathi, where Pretext's canvas measurement must agree with the DOM's.

### Layout and rendering engines

| Repo | Author | Stars | The idea | Maturity |
|---|---|---|---|---|
| [react/yoga](https://github.com/facebook/yoga) (moved from `facebook/yoga`) | Meta | 18.9k | Flexbox outside the browser (React Native, Textura-style hybrids) | Mature |
| [DioxusLabs/taffy](https://github.com/DioxusLabs/taffy) | Dioxus Labs | 3.6k | Block, flex and grid in Rust | Production in several Rust UIs |
| [DioxusLabs/blitz](https://github.com/DioxusLabs/blitz) | Dioxus Labs | 4.2k | A modular HTML and CSS engine (Stylo from Servo, Taffy, Parley, Vello) | Pre-1.0 |
| [linebender/vello](https://github.com/linebender/vello) | Linebender | 4.4k | 2D vector rendering on GPU compute | Pre-1.0 |
| [software-mansion/TypeGPU](https://github.com/software-mansion/TypeGPU) | Software Mansion | 3.3k, MIT | Typed WebGPU in TypeScript: shaders written as TS functions, buffers with inferred types | Active, pre-1.0 |
| [paper-design/shaders](https://github.com/paper-design/shaders) | Paper | 3.5k, Apache-2.0 | About 30 zero-dependency WebGL2 shaders (mesh gradient, grain, halftone, dithering) as drop-in elements, tunable in the Paper design tool | 0.0.x; fully open since July 2026 |
| [Ladybird](https://ladybird.org/) | Ladybird Browser Initiative | n/a | A new independent browser engine | Alpha for Linux and macOS was planned for 2026; whether it has shipped is **unverified** |

three.js (116k stars) is at r186; Susegad vendors 0.186.1. Its `WebGPURenderer` falls back to WebGL2 automatically, but it does not run `ShaderMaterial`, `RawShaderMaterial` or `onBeforeCompile`; shaders must be rewritten in TSL, which compiles to WGSL or GLSL. It is still labelled experimental upstream.

### Animation

| Repo | Author | Stars | Notes |
|---|---|---|---|
| [motiondivision/motion](https://github.com/motiondivision/motion) | Matt Perry | 33.8k | Framework-agnostic (the vanilla core is about 12 kB gzipped per motion.dev, **unverified** by measurement). New in 2026: the Motion AI Kit, an agent skill that turns "bouncier" or "slower" into precomputed CSS `linear()` springs with no runtime; Motion UI (23 July); Motion Studio, a timeline editor that writes to code (22 September). |
| GSAP | Webflow | n/a | Free for commercial use, all former Club plugins included, since 30 April 2025. |
| [juliangarnier/anime](https://github.com/juliangarnier/anime) | Julian Garnier | 73.4k | v4 (3 April 2025): ES modules, WAAPI support, scroll observers, draggables, springs. |

The shared direction: compute motion offline or at author time and hand the browser plain CSS (`linear()`) or WAAPI keyframes, so nothing runs per frame on the main thread.

### State in HTML

| Project | Status | Why it matters here |
|---|---|---|
| [htmx 4.0](https://github.com/bigskysoftware/htmx) (Carson Gross, 49.5k stars) | Shipped 28 August 2026 on npm's `next` tag; 2.x stays `latest` with indefinite support. `fetch()` instead of XHR, streaming, idiomorph morphing built in, events renamed to `htmx:phase:action` (so `htmx:afterRequest` becomes `htmx:after:request`), attribute inheritance now explicit (`:inherited`). | The charter names htmx 4.0 as an adapter. A morph swap that reaches inside an `sg-*` element can undo what the element's JavaScript added to its light DOM. |
| [Datastar](https://github.com/starfederation/datastar) (Delaney Gillilan, 5.1k) | 1.0, with a non-profit foundation. Signals in attributes, server-pushed patches over SSE, about 10 KiB. | Proof that "a server drives attributes" (Susegad's scene contract) is a living pattern, not a niche. |
| Remix 3 | Beta since 30 April 2026; drops React for a forked Preact and Fetch-standard server. A stable release was announced for October 2026; **unverified** whether it has shipped. | A web-standards framework that will need non-React components. |

---

## 2. Platform features: where they stand on 6 October 2026

"Baseline" follows `web-features` 3.40.1: **widely** means 30 months in all engines, **newly** means just reached all engines, **limited** means at least one engine is missing.

| Feature | Chromium | Gecko | WebKit | Baseline | What it means for Susegad |
|---|---|---|---|---|---|
| Anchor positioning | 125 | 147 (13 Jan 2026) | 26 | Core in all three. The `web-features` group reads "limited" today only because it now includes the renamed `anchor-valid` and `anchor-visible` keywords (Safari 27, Chrome target 157). | Replaces `getBoundingClientRect` placement in popover, tooltip and action-menu. Combobox already uses it with a fallback. Avoid `position-visibility` until the rename settles. |
| Popover | 116 | 125 | 17 | Newly (Jan 2025) | Already used. |
| `popover="hint"` | 151 (behaviour changed in 150) | 153 | no | Limited | Tooltip already sets it; keep the fallback. |
| Invoker commands (`commandfor`, `command`) | 135 | 144 | 26.2 | Newly (Dec 2025) | Dialog, drawer and popover triggers that work before or without the component script. |
| Interest invokers (`interestfor`) | 142 | no (neutral) | no (**opposed**, WebKit standards position #464) | Limited | Avoid. |
| `<dialog closedby>` | 134 | 141 | no (position: support) | Limited | Enhancement only; Safari still needs the JS light dismiss. |
| `:open` | 133 | 136 | 26.5 | Newly (May 2026) | Style open dialogs, details and selects without a mirrored attribute. |
| Customizable select (`appearance: base-select`, `::picker(select)`, `<selectedcontent>`, `::checkmark`, `::picker-icon`) | 135 | no (positive, compatibility concerns) | 27 | Limited | `select.css` already opts in under `@supports`. Safari 27 lets rich HTML into `<option>`. WebKit's "golden rule": every option keeps readable text. |
| `@starting-style` | 117 | 129 | 17.5 | Newly (Aug 2024) | Entry animations for popover, toast, drawer and dialog in CSS alone. The audit counts 2 of 48 components using it. |
| Same-document view transitions | 111 | 144 | 18 | Newly (Oct 2025) | Safe to use as an enhancement everywhere. |
| `view-transition-class`, `:active-view-transition-type()` | 125 | 144 / 147 | 18.2 | Newly | Name transitions by kind (forward, back, open) instead of by id. |
| Cross-document view transitions (`@view-transition`) | 126 | no (in Nightly) | 18.2 | Limited | `transitions/page.css` already uses it; Firefox gets a normal navigation, which is the correct fallback. |
| Element-scoped view transitions | 147 | no | no | Limited | Watch: a transition inside one component without freezing the page. |
| Scroll-driven animations | 115 | no (behind a flag in stable; on in Nightly) | 26 | Limited | `scroll-section` uses them. An Interop 2026 focus area, so Firefox is likely to follow. Keep the still frame as the fallback. |
| Navigation API | 102 | 147 | 26.2 | Newly (Jan 2026) | Direction-aware page transitions and an honest "leaving with unsaved changes" guard in forms. |
| Speculation rules | 109 | no (neutral, complexity) | no | Limited | Prerender the likely next page in recipes. Harmless where unsupported. |
| `field-sizing: content` | 123 | 152 | 26.2 | Newly (Jun 2026) | Auto-growing textareas in enquiry, form and chat-thread without JS. |
| `sibling-index()`, `sibling-count()` | 138 | 154 | 26.2 | Newly (Aug 2026) | The Teental stagger in pure CSS, without `talaDelay()` writing a custom property per item. |
| `ariaNotify()` | 141 | 150 | 27 | Newly (Sep 2026) | Announce "3 people, ₹4,500" without a hidden live region. Needs a live-region fallback for Safari before 27. |
| `@scope` | 143 | 146 | 26.4 | Newly (Mar 2026) | Style isolation for light-DOM components without shadow DOM. |
| Container style queries | 111 | 151 | 18 | Newly (May 2026) | A component could respond to an inherited `--sg-register` value. |
| `contrast-color()` | 147 | 146 | 26 | Newly (Apr 2026) | Black or white text picked for a background; a cheap check behind the scene scrim. |
| `shape()` | 135 | 148 | 18.4 | Newly (Feb 2026) | Responsive `clip-path` arches and slants that match the type tier's shapes. |
| `progress()` | 138 | 155 | 26 | Newly (Sep 2026) | Fluid values without `calc()` gymnastics. |
| `linear()` easing | 113 | 112 | 17.2 | **Widely** (Jun 2026) | `--sg-ease-spring` can drop its `cubic-bezier` fallback in a later major. |
| `light-dark()` | 123 | 120 | 17.5 | Newly; image values newly in Sep 2026 | Already used across tokens and scenes. |
| `text-wrap: pretty` | 117 | no | 26 | Limited | Enhancement only. |
| `text-box` (trim) | 133 | no | 18.2 | Limited | Optical centring in buttons and badges, as an enhancement. |
| `interpolate-size`, `calc-size()` | 129 | no (positive) | no (support) | Limited | Animating to `height: auto` (accordion). Use `::details-content` (newly, Sep 2025) instead today. |
| CSS `if()` | 137 | no | no (support) | Limited | Avoid in shipped CSS for now. |
| CSS `@function` | 139 | no | no (support) | Limited | Avoid for now. |
| CSS `@mixin` / `@apply` | no (chromestatus: "Proposed") | no | no | none | Not shipping anywhere. Claims online of "Chrome 146" are wrong. |
| `random()` | target 156 | no (positive) | 26.2 | Limited | Seeded scenes need determinism; CSS `random()` is not seedable in the way the engine's rng is. |
| Scoped custom element registries | 146 | no (positive) | 26 | Limited | Of little use to a light-DOM, `sg-`-prefixed, copy-in library. |
| Declarative shadow DOM | 111 | 123 | 16.4 | **Widely** (Aug 2026) | Not needed for light-DOM components. |
| Temporal | 144 | 139 | no (Technology Preview 249, July 2026) | Limited | TC39 lists it as finished, for ES2027. Not yet for the "honest by the clock" helpers. |
| WebGPU | 113 on Windows, macOS, ChromeOS; all desktop platforms by 144; Android 121 | Windows 141; Apple Silicon macOS 147; Linux and Android not yet (**unverified** beyond the release notes) | 26 | Limited | Keep stage3d on WebGL2. |
| `navigator.vibrate` | yes | no | no | Limited | Android Chrome only. |
| `<input type="checkbox" switch>` | no | no | 17.4 | Limited | A native switch, with the system haptic tick on iPhone. |
| HTML-in-Canvas | origin trial through 160 | no signal | positive | none | See section 1. |

**Interop 2026** (Apple, Google, Igalia, Microsoft, Mozilla) has 20 focus areas, including anchor positioning, dialogs and popovers (`closedby`, `:open`, `popover="hint"`), scroll-driven animations, view transitions (same- and cross-document, `blocking="render"`, `<link rel="expect">`, `:active-view-transition-type()`), the Navigation API (including `precommitHandler`), scoped custom element registries, container style queries, `contrast-color()`, `shape()`, `attr()` and custom highlights. Accessibility testing and mobile testing are investigation areas. Expect the "limited" rows in those areas to close during 2026 and early 2027.

**Safari 27** (14 September) is the largest WebKit release in years: customizable select, transform-aware anchor positioning, scroll anchoring (`overflow-anchor`), `ariaNotify()`, `:heading`, `revert-rule`, `stretch`, multi-colour `color-mix()`, `light-dark()` with images, WebAssembly JSPI, 66 SVG fixes including a review of SMIL, and a local **Safari MCP server** that lets agents such as Claude Code drive Safari for rendering, form-state, computed-style, accessibility and performance checks (Settings, Developer, "Allow remote automation and external agents").

---

## 3. Component patterns in 2025 and 2026

**Headless core, styled copy.** The mainstream has converged on the charter's split. MUI's [Base UI](https://github.com/mui/base-ui) reached 1.0 on 11 December 2025 (35 components, `@base-ui/react`, from the people behind Radix, Floating UI and Material UI). shadcn/ui made Base UI its default primitive layer in July 2026 and expanded React Aria support. React Aria (Adobe) remains the accessibility reference. The lesson for Susegad is confirmation, not change: keep behaviour boring and native, keep the theatre in skins.

**Copy-in registries.** The shadcn registry is now a general distribution format, not a React convenience:

- CLI 3.0 (August 2025): namespaced registries (`@registry/name`), authentication, an MCP server that reads a registry's index.
- Registry index (September 2025) and a public directory (October 2025); `registry:item` "universal items" that carry any files with explicit targets (July 2025).
- CLI v4 (March 2026): `shadcn/skills` for coding agents, presets, `--dry-run`, `--diff`, `--view`, `shadcn info`, `shadcn docs`, and new `registry:base` (a whole design system as one payload) and `registry:font` types.
- 2026: `shadcn apply` and partial presets (April), registry `include` and `validate` (May), GitHub registries (June) and private GitHub registries (August), server-side registry search with pagination (July), and `shadcn/typeset`, one copied CSS file that styles rendered and streamed Markdown (10 July).

Susegad's CLI and registry already do most of this (add, diff, lockfile hashes, stability labels, registers, budgets). What it lacks is a way to be reached from the shadcn ecosystem's tools and directory.

**Web-component libraries.** Shoelace is finished: [Web Awesome](https://github.com/shoelace-style/webawesome) (Font Awesome, Cory LaViska) is its successor, with about 70 free components and a paid Pro tier, shadow-DOM based. Lit (21.8k stars, 3.3.x) moved to the OpenJS Foundation in October 2025. Basecoat (4.3k) brings the shadcn look to any stack with Tailwind and no React. In parallel, the "HTML web components" or "progressive web components" school (Jeremy Keith, Scott Jehl, Cloud Four, Ariel Salminen's 2026 essay) argues for exactly what Susegad does: light DOM, HTML and CSS that work first, JavaScript that enhances. With `@scope` now in every engine, light DOM has a native answer to style isolation.

**Islands and frameworks.** Cloudflare acquired Astro on 16 January 2026 and says it stays MIT. Astro 6 moves the dev server onto Vite's Environments API so local development can run in `workerd`; whether 6.0 is final today is **unverified**. Susegad's site already deploys to Cloudflare (`wrangler.jsonc`), so the Astro adapter and the Workers deploy now share an owner.

**Shipping for agents.**

- **Agent Skills** became an open standard on 18 December 2025 ([agentskills.io](https://agentskills.io/specification), 25.9k stars on the spec repo). A skill is a folder with a `SKILL.md` (only `name` and `description` are required in the frontmatter) plus optional `scripts/`, `references/` and `assets/`, loaded progressively. Claude Code, Codex CLI, Gemini CLI, GitHub Copilot, Cursor and VS Code read it.
- **MCP Apps**, the first official MCP extension (26 January 2026, co-developed by Anthropic and OpenAI): a tool points at a `ui://` resource through `_meta.ui.resourceUri`, and the host renders that HTML in a sandboxed frame that talks back over JSON-RPC. The current core MCP specification is dated 2026-07-28.
- **WebMCP** (`navigator.modelContext`, W3C Web Machine Learning Community Group draft, Google and Microsoft): a web page registers tools that an in-browser agent can call, declaratively in HTML or imperatively. Chrome only, behind a flag (chromestatus: "Proposed").
- **llms.txt**: adoption is high among developer sites but the evidence that models read it is weak. Two large studies found no citation lift and no verified fetches from frontier labs, and Google says it does nothing for Search. It is cheap and harmless as a documentation index; it is not a distribution channel.
- **Custom Elements Manifest** (schema 2.1.0) is what editors and component-aware MCP servers read. Susegad ships one.
- Libraries now ship their own skills (shadcn/skills, Motion's AI Kit, Emil Kowalski's animation skills), which is the same move as Susegad's prompt-per-piece.

**Design tokens.** The W3C Design Tokens Community Group published the first stable Format Module, **2025.10**, on 28 October 2025: JSON tokens with `$value` and `$type`, aliases by dot path, groups, and types including color, dimension, duration, cubicBezier, typography and shadow. The color and resolver (themes and modes) modules are still drafts; the editors' preview of 8 September 2026 says not to implement it yet. Style Dictionary 4 reads the format and Figma Variables export to it. There is no DTCG type for a `linear()` easing or for a register; both would go under `$extensions`.

---

## 4. Microinteractions and motion

**Current practice.**

- Springs in CSS: `linear()` is widely available as of June 2026, so a spring is a precomputed list of points (Jake Archibald and Adam Argyle's generator; Kevin Grajeda's `tailwindcss-spring`; Motion's AI Kit generating the string on request). Susegad already ships two hand-pasted spring curves in `tokens.css`.
- Entry and exit in CSS: `@starting-style` plus `transition-behavior: allow-discrete` on `display` and `overlay` animates top-layer elements (popover, dialog) in and out without JavaScript.
- Staggers in CSS: `sibling-index()` replaces per-item custom properties.
- Page and state continuity: view transitions with `view-transition-class` and transition types.
- Scroll-linked motion in CSS where supported, with a still frame elsewhere.

**Taste in 2026.** The consensus among the people most cited on this (Emil Kowalski's "You don't need animations", Rauno Freiberg's interaction essays, Apple's guidance) is:

- Every animation needs a purpose: feedback, orientation or continuity.
- Do not animate actions people repeat many times a day, and never animate keyboard-initiated ones. Raycast opens with no animation, and that is the right call.
- Keep UI motion under about 300 ms; a 180 ms dropdown feels faster than a 400 ms one.
- Respond on press, not on release.
- Delight belongs in rare moments: a first success, a finished booking.

Gimmicky now means scroll-jacking, parallax for its own sake, motion on every hover, loaders that pretend, and sound on by default. This matches the charter's register table and its honesty rule almost line for line. The quiet register is the industry's "default", and warm is about where tasteful product sites sit.

**Sound.** Synthesised UI sound with no audio files is the 2026 pattern. Cuelume (Daniel White, MIT, 6.4 kB, 14 cues synthesised live with Web Audio) is used in Vercel's fx; UI SFX offers 78 semantic cues in 12 "feels". Susegad's `sound` package (tick, confirm, complete, gentle error, off by default, one switch) is the same design, made earlier. Cuelume's docs do not say whether it is off by default; Susegad's opt-in stance is the stricter one and should stay.

**Haptics.**

- `navigator.vibrate` works only in Chromium on Android. Firefox no longer supports it and Safari never did.
- On iPhone, the only system haptic a page can trigger is a real tap on a native `<input type="checkbox" switch>` (Safari 17.4+).
- Libraries that hid a switch and clicked it from script lost most of that path in iOS 26.5: programmatic re-ticks stopped, and multi-tick patterns now fire only the first tick.
- The **Web Haptics API** proposal (WICG, January 2026; authors Nesh Gandhe, Kevin Babbitt, Limin Zhu) defines `navigator.playHaptics(effect, intensity)` and a CSS `@haptic` rule with six semantic effects: `hint`, `edge`, `tick`, `align`, `success`, `error`. It is in early ideation with no engine commitments.

---

## 5. Other notable currents

**Generative and creative-coding UI.**

- Shader backgrounds became a product category: Paper Shaders, and "Canvas UI" type kits built on the HTML-in-Canvas origin trial. Most are generic mesh gradients and grain.
- Susegad's scenes are differentiated by their content (drawn Goan and Indian places, seeded, with stills and registers), not by technique. The risk is a scene that looks like a Paper mesh gradient with a motif on top.
- The likely next technical shift is HTML-in-Canvas: real, accessible DOM drawn into a 2D, WebGL or WebGPU scene.

**WebGPU adoption.** Every engine now ships WebGPU on some platforms, but not on all of the devices Susegad's users carry. three.js's WebGPU path needs a TSL rewrite of custom shaders. WebGPU's real advantages (compute, large particle counts) are not what stage3d's depth photo and turning pot need.

**Performance norms.**

- Core Web Vitals thresholds are unchanged: LCP 2.5 s, INP 200 ms and CLS 0.1, at the 75th percentile of field data.
- LCP and INP can now be measured in all three engines. Firefox has had LCP since 122 and INP (Event Timing `interactionId`) since 144; Safari added both in 26.2 (12 December 2025), though early Safari INP values ran high.
- Chromium is adding Long Animation Frames (since 123), soft-navigation entries (151) and interaction contentful paint (151).
- Interop 2026 lists mobile testing as an investigation area.
- For a library whose components play sound and haptics on press, the main INP risk is work done synchronously in the press handler: creating an `AudioContext`, decoding, or layout reads.

**Built-in AI in the browser.** Chrome ships Translator and Summarizer (138) and is moving the Prompt API forward. Mozilla and Apple oppose the Prompt API. Nothing here is portable, and none of it supports Konkani. Avoid.

---

## What Susegad should do

Ranked by value to real users, Goan small businesses first, then by cost. Each item names the piece it touches.

1. **Adopt: anchor positioning in `popover`, `tooltip` and `action-menu`.** All three still place themselves with `getBoundingClientRect` (`popover.js:64`, `tooltip.js:102`, `action-menu.js:107`). Core anchor positioning is in every engine since Firefox 147 (January 2026). Follow `combobox.js`'s pattern: feature-test, use `anchor-name`, `position-anchor` and `position-try-fallbacks: flip-block`, and keep the JS placement only as a fallback. Do not use `position-visibility` until the `anchor-valid` and `anchor-visible` rename reaches Chrome (target 157). This removes scroll and resize listeners, which helps INP on budget phones.

2. **Adopt: `ariaNotify()` with a live-region fallback for announced totals.** The audit lists "live announcement 15/48" and says steppers, slot pickers and carts will need "3 people, ₹4,500". Add one helper in `core` that calls `document.ariaNotify` when present (Baseline September 2026) and otherwise writes to a shared polite region. Use it in the new stepper, time-slot and cart pieces from goals A to C.

3. **Adopt: `@starting-style` entries and exits for `popover`, `toast`, `drawer`, `dialog` and `action-menu`.** The audit counts 2 of 48. Baseline since 2024, so no fallback is needed; reduced motion keeps the still. Per register: quiet uses a 120 ms opacity change only, warm adds a short rise, playful adds `--sg-ease-spring`. This is goal C's sweep, done with CSS alone.

4. **Adopt: invoker commands for no-JavaScript triggers.** `<button commandfor="d" command="show-modal">` opens a `<dialog>` before, or without, the component script (Baseline December 2025). Use it in `dialog`, `drawer` and `popover` markup and in the recipes' examples. The custom element then only adds skin and sound. This is the charter's "fallbacks everywhere" rule done by the platform. Keep a click handler for iOS before 26.2.

5. **Adopt: the Teental stagger in CSS with `sibling-index()`.** In `menu`, `event-list`, `gallery`, `data-table` rows and `action-menu`, use `animation-delay: calc(var(--sg-tala-beat) * (sibling-index() - 1))` under `@supports`. Encode the khali beat with `mod()` and `round()`, which are Baseline. Keep `talaDelay()` in `tokens.js` as the tested source of truth and the fallback. This moves the tala stagger from 2 of 48 pieces to every arriving list at almost no JS cost.

6. **Adopt: export tokens as DTCG 2025.10 before the December 1.0 freeze.** Add a `tokens.json` built by `packages/tokens/tools/build-css.mjs` (or a sibling), with `$type` and `$value` for colour, dimension, duration and cubicBezier. Put `linear()` springs, the tala and the register under `$extensions.ai.asymmetrica.susegad`. Freezing token names (ROADMAP, month 3) is the moment to check them against a standard that Figma and Style Dictionary read. Watch the DTCG resolver module for registers and themes, and do not build on its preview.

7. **Adopt: an MCP Apps view for `susegad-mcp`'s `preview` tool.** Today `preview` returns poster URLs. A `ui://` resource showing the piece in quiet, warm and playful, light and dark, would render inside hosts that support MCP Apps (Claude and ChatGPT co-developed it), which is the ROADMAP's month-5 atelier in miniature. Keep the URL list as the fallback for hosts that do not render apps.

8. **Adopt: check `SKILL.md` against the Agent Skills specification.** Required frontmatter is only `name` and `description`; detail goes into `references/`, loaded on demand. That is the "progressive disclosure" the ROADMAP asks for in month 1, and it makes the skill portable to Codex, Gemini CLI, Copilot and Cursor without a rewrite per harness (ROADMAP month 4). Keep `llms.txt` as a cheap index, but expect nothing from it.

9. **Adopt: a shadcn-compatible view of the registry.** Generate `registry:item` JSON (files with explicit `target`s) next to Susegad's own index, so `npx shadcn add https://susegad.asymmetrica.ai/r/<name>.json` and the shadcn MCP server can install Susegad pieces, and list the registry in the shadcn directory. Keep Susegad's own schema as the source of truth, since registers, stability, budgets and prompts have no shadcn field (use `meta`). This reaches builders where they already are, at the cost of one generator in `registry/build.mjs`.

10. **Adopt: `field-sizing: content` on textareas** in `field`, `form`, the enquiry recipe and `chat-thread` (Baseline June 2026). It replaces any auto-grow script and fixes a common annoyance when guests type messages on phones.

11. **Adopt, after a test: a native `switch` attribute in `sg-toggle`.** `<input type="checkbox" switch>` gives iPhone users the system haptic on a real tap, the only sanctioned web haptic on iOS. Other engines ignore the attribute. First test, in WebKit, that the skins can still style it and that `role="switch"` semantics hold. Do **not** copy the hidden-switch-clicked-from-script trick: iOS 26.5 closed that path. Rename `sound/haptics.js` patterns to the Web Haptics proposal's effect names (`tick`, `success`, `error`) so a future `navigator.playHaptics` is a one-line change.

12. **Adopt: the shared success moment and press states in CSS first.** The audit's "press state 2/48" and "no shared success moment" are not platform problems. Note that current taste agrees with the charter: respond on press within one frame, keep motion under 300 ms, never animate keyboard-repeated actions (tabs and menus driven by arrow keys), and save flourish for the end of a booking or order. Write these as the microinteraction check the audit proposes (goal D).

13. **Adopt: speculation rules in templates and recipes.** A `<script type="speculationrules">` that prefetches the obvious next page (rooms to enquiry, menu to order) makes multi-page Goan sites feel instant in Chromium, the dominant engine on Android in India, and does nothing elsewhere. Check how it behaves with Save-Data before shipping it on by default; that behaviour is **unverified** here.

14. **Adopt: Navigation API and view-transition types in `transitions`.** Use `:active-view-transition-type(back)` and `view-transition-class` so back and forward pages slide the right way. The Navigation API (Baseline January 2026) gives a dependable "you have unsaved changes" guard for `form`. Cross-document transitions stay an enhancement while Firefox lacks them.

15. **Adopt: update `docs/BROWSERS.md` and the CI matrix to Safari 27 and current Firefox.** Safari 27 changes customizable select, anchor positioning and scroll anchoring, which are all things the checks touch. With two-week Chrome and Firefox releases, record versions by date. Consider Safari's MCP server as a way for agents to look at real Safari rendering on a Mac, alongside Playwright WebKit.

16. **Watch: HTML-in-Canvas for the type tier and scenes.** It is the platform version of what `packages/type` does with Pretext plus `project()`: real text, drawn on a surface, still selectable and read in order. Prototype it in `sketchbook/` behind the origin trial only. Re-evaluate when it leaves the trial (Chrome 160 or later) and WebKit implements it. Watch, alongside it, canvas `lang` (shaping for Devanagari) and Enhanced TextMetrics, which change what Pretext can measure.

17. **Watch: Pretext's release line.** Susegad pins `main` because npm is 0.0.9. When a tagged release contains the browser-exact line breaking, move the vendored build to it and record that in decision 0019. Pretext's community moves fast and loses projects (Textura vanished within months), so depend on Pretext itself, not on wrappers.

18. **Watch: scroll-driven animations in Firefox, Temporal in Safari, WebGPU on Android and Linux.** `scroll-section` keeps its still frame. The opening-hours and time-slot helpers from goal B should use `Intl.DateTimeFormat` with `timeZone: 'Asia/Kolkata'` (IST has no daylight saving, so this is simple) and move to Temporal only when Safari ships it. `stage3d` stays on `WebGLRenderer`, and WebGPU is reconsidered only if a piece needs compute.

19. **Watch: container style queries and `@scope` for registers and isolation.** Both are newly Baseline. `@container style(--sg-register: warm)` could replace some `[data-register]` selectors, and `@scope (sg-select)` could harden light-DOM styles against host pages. Neither should change the public `data-register` contract before 1.0; try them inside one component first.

20. **Watch: WebMCP and Web Haptics.** WebMCP would let a homestay page offer "check availability" and "send an enquiry" as tools to a visitor's agent: a recipe-level idea with a privacy question attached, Chrome flag only today. Web Haptics would give iPhones semantic haptics; nothing ships yet.

21. **Avoid: `interestfor`, CSS `if()`, `@function` and `@mixin` in shipped CSS, and `random()` in scenes.** WebKit opposes `interestfor`; `if()` and `@function` are Chromium only; mixins ship nowhere. CSS `random()` cannot reproduce a seed the way the engine's rng does, which would break the scene contract's determinism.

22. **Avoid: animation runtimes inside components.** GSAP, Motion and anime.js are excellent, and now free, but every component's motion fits in CSS and WAAPI. Use their generators at author time, for example to compute per-register `linear()` springs from a pure, Node-tested function in `tokens.js` instead of pasted strings. Never add them as runtime dependencies of `sg-*` pieces.

23. **Avoid: moving to shadow DOM, scoped registries or a Lit base class.** The industry's own reconsideration of shadow DOM and Susegad's copy-in, server-driven model both favour the light DOM it already uses.

24. **Avoid: browser built-in AI APIs and shader-background kits as scenes.** The AI APIs are Chromium-only, are opposed by the other two engines, and do not cover Konkani. Generic shader kits would make the scenes look like everyone else's; Susegad's value is the drawn place, not the gradient.

25. **Watch closely: htmx 4 morphing against `sg-*` elements.** Before the htmx adapter targets 4.0 (which is still on npm's `next` tag), add one check where an `hx-swap` morph updates attributes on an `sg-scene` and an `sg-select` and confirm the elements keep their enhanced DOM. If they do not, document `hx-preserve` or an `htmx:before:swap` rule in the adapter.

---

## Sources

**Status data and specifications**
- web-features dataset 3.40.1: https://www.npmjs.com/package/web-features (data read via https://unpkg.com/web-features/data.json)
- webstatus.dev API, for example: https://api.webstatus.dev/v1/features/anchor-positioning
- chromestatus.com feature search API: https://chromestatus.com/api/v0/features?q=mixins
- Interop 2026 README: https://github.com/web-platform-tests/interop/blob/main/2026/README.md
- WebKit, Announcing Interop 2026: https://webkit.org/blog/17818/announcing-interop-2026/
- Mozilla Hacks, Launching Interop 2026: https://hacks.mozilla.org/2026/02/launching-interop-2026/
- web.dev, New to the web platform in September 2026: https://web.dev/blog/web-platform-09-2026
- web.dev, New to the web platform in January 2026: https://web.dev/blog/web-platform-01-2026
- WebKit Features for Safari 27.0: https://webkit.org/blog/18325/webkit-features-for-safari-27-0/
- News from WWDC26, WebKit in Safari 27 beta: https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/
- The golden rule of customizable select: https://webkit.org/blog/18117/the-golden-rule-of-customizable-select/
- 9to5Mac on Safari 27's MCP server: https://9to5mac.com/2026/09/17/webkit-blog-breaks-down-whats-new-with-safari-27-for-developers-including-mcp-support/
- Firefox 147 release notes: https://www.firefox.com/en-US/firefox/147.0/releasenotes/
- WebKit standards position on `interestfor`: https://github.com/WebKit/standards-positions/issues/464
- Mozilla standards position on `interestfor`: https://github.com/mozilla/standards-positions/issues/1181
- Safari Technology Preview 249 (Temporal): https://webkit.org/blog/18182/release-notes-for-safari-technology-preview-249/
- TC39 finished proposals: https://github.com/tc39/proposals/blob/main/finished-proposals.md
- HTML-in-Canvas updates: https://developer.chrome.com/blog/html-in-canvas-ot-changes
- WICG HTML-in-Canvas: https://github.com/WICG/html-in-canvas
- WICG Web Haptics: https://github.com/WICG/web-haptics
- WebMCP: https://github.com/webmachinelearning/webmcp
- Firefox experimental features (scroll-driven animations flag): https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Experimental_features

**Libraries**
- Pretext: https://github.com/chenglou/pretext
- awesome-pretext: https://github.com/bluedusk/awesome-pretext
- Parley: https://github.com/linebender/parley
- Satori: https://github.com/vercel/satori
- Yoga: https://github.com/facebook/yoga
- Taffy: https://github.com/DioxusLabs/taffy
- Blitz: https://github.com/DioxusLabs/blitz
- Vello: https://github.com/linebender/vello
- TypeGPU: https://github.com/software-mansion/TypeGPU
- Paper Shaders: https://github.com/paper-design/shaders
- Ladybird: https://ladybird.org/
- three.js: https://github.com/mrdoob/three.js
- Motion: https://motion.dev/ and https://motion.dev/ai-kit
- GSAP 3.13 (free): https://gsap.com/blog/3-13/
- anime.js v4.0.0: https://github.com/juliangarnier/anime/releases/tag/v4.0.0
- htmx 4.0 (InfoQ): https://www.infoq.com/news/2026/09/htmx-4-released/
- Datastar: https://github.com/starfederation/datastar
- Remix 3 beta (InfoQ): https://www.infoq.com/news/2026/07/remix-3-beta-preview/

**Components, registries and agents**
- shadcn/ui changelog: https://ui.shadcn.com/docs/changelog
- shadcn CLI v4: https://ui.shadcn.com/docs/changelog/2026-03-cli-v4
- shadcn CLI 3.0 and MCP: https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp
- shadcn registry-item.json: https://ui.shadcn.com/docs/registry/registry-item-json
- shadcn/typeset: https://ui.shadcn.com/docs/changelog/2026-07-typeset
- Base UI 1.0 (InfoQ): https://www.infoq.com/news/2026/02/baseui-v1-accessible/
- Web Awesome: https://github.com/shoelace-style/webawesome
- Lit joins OpenJS: https://lit.dev/blog/2025-10-14-openjs/
- Basecoat: https://github.com/hunvreus/basecoat
- Progressive Web Components (Ariel Salminen): https://arielsalminen.com/2026/progressive-web-components/
- Light-DOM-only web components: https://frontendmasters.com/blog/light-dom-only/
- Astro joins Cloudflare: https://blog.cloudflare.com/astro-joins-cloudflare/
- Agent Skills specification: https://agentskills.io/specification
- MCP Apps announcement: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- MCP Apps specification: https://github.com/modelcontextprotocol/ext-apps
- MCP specification versioning: https://modelcontextprotocol.io/specification/versioning
- llms.txt evidence review: https://www.digitalapplied.com/blog/llms-txt-in-practice-adoption-evidence-2026
- Custom Elements Manifest: https://github.com/webcomponents/custom-elements-manifest
- Dave Rupert on the manifest: https://daverupert.com/2025/10/custom-elements-manifest-killer-feature/
- Design Tokens Community Group: https://www.designtokens.org/ and drafts at https://www.designtokens.org/tr/drafts/

**Motion, sound, haptics, performance**
- Emil Kowalski, You don't need animations: https://emilkowal.ski/ui/you-dont-need-animations
- Josh Comeau, Springs and bounces in native CSS: https://www.joshwcomeau.com/animation/linear-timing-function/
- tailwindcss-spring: https://github.com/KevinGrajeda/tailwindcss-spring
- Cuelume: https://cuelume.dev/
- iOS web haptics after 26.5: https://haptics-web.vercel.app/
- Core Web Vitals thresholds: https://web.dev/articles/vitals
- Firefox ships INP: https://www.rumvision.com/blog/firefox-ships-inp-support/
- Safari 26.2 LCP and INP: https://www.rumvision.com/blog/safari-catching-up-inp-and-lcp-support-in-the-same-beta-release/
