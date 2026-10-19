# Kathakar's pass on front door 4

Pass of 13 October 2026, Full, on `batch/site-overhaul` (strings as built at HEAD, diff `62c7504..HEAD -- apps/docs`). Request: `docs/requests/2026-10-12-front-door-4.md`. Read against: Kathakar kernel, the charter's copy standards, the Humane Register Doctrine, and the repo (facts checked are listed at the end of each table and in the evidence block).

Nothing outside this file was edited. "keep" means I read it, checked it and have nothing to add. A key in the "Key or location" column is the key in `words.core.js` under `W.audience` unless a file is named. Where my text contains `{n}`, `{site}`, `{what}`, `{name}` and `{kind}`, those are the build's placeholders, unchanged.

The reader order held up well: the home page now answers "what could this make for me?" in the first screen, and the voice is one person throughout. The changes below are mostly about claims that are a little larger than the code can back, one that is wrong in practice (the "nothing ties you to us" line against what the agent prompt makes), and the first-reader prompt, which ends in code the reader cannot yet put online.

## Summary of the largest changes

1. The for-teams line "nothing ties you to us, and nothing on the page reports to anyone" is not true of a page built the way `llms-start.md` step 2 and 3 tell an agent to build it (fonts, tokens and scenes loaded from susegad.asymmetrica.ai). Reworded, and `llms-start.md` now tells the agent when to copy files instead.
2. "Open one and use it: every one works" (home) is not true of the demos: booking, enquiry, upload, saving and the studio page are prototypes that hold, send and charge nothing. Reworded to say the details are samples.
3. The two prompts a non-coder pastes end with code they cannot publish. Added one sentence asking the agent to explain, in plain words, how to put the page online and to ask for what it needs.
4. "Works on every phone" is not something the checks show: `docs/BROWSERS.md` says they have not run on a real phone. Now "Made for phones" with no "every".
5. The header's View panel says "Register" and "warm register" (legend and aria-label) on every page, above the first developer link, which the first-reader rule bans. Needs a plain word in `site.core.js`.

## 1. Navigation (header)

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `nav.showcase` | Showcase | keep | Plain. |
| Nav item "Scenes" (`site.core.js` NAV, literal) | Scenes | keep, see builder note 9 | Library word, but the request keeps it. |
| `nav.start` | Get started | keep | Plain, and a verb. |
| `nav.teams` | For teams | keep | Short. A café owner may not call herself a team; "For businesses" would sit closer to the page's own kicker. Owner's call, see builder note 10. |
| `nav.developers` | Developers | keep | |
| NAV item "Accessibility" | Accessibility | see builder note 8 | It appears in the nav and again as `bar-trust` on the right of every page. |

## 2. Home: head and hero

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `index.html` meta description and `og:description` | Web pages that are beautiful and comfortable at the same time, drawn in code in Goa. Free and open, easy for everyone to use, and made to be built with an AI agent. | Web pages that are beautiful and comfortable at the same time, drawn in code in Goa. Free, open, and ready for you, your developer or your AI agent to build with. | "Easy for everyone to use" appears three more times on the page; "made to be built" is passive. This says who builds. |
| `home.kicker` | drawn in code in Goa | keep | |
| `home.title` | Susegad UI | keep | |
| `home.gloss` | Konkani, from the Portuguese *sossegado*: unhurried, at ease. | keep | Accurate and warm. |
| `home.lede` | Web pages that are beautiful and comfortable at the same time. A homestay's booking page, ... easy for everyone to use, on any phone. | keep | The examples are the right ones for reader one. "Beautiful and comfortable" is the charter's own phrase. "On any phone" is a smaller claim than "every phone" and stays. |
| `home.lede2` | It is free, and made to be built with an AI agent. Ask yours, or ask your developer. | It is free. You can ask an AI agent to build your page with it, or ask your developer. | Active voice; says who does what instead of "made to be built". |
| `home.ctaShow` | See what it makes | keep | |
| `home.ctaAgent` | Build it with your agent | keep | Assumes the reader has an agent. Acceptable as reader two's button; reader one has "Ask your developer" in the ways band. |
| `home.dev` + `home.devLink` | Writing the code yourself? The developer's door | keep | |

