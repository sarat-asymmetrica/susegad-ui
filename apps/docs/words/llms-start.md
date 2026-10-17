## Start here

For an AI agent making a page for someone. The files below are served from https://susegad.asymmetrica.ai with cross-origin headers, so a draft can load them straight from the site. For a page that will go live, copy the files into the project and serve them from there (step 6, or download each one), so the page does not depend on this site.

1. **Choose a register** and put it on the root element: `<html lang="en" data-register="warm">`. Warm is the default and suits most small businesses (homestays, cafés, studios). Choose quiet when money, compliance or a serious buyer is on the page; choose playful only when the person asks for joy (a festival, a children's page).
2. **Load the fonts and tokens** in the head, and use the tokens' colours and type rather than raw values:
   `<link rel="stylesheet" href="https://susegad.asymmetrica.ai/packages/tokens/fonts.css">`
   `<link rel="stylesheet" href="https://susegad.asymmetrica.ai/packages/tokens/tokens.css">`
   These load from this site; for a live page, copy them and the fonts folder (`packages/tokens/fonts/`) next to your page.
3. **Add a scene** (a drawing made in code) where a picture helps: `<script type="module" src="https://susegad.asymmetrica.ai/packages/scenes/<name>/index.js"></script>` and `<sg-scene name="<name>" label="<what it shows, in words>"></sg-scene>`. The scenes are listed under "Scenes" below; each scene's page on the site has the exact lines under "Use this scene". A scene rests when it is off screen and shows a still under reduced motion by itself.
4. **For a whole page, start from a recipe** (a booking, an enquiry, a menu with WhatsApp orders, an event's programme, speakers and venue, a proposal). Read the recipe's docs below: they name its files and markup. The showcase, https://susegad.asymmetrica.ai/showcase, shows each one running.
5. **For a control** (a form field, a dialog, a badge, a ticket, a consent notice), read the component's docs below. Each one is a native HTML element first, with its behaviour and skin added on top, so it still works with JavaScript off (the tooltip's Escape key is the one known gap).
6. **With a terminal**, `npx @susegad/cli add <name>` copies a piece and everything it depends on into the project, and `npx @susegad/cli create my-site` makes a whole site from a template (`create` reaches npm with version 0.2.0 of the CLI; until then, run it from a clone of the repository). `SKILL.md` in the repository (https://github.com/sarat-asymmetrica/susegad-ui/blob/main/SKILL.md) is the full guide for an agent working in code.

Keep the words plain, warm and specific, in sentence case. Give every scene a label that says what it shows. Keep the page usable by keyboard and screen reader: the pieces do their part, so do not take away their labels or native elements. Tell the person, in plain words, how to put the page online, and ask for any detail you need (names, photographs, prices) instead of inventing it.