## 3. Home: see it working, moods

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `home.showTitle` | See it working | keep | |
| `home.showIntro` | Whole pages, made from the library's pieces. Open one and use it: every one works. | Whole pages made with Susegad UI. Open one and try it. The names and details are samples. | "Every one works" is wrong for the prototypes (booking: "nothing leaves the page, nothing is held and nothing is charged"; enquiry: "sends nothing"; file upload and saving use sample files and a fake network). A reader who hits "Book" and finds nothing booked feels tricked; say it first. |
| `home.showAll` | See all {n} in the showcase | keep | |
| `home.moodsTitle` | One look, three moods | keep | |
| `home.moodsBody` | Every piece comes quiet, warm or playful. Quiet suits a bank or a clinic, ... Try it with the View button at the top of this page. | keep | Clear and specific. Depends on builder note 5 (the View panel's own words). |
| specimen text "3 of 5 photos uploaded" | | keep | |
| specimen group `aria-label` | The same upload progress in each mood | keep | |

## 4. Home: three ways to use it

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `ways.title` | Three ways to use it | keep | |
| `ways.agentTitle` | With your AI agent | keep | |
| `ways.agentBody` | Paste this into Claude, ChatGPT, Cursor or any agent that can read a web page. Change the words in brackets. | keep | |
| `ways.agentPrompt` (also in `start.html`, `#agent-words`, both literal) | Make me a one-page website for [my homestay in Aldona] using Susegad UI. First read {site}/llms.txt and follow its "Start here" section. Use the warm look and a scene that fits the place, and keep it easy to use on a phone. | Make me a one-page website for [my homestay in Aldona] using Susegad UI. First read {site}/llms.txt and follow its "Start here" section. Use the warm look and a drawn scene that fits the place, and keep it easy to use on a phone. Ask me for anything you need. When it is ready, explain in plain words how I can put it online. | Two additions. A homestay owner in a chat window gets a block of code and no way to publish it; the last two sentences make the agent finish the job. "A drawn scene" tells the person what "scene" means and still matches the "Scenes" heading in llms.txt. Keep home and start.html identical (the build could take both from `W.audience.ways.agentPrompt`). |
| `ways.copy` | Copy the words | Copy this request | "The words" does not say which words. |
| `ways.copied` and `data-announce` (both pages) | Copied. Paste them into your agent. | Copied. Paste it into your agent. | Matches the button and the showcase's own "Paste it into your agent." |
| `ways.devTitle` / `devBody` / `devLink` | Ask your developer / If someone builds your site for you, send them a short note with everything they need. / The note for your developer | keep | |
| `ways.handTitle` | Build it yourself | keep | |
| `ways.handBody` | One command makes a whole site you can change, or copy just the pieces you want into a project you already have. | Copy the pieces you want into a project you already have, or make a whole site from a template. Both use a terminal. | "One command" is not yet true on npm: `@susegad/cli create` arrives with version 0.2.0, and the home page's own note further down says so. Do not promise it in the card a reader meets first. "Both use a terminal" tells reader one this is not their route. See builder note 3. |
| `ways.handLink` | Get started | keep | |

## 5. Home: Drawn in Goa, what you can count on, for developers

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `goaTitle` | Drawn in Goa | keep | |
| `goaBody` | The pictures are drawn in code, not photographed: rain on a window ... They move gently, rest when nobody is looking, and hold your words. | keep | Specific, warm. "Rest when nobody is looking" is the off-screen pause, close enough and kind. |
| `goaAll` | All {n} scenes | keep | |
| `trustTitle` | What you can count on | keep | |
| trust 1 `Free and open` | The code is MIT licensed. Use it for any site, including one you are paid to make. | keep | MIT allows it. The drawings and words are CC BY 4.0 and fonts keep their own licences, so "The code" is right; do not widen it. |
| trust 2 title | Light on every phone | Made for phones | `docs/BROWSERS.md`: "We have not run the checks on a real phone." The checks emulate one size. "Every" cannot stand. |
| trust 2 body | Pages load what they need, the drawings rest off screen, and every page still reads well with no JavaScript. | Pages load only what they need, the drawings rest when they are off screen, and the words still read with JavaScript off. | "Every page ... reads well" is a measured claim for the site's pages only, not every page someone builds. Softened to what the library does. |
| trust 3 title | Easy for everyone to use | keep | |
| trust 3 body | Built to WCAG 2.2 AA, with keyboard and screen reader support checked on every piece. | Built to WCAG 2.2 AA. Buttons, forms and menus are tested for keyboard use and for what a screen reader announces. | `docs/reference/accessibility.md`: tables exist per component (53), not for scenes or recipes, and screen reader behaviour "is checked through the accessibility tree, not with a live screen reader". "Every piece" overshoots; "tested for what a screen reader announces" is true. |
| trust 4 title | Made for India | keep | |
| trust 4 body | Konkani in Devanagari and Romi, lakh and crore, the rupee, and time in IST. | Konkani in Devanagari and Romi, lakh and crore, the rupee, and time in IST. The Konkani is a first draft until a Goan reader has checked it. | The code supports all of it (`gom-Deva`, `gom-Latn`, `core/intl.core.js`, event time zone `Asia/Kolkata`). The Konkani is unreviewed by a native reader (`docs/HANDOFF.md`), and a business reader should know before they rely on it. |
| `trustLink` | How we check accessibility | keep | |
| `devsTitle` | For developers | keep | |
| `devsIntro` | Plain HTML, CSS and JavaScript that you copy into your project and own. No framework, and no build step unless you want one. | keep | Matches `docs/HANDOFF.md` ("no build step required") and SKILL.md ("No bundler"). True. |
| hero-install lead + npm note | Make a whole site from the command line: ... `create` arrives on npm with version 0.2.0. Until then, Get started shows how to run it from a clone. | keep | The honest note is right. |
| footer link row, footer text | | keep | "This page makes no requests to anyone else's servers" is true of the docs page. |

## 6. Showcase (`/showcase`)

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `show.kicker` | {n} whole pages | keep | |
| `show.title` | Showcase | keep | |
| `show.lede` | Pages made from the library's pieces, for the kinds of places Goa is full of. Each one runs here: open it, try it, then make your own. | Pages made from the library's pieces, for the kinds of places Goa is full of. Each one runs here with sample names and details: open it, try it, then make your own. | Same honesty as the home intro. |
| `show.help` | Make this with your agent copies a few lines to paste into Claude, ChatGPT, Cursor or any agent that can read a web page. | Each "Make this with your agent" button copies a short request to paste into Claude, ChatGPT, Cursor or any agent that can read a web page. | A button name as the sentence's subject is hard to read aloud. |
| `show.agent` | Make this with your agent | keep, but give each button an accessible name that includes the page: `aria-label="Make this with your agent: Book a stay"` | Seventeen buttons with the same name fail a screen reader user's list of buttons. Same for the 17 "How it is made" links (`aria-label="How it is made: Book a stay"`). Builder note 6. |
| `show.copied` | Copied. Paste it into your agent. | keep | |
| `show.how` | How it is made | keep (see aria note above) | |
| `show.prompt` | Make me {what} using the {title} recipe from Susegad UI ({name}). First read {site}/llms.txt and follow its "Start here" section. Change the words to [my place and my details]. | Make me {what} with Susegad UI, starting from its {name} {kind}. First read {site}/llms.txt and follow its "Start here" section. Replace the sample words with [my place and my details]. Ask me for anything you need. When it is ready, explain in plain words how I can put it online. | As built, the copied text reads "using the Studio home (a mock) recipe from Susegad UI (studio-home)" and "the Ask the house (enquiry) recipe from Susegad UI (enquiry)": the registry title repeats the name and one title says "a mock". Use only `{name}`, the id the agent can find in llms.txt, and `{kind}` ("recipe", or "template" for `template-event`, which is a template, not a recipe). "Change the words to [...]" is ungrammatical. Last two sentences as in the home prompt. |
| `show.groups` | Stays and travel / Events / Food and shops / Work and documents / Stories and greetings / More pages | keep | "More pages" is the only vague one; fine as a last group if one is ever empty. |
| `show.nextTitle` / `nextBody` | Make one of your own / Every page here is a starting point. Change the words, the pictures and the mood, and it becomes yours. | keep | |

Piece titles, lines and `what` (`pieces`):

| Piece | Current line | Mine | Why |
|---|---|---|---|
| `site-shell` "A homestay's website" | Rooms, a way to book and an account menu, for a house in Aldona. | A sample homestay site: rooms, a way to book and an account menu. | README: "for a fictional homestay, Casa Aldona". Rooms, Book and the Account menu are in the README. Aldona is a real village; the house is not. |
| `booking` "Book a stay" | Dates under a ribbon of the seasons, guests and rooms, and a price worked out night by night. | Four short steps: dates, guests and room, your details, and a confirmation. The price is worked out night by night. A sample: nothing is held or charged. | The README says it is a prototype that holds and charges nothing. "A ribbon of the seasons" is insider; it is in the recipe prompt, so it exists, but a reader cannot picture it. |
| `room-details` | A room's view, beds and what it has, inked in as the details arrive. | keep | Matches the README. "Inked in" is true in warm and playful only; acceptable. |
| `enquiry` "Ask the house" | A short enquiry form that checks itself as you type and says plainly what it needs. | A short enquiry form that checks itself as you type and says plainly what it needs. It sends nothing in this sample. | README: "it sends nothing, and it says so". |
| `template-event` | A one-day event in Panjim, in English and in Konkani: the programme, the speakers, the venue and a ticket. | keep | Template README: Panjim, English and Konkani. |
| `agenda` | Rooms and tracks across one or two days, and it knows what is on stage now. | keep | |
| `speakers` | Each speaker's name, role and talk, linked to its slot in the programme. | keep | |
| `venue` | The address, directions by landmark in plain words, and links to a maps app. | keep | |
| `member-directory` | A list of people you can filter by name and by group, and share as a link. | keep | README: filter in the address, so shareable. |
| `offline` | After one visit, the site's pages open again without a network: at a venue with no signal, say. | keep | Matches the recipe README. |
| `food-order` | For a small kitchen that takes orders on WhatsApp: the menu, a basket, and the order sent as a message. | For a small kitchen that takes orders on WhatsApp: the menu, a basket, and the order written as a message you send yourself. | README: "The page never says an order is placed"; the person presses send in WhatsApp. "Sent as a message" suggests the page sends it. |
| `studio-home` | A one-person studio: what it is doing now, its work as postcards, a client's words, a way to reach it. | keep | |
| `proposal` | Written in plain text and made into one file your client can open offline, with a drawn cover. | keep | Docs: `proposal-cover` with a scene; single-file Folio. |
| `file-upload` | Photos and PDFs that show each one arriving, and say plainly when one is too large. | Photos and PDFs that show each one arriving, and say plainly when one is too large. This sample uses made-up files. | The demo's uploads are simulated (a 14.2 MB sample photo is refused on purpose). |
| `saving-footer` | It saves when you pause, says when it saved, and keeps your words if the connection drops. | keep | The README's transport is a fake network, covered by the page-level "sample" line. |
| `greeting-card` | A flower grown from a person's name, with a line of your own, saved as a picture to share. | keep | Matches the prompt. |
| `storybook-spread` | A page of a Goan storybook in two languages, read aloud with each word lit as it is spoken. | A page of a Goan storybook in English and Marathi, read aloud by a computer voice with each word lit as it is spoken. | The recipe's languages are English and Marathi, not Konkani (a Goan reader will look for Konkani first). The audio is Sarvam text-to-speech; say so. Marathi is for the Goan Marathi reader to confirm (builder note 11). |

Titles (`A room, ready for guests`, `Send us your photos`, `A form that saves itself`, `A menu that takes orders`, `Who is who`, and the rest): keep. They are plain nouns and phrases a clinic or a café would use.

## 7. For teams (`/for-teams`)

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `teams.navTitle`, `kicker`, `title` | For teams / for businesses and teams / A site that feels like your place | keep | |
| `teams.lede` | Susegad UI is a free library of pieces for web pages: forms, bookings, menus, tickets, documents and drawings of Goa. Whoever builds your site can use it, and you keep everything they make. | Susegad UI is a free library of pieces for web pages: forms, bookings, menus, tickets, documents and drawings of Goa. Whoever builds your site can use it at no cost, and its licence puts no limits on the finished site. | "You keep everything they make" is a promise about the contract between a business and its developer, which Asymmetrica does not control. What the library can say is what its licence allows. (MIT asks that copies of the code keep its notice; that is the developer's small duty, so "no limits on the finished site" is fair.) |
| `getTitle` | What your site gets | keep | |
| get 1 | **A look of its own.** Drawings made for Goa and India, and three moods to choose from, so your site does not look like everyone else's. | keep | |
| get 2 | **Easy for everyone.** Built to WCAG 2.2 AA, the standard India's GIGW guidelines draw on. Every piece works with a keyboard and with a screen reader. | **Easy for everyone.** Built to WCAG 2.2 AA. India's GIGW 3.0 guidelines for government sites ask for WCAG 2.1 AA, and 2.2 AA covers it. Buttons, forms and menus are tested for keyboard use and for screen readers. | "Draw on" is vague. The repo (`docs/reference/accessibility.md`, `docs/contributing/conformance.md`) says GIGW 3.0 asks for 2.1 AA from secondary sources, and the primary text was not read; see builder note 1 before this ships. "Every piece" as in trust 3. |
| get 3 | **Light on a phone.** Pictures load when they are needed and rest when they are off screen, and pages still read well on a slow connection. | **Made for phones.** Pictures load when they are needed and rest when they are off screen, and the words still read when the pictures have not arrived. | Matches the home title. "Read well on a slow connection" is a performance claim with no number behind it on this page; "the words read when the pictures have not arrived" is what the poster-first design guarantees. |
| get 4 | **In your language.** Konkani in Devanagari and Romi, dates in IST, and prices in rupees with lakh and crore. | **Konkani as well as English.** The pieces carry their words in English and in Konkani, in Devanagari and in Romi. The Konkani is a first draft until a Goan reader checks it. Dates use IST, and prices use rupees with lakh and crore. | "In your language" promises Hindi, Marathi and more; only English and Konkani exist (storybook narration also has Marathi). The draft status belongs next to the claim. |
| get 5 | **Yours to keep.** The code is copied into your project. Nothing ties you to us, and nothing on the page reports to anyone. | **Yours to keep.** The code is copied into your project, so nothing ties your site to ours. The pieces carry no tracking or analytics. | Two problems. (a) A page built from the agent prompt loads its fonts, tokens and scenes from susegad.asymmetrica.ai (`llms-start.md` steps 2 and 3), which both ties it to us and sends visitors' requests to our server. (b) "Reports to anyone" cannot cover a form: a form posts wherever the builder points it (`form.js` `fetch`), and food-order opens WhatsApp. "No tracking or analytics" is what the code supports (grep of `packages/` finds no beacon or analytics; the `fetch` calls are the form, the player's captions, the narration reader, the build-time Sarvam call and the service workers). |
| `costTitle` | What it costs | keep | |
| `cost` | The library is free, under the MIT licence. You pay only for the time of whoever builds your site, and pieces that are already made save them some of it. | The library is free, and its code is under the MIT licence. You pay for the time of whoever builds your site, and for hosting and a domain, as with any site. Ready-made pieces save the builder some of that time. | "Only" hides hosting and the domain. The licence covers the code; the words and drawings are CC BY 4.0. |
| `devTitle` | A note for your developer | keep | |
| `devIntro` | Copy this and send it to whoever builds your site, by email or by message. | keep | |
| `note` | Hello. For our site, please take a look at Susegad UI ({site}). It is a free, MIT licensed library of accessible pieces in plain HTML, CSS and JavaScript, copied into the project, with no framework needed. The developer's page is {site}/developers and the accessibility record is {site}/accessibility. An AI agent can start from {site}/llms.txt. | Hello. For our site, could you look at Susegad UI ({site})? It is a free library under the MIT licence, in plain HTML, CSS and JavaScript. You copy the pieces you want into the project, and no framework is needed. Its developer page is {site}/developers and its accessibility record is {site}/accessibility. If you work with an AI agent, it can start from {site}/llms.txt. Tell me if it would not suit our site, and why. | A developer reads this cold: asking a question and inviting a "no, because" is easier to answer than "please take a look". "Accessible pieces" is dropped (the record is one link away and the claim is bounded there). All facts as in the draft. |
| `copy`, `copied` | Copy the note / Copied. Paste it into an email or a message. | keep | |
| `agentLine` | Building it yourself with an AI agent? (+ link "Build it with your agent") | keep | |
| `faqTitle` | Questions people ask | keep | |
| faq colours | Can it use our colours and fonts? / Yes. Colours and type are set in one place, so your developer can change them for the whole site at once. | keep | Tokens (`packages/tokens`) hold colour and type; a palette tool exists. |
| faq builder | Does it work with our website builder? / It works anywhere you can add HTML, CSS and JavaScript. Ask your developer what your builder allows. | keep | Honest and bounded. |
| faq gov (q) | Is it suitable for government and public sites? | keep | |
| faq gov (a) | It is built to WCAG 2.2 AA, and each piece has a published table of how it meets each guideline. A site still needs its own audit; the tables make that audit shorter. | It is built to WCAG 2.2 AA. Each button, form and menu has a published table showing how it meets each guideline, and the gaps are named. Certification is given to a whole site, not to parts, so a government site still needs its own audit. The tables make that audit shorter. | Tables are per component (53), not per piece; `HANDOFF.md` says "GIGW certification is given to a site, not to a component." That sentence is the useful one for this reader. |
| faq Konkani (q/a) | Can the site be in Konkani? / Yes. The pieces carry their words in English and in Konkani, in Devanagari and in Romi. The Konkani is a draft, awaiting a native reader. | Yes, in Devanagari or in Romi. The words the pieces show, such as "Close" and "Next", and the event template come in English and Konkani. The Konkani is a first draft that a Goan reader has not yet checked. | "Yes" alone suggests a site translates itself. Say what exists. Also avoids "awaiting a native reader", which is team language. Drop the get-4 sentence if you would rather say it once. |
| faq who (q/a) | Who makes it? / Asymmetrica, in Goa, with Claude. The code, the drawings and the prompts are open on GitHub. | keep | Footer says the same. |
| `contact` (+ link `asymmetrica.ai`) | Want to talk about a site? Asymmetrica is at asymmetrica.ai | Want to talk about a site? Find Asymmetrica at asymmetrica.ai. | Full stop and a verb. The address is the owner's gate (request, "Owner gates"). |

## 8. Developers (`/developers`)

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `devs.kicker`, `title`, `lede`, `start` | the developer's door / Developers / Everything the library holds, and how it is built. Pieces are plain web platform code that you copy into your project and own. / Start building | keep | The engineer is the one reader who can take the library's own words. |
| `shelfTitle`, `pencilTitle` | The shelf / The pencil box | keep | |
| shelf lines (components, recipes, templates, scenes, foundations, pencil-box) | | keep | "Boringly correct" is the charter's own. The counts (61 components) should be checked, see builder note 7. |
| `toolsTitle` | Tools | keep | |
| tool: The CLI | create a site from a template, or add pieces with everything they stand on. | add a clause: ... with everything they stand on. `create` reaches npm with version 0.2.0; until then run it from a clone. | An engineer who runs it today gets an error. Home and Start both carry this note; this page does not. |
| tool: For AI agents | SKILL.md for your agent, and an MCP server that searches and adds pieces itself. | keep | |
| tool: shadcn | every piece served for the shadcn CLI at /r/. | every piece in the registry served for the shadcn CLI at /r/. | Only if true: confirm /r/registry.json lists scenes and recipes, not just components (builder note 7). Otherwise "the components and recipes". |
| tool: llms.txt, custom-elements.json, GitHub | | keep | |
| trust: Accessibility | WCAG 2.2 AA, a conformance table for each component, and the gaps named. | keep | "Gaps named" is true: one known gap (tooltip, 1.4.13 without JavaScript). |
| trust: Browsers | the whole suite in Chromium, WebKit and Firefox, and what each still lacks. | keep, but add: "Not yet on a real phone." | `docs/BROWSERS.md` says so, and an engineer will want to know. |
| trust: Handoff | what a new team needs on its first day with the library. | keep | |
| `ideasTitle` / Three ideas (`ideas.html`) | One component, three registers / Every component ships with its prompt / Behaviour and skin are separate (and their paragraphs) | keep | The charter's three ideas in the engineer's words, now below the developer link. One small note: the first paragraph says "for an ERP buyer"; fine for this reader. |

## 9. Start (`start.html`)

| Key or location | Current | Mine | Why |
|---|---|---|---|
| `<title>`, h1 | Get started | keep | |
| meta description | Three ways in: work with an AI agent, build a site from a template, or add pieces to a project. Each ends with a page that works. | keep | |
| `og:description` | From an empty folder to a page with a scene, a card and a footer: three ways, by hand, with the CLI and with an agent. | Three ways in: ask an AI agent, build a site from a template, or add pieces to a project you have. Each ends with a page that works. | The old text still has the pre-overhaul order and the word "CLI"; it is what a link preview shows. |
| kicker, lede | three ways in / Pick the path that sounds like you. Each one ends with a page that works. | keep | |
| agent path title | I'm working with an AI agent | keep | |
| agent path intro | No terminal needed: paste this into Claude, ChatGPT, Cursor or any agent that can read a web page, and change the words in brackets. | keep | |
| `#agent-words` prompt, button, announce | (as home) | as in section 4 | Keep identical to home. |
| `path-lead` | If your agent works in a terminal, it can go further: | If your agent can run commands on your computer, you can give it more to work with: | "Terminal" is the very word reader two avoided; this says the same thing. |
| paragraph after it | Give your agent the library's `SKILL.md` and say what you want, the way you would say it to a person. The skill carries the registers, the install lines and the scene contract. The MCP server goes further: your agent can search the shelf, read a piece's prompt and add pieces itself. | Give your agent the library's `SKILL.md` and say what you want, the way you would say it to a person. The skill teaches it the three looks, how to install each piece and how the scenes work. The MCP server lets it search the shelf, read a piece's prompt and add pieces itself. | "Registers", "scene contract" are the library's insider words, on a page a vibe coder reads; "goes further" appeared twice in four lines. |
| path-note, links, install lines | It needs Node 22 or later. Run it from the project it should add pieces to. | keep | Confirm the `skill` subcommand exists in the published 0.1.x CLI (builder note 4). |
| other paths | | keep | |

## 10. `llms-start.md` (what an agent reads in llms.txt)

| Location | Current | Mine | Why |
|---|---|---|---|
| Intro paragraph | For an AI agent making a page for someone. Everything below is served from https://susegad.asymmetrica.ai with cross-origin headers, so a page can load it straight from the site; a project with a terminal can copy the files in instead (step 6). | For an AI agent making a page for someone. The files below are served from https://susegad.asymmetrica.ai with cross-origin headers, so a draft can load them straight from the site. For a page that will go live, copy the files into the project and serve them from there (step 6, or download each one), so the page does not depend on this site. | Headers are true (`/packages/*` and `/registry/*` send `Access-Control-Allow-Origin: *`). But a live page that loads from us is tied to our uptime and sends its visitors' requests to our server, contrary to the for-teams promise and to the library's own "no tracking". "Everything below" is also not everything: only `/packages` and `/registry` carry the header; say "the files". |
| Step 1 | Choose a register ... | keep | Agent-facing, so the library's words are right. Warm is the default (tokens.css line 80: "warm unless a data-register says otherwise"). True. |
| Step 2 | Load the fonts and tokens ... | keep, add after the two links: "These load from this site; for a live page, copy them and the fonts folder next to your page." | Fonts live under `packages/tokens/fonts/` with the same header; copy them together or the font URLs break. |
| Step 3 | Add a scene ... `label="<what it shows, in words>"` | keep | `label` is a real attribute of `<sg-scene>` (paus.prompt, scene-element). |
| Step 4 | For a whole page, start from a recipe ... | keep | |
| Step 5 | For a control ... Each one is a native HTML element first, with its behaviour and skin added on top, so the page still works with no JavaScript. | For a control ..., read the component's docs below. Each one is a native HTML element first, with its behaviour and skin added on top, so it still works with JavaScript off (the tooltip's Escape key is the one known gap). | `docs/reference/accessibility.md` names exactly one gap. An agent told "always works" will not check. |
| Step 6 | With a terminal, `npx @susegad/cli add <name>` ... (`create` reaches npm with version 0.2.0 ...) | keep | Honest and specific. |
| Closing paragraph | Keep the words plain, warm and specific, in sentence case. Give every scene a label that says what it shows. Keep the page usable by keyboard and screen reader: ... | Add: "Tell the person, in plain words, how to put the page online, and ask for any detail you need (names, photographs, prices) instead of inventing it." | Reader one never sees this file; the agent is their only guide. "Instead of inventing it" matters for a business page: no invented prices or phone numbers. |

## 11. Konkani nav words (`konkani.core.js`): drafts, for the native reader

I have not rewritten these. Please do not publish them before a Goan reader has seen them. Each is marked for the same reviewer who will read `KONKANI-FOR-READER.md`.

| Key | Current (Devanagari / Romi) | English | Questions for the reader |
|---|---|---|---|
| `nav.showcase` | प्रदर्शन / Prodorxon | Showcase | The Devanagari is the Sanskritic "exhibition". Would a café owner in Goa say this, or is there a plainer Konkani word for "see what has been made"? Does the Romi spelling follow Goan Romi use (x for sh)? |
| `nav.for-teams` | पंगडां खातीर / Pongddam khatir | For teams | Is पंगड the usual word for a group, and does it suit "a business or a team"? The page's own kicker says "for businesses and teams"; would a word for business or organisation fit better? Check the double d in the Romi against the Devanagari ड. |
| `nav.developers` | डेव्हलपर / Developer | Developers | A loanword. Is that what Goan engineers say, or is there a Konkani word? The Romi form is plain English "Developer"; is that acceptable as Romi? Check the spelling of the Devanagari. |
| existing `nav.start` | हांगासून सुरू करचें / Hangasun suru korchem ("start from here") | now "Get started" | The English changed from "Start here"; the Konkani still means "start from here". Probably fine, but the reader may prefer a verb of beginning. |

Each link also carries `hreflang="en"`, since it opens an English page. Good.

## 12. Facts for the builder (could not settle, or need a decision)

1. **GIGW wording.** `docs/reference/accessibility.md` and `docs/contributing/conformance.md` rest the "GIGW 3.0 asks for WCAG 2.1 AA" claim on secondary sources and say the primary text was not verified. My get-2 sentence repeats it. Either read the guideline text (or ask someone who has) before this ships on a page for government buyers, or keep the line to "Built to WCAG 2.2 AA, which is a step beyond the 2.1 AA that India's GIGW 3.0 guidelines refer to" and put "as we read them" in the developer-facing page. The FAQ answer does not depend on it.
2. **"Nothing ties you to us / reports to anyone"** is only true after the files are copied. The home agent prompt, the showcase prompts and `llms-start.md` steps 2 and 3 lead an agent to load from our server by default. Decide whether the agent should copy files by default (my text assumes a draft may load from the site, a live page should not).
3. **`create` is not on npm yet** (0.2.0 is the owner's gate), but the home "Build it yourself" card said "One command makes a whole site". My text drops the promise from the card and keeps the note lower down. When 0.2.0 lands, the card can say "One command" again.
4. **`npx @susegad/cli skill --harness claude --global`** on Start: confirm the `skill` subcommand exists in the version a stranger gets from npm today (0.1.x).
5. **The View panel's words (`site.core.js`)**: the button's `aria-label` reads "View: warm register, theme matches this device" and the panel's legend reads "Register". They sit in the header above the first developer link on every page. Proposal: legend "Mood", aria-label "View: warm mood, theme matches this device", and the word "register" kept on developer pages. Not mine to edit; the check in the request should also look at the header, not only `<main>`.
6. **Showcase button and link names.** Seventeen identical "Make this with your agent" buttons and seventeen "How it is made" links have no per-item accessible name in the built HTML. Add the item title to `aria-label` (or `aria-describedby` to the card's `<h3>`). The poster links are `aria-hidden` and `tabindex="-1"`, which is right, but the card title link is then the only way to open the demo: keep it.
7. **Counts and coverage on `/developers`.** The shelf shows Components 61, the accessibility page says "53 of 53 components have their conformance table", and `packages/components` has 58 folders (some are not components). Confirm that "a conformance table for each component" holds for all 61, and that `/r/` serves the pieces named in "every piece". If not, say "the components".
8. **Accessibility twice in the header.** The nav lists "Accessibility" and the right-hand `bar-trust` link says it again. The request's nav had five items; this makes six plus the trust link. Probably keep only one, or give the trust link a different word ("Accessibility record").
9. **"Scenes" in the nav** is the one library word left for reader one. The request keeps it. If the owner would take a plainer word, "Drawings" is the candidate; the page title would stay "Scenes" for developers.
10. **"For teams"** vs the page kicker "for businesses and teams": the nav is the narrower word. Owner's taste.
11. **Marathi in the storybook** is English and Marathi (text and Sarvam voice). A Goan reader should confirm the Marathi, and decide whether a Konkani version is wanted before the showcase leans on it.
12. **The enquiry demo with JavaScript off** posts to `sent.html`. On Cloudflare static assets a POST to a static file may be refused; check on the preview host that the no-JS path shows the "no one received it" page rather than an error.
13. **Contact line** (`asymmetrica.ai`) is the owner's to confirm (request, Owner gates).
14. **Site shell and booking lines** were read from the READMEs, not from the running pages. A quick look at the demo before ship will settle "rooms, a way to book and an account menu".
15. The `show.group.site` key in the draft ("Whole sites") is not in the built words (`more` is); nothing to do, just a mismatch between the draft and the code.

## Standards checked

- No em dashes in any reader-facing string above or in the built strings (searched the diff).
- No marketing adjectives beyond the charter's own "beautiful and comfortable". "Boringly correct" (developers only) is the charter's phrase.
- No announced honesty or clarity in any new string (the words the charter bans for it are absent).
- No urgency.
- Sentence case throughout, including buttons and headings.
- Banned words above the first developer link on the home page (hero): none in `<main>`. In the header: "register" in the View panel (item 5).

## Counts

Strings changed: 40 (home 11, showcase 9, for-teams 10, developers 3, start 3, llms-start 4). The agent prompt, its button and its announcement are counted once although they appear on home and start. The three Konkani nav words are flagged for the native reader, not changed. Aria-label additions and the View panel wording are builder notes, not counted.

## Evidence

- copy standards: checked `apps/docs/words.core.js` (`audience`), `index.html`, `start.html`, `ideas.html`, `words/llms-start.md`, `konkani.core.js`, and the built pages at / , /showcase, /for-teams, /developers against the charter's copy standards and the banned-word list.
- facts sourced: MIT: `LICENSE`, charter ("MIT code; docs CC BY 4.0; fonts their own licences"). WCAG 2.2 AA and component tables: `docs/reference/accessibility.md` (53 tables; one known gap, tooltip 1.4.13 without JavaScript). GIGW: `docs/reference/accessibility.md` "GIGW 3.0", `docs/HANDOFF.md` (certification is for a site; secondary sources). Konkani: `docs/HANDOFF.md` ("first draft by a non-native writer", `gom-Deva`, `gom-Latn`), `packages/templates/event/README.md`. No build step: `docs/HANDOFF.md` line 7, `SKILL.md` ("No bundler"). Warm default: `packages/tokens/tokens.css` and `packages/tokens/README.md`. IST: `packages/components/event-card/event-card.docs.md` (`Asia/Kolkata`). Lakh and crore: `packages/core/intl.core.js`, `data-table`. Cross-origin headers: `apps/docs/headers.core.js` and `out/docs/_headers`. Phone checks: `docs/BROWSERS.md`. Sample/prototype status: READMEs of `booking`, `enquiry`, `file-upload`, `studio-home`, `site-shell`, `food-order`, `storybook-spread`. Network use in the pieces: grep of `packages/` for `fetch`, `sendBeacon`, `analytics` (form, player, narration reader and provider, storybook demo, service workers, CLI registry).
- language review: `nav.showcase`, `nav.for-teams`, `nav.developers` (Devanagari and Romi), plus the unchanged `nav.start` meaning; the Marathi in the storybook narration. No kin terms in this delivery.
