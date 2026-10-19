# 0028: what an offline copy may hold

*8 October 2026, by the maintainers. Status: proposed, for the maintainers to accept.*

An event site is read in lifts, in halls with poor signal and on a ferry. A visitor who has opened their ticket once should be able to open it again at the door with no connection. That needs a service worker, and a service worker keeps copies of things on a person's phone, so what it may keep has to be settled before it is written. This is the rule, and `packages/recipes/offline` follows it.

## What it keeps

Only the site's own static files, and only the ones a page of the site needs to draw itself:

| Kept | Why |
|---|---|
| the site's pages (a folder or an `.html` file) | the event page, in each language, and the offline page |
| styles and scripts (`.css`, `.js`, `.mjs`) | the page cannot draw or run without them |
| fonts (`.woff2`, `.woff`) | the page reads in its own faces, including Devanagari, not a fallback |
| pictures (`.avif`, `.webp`, `.jpg`, `.png`, `.svg`, `.ico`) | the poster and the marks the page is drawn with |

A file is kept only when **all** of these hold:

1. the request is a **GET**;
2. it is to the **site's own address** (the same origin), and inside the folder the worker covers;
3. it is one of the kinds above (so never a data file, a download, audio or video, or a path with no recognised kind: `/api/...`, `/register`, `data.json`);
4. the response **worked** (a 2xx), came from the site itself (type `basic`, never `cors` or `opaque`), and does **not** say `no-store` or `private` in `Cache-Control`.

Anything that fails a rule is **not answered by the worker at all**: it goes to the network exactly as if no worker were installed.

## What it never keeps

- **Anything from another address**: a font service, a script from a CDN, an analytics call, a map tile. A site that wants one of these offline brings it onto its own address first, and answers for it.
- **A response to a form, a login or an API**: POST, PUT and every non-GET request are never touched.
- **Personal data.** No response the worker keeps holds a person's details. The visitor's own ticket (their name, the event, the time and an id) is **not in the cache**: it is made on their device, kept in the device's `localStorage`, and drawn into the page by script from there. The cache holds the page that draws a ticket, never a ticket. A site whose server renders a person's details into a page must send `Cache-Control: private` or `no-store` on it (rule 4 then keeps it out), and should leave that page outside the folder the worker covers.
- **An email address.** The sample ticket holds no email address at all; the registration form sends nothing to any server.

## Where it lives

On the visitor's device only: the browser's Cache Storage for the site, and `localStorage` for the ticket. Nothing is sent to anyone. The visitor can remove both at any time from the browser's site settings.

## How long things are kept, and how to remove them

| What | Kept until | How to remove it |
|---|---|---|
| The visitor's ticket (`localStorage`) | The seventh day after the event's day, read in IST: on that day it is deleted by itself, the next time the page is opened. A ticket for an event on 21 November is kept through 27 November and is gone on 28 November. | The **Forget this ticket** button on the ticket, at any time; or the browser's site settings. |
| The kept pages and files (Cache Storage) | Until a new version of the worker takes over, which deletes them (see "Old copies"); or until the visitor clears the site's data. | The browser's site settings. |

Nothing the worker keeps is ever sent anywhere, so there is nothing to remove from a server.

## No script, no registration

The registration form is made to do nothing without script: its Register button is written `disabled` in the HTML and script enables it, and a line inside `<noscript>` says registering needs JavaScript. A browser with script off therefore cannot send a person's details anywhere, even though the form's own `method` and `action` are left as they are for a site to point at its own server. The ticket, and so everything this decision keeps, only exists where script runs.

## How a first visit becomes enough

A worker installed during a first visit did not see that visit's own requests, so it would keep nothing the page had already loaded. The page therefore waits until it has loaded and the browser is idle, registers the worker, and tells it which files it used (from `performance.getEntriesByType('resource')`). The worker checks each against the rules above before it keeps it. A page of the site, on its first visit, is kept and opens again with no connection.

## How it answers

- **A page:** the network first, so a visitor online always sees the latest; if the network fails, the copy kept from the last visit; if there is none, the **offline page** in the language of the page they asked for.
- **A file the page needs:** the kept copy first; the network fills the cache the first time.
- **Everything else:** not answered.

## Old copies, and how updates arrive

The cache's name carries a version. When a new worker wakes, it deletes every cache that starts with the recipe's prefix and is not its own version. The event template makes that version from a hash of every file the worker may keep, each time `pages.mjs` runs, so any change to a page, a style, a script, a font or a picture gives the worker a new version and nothing is bumped by hand. A visitor gets the new files on their next visit after the worker has updated: the browser checks the worker when a page is opened, installs the new one, and the new files are served from then on.

## Authority

A service worker anywhere outside this recipe needs a decision of its own. Inside this recipe, following this decision, it needs none: it keeps no more than the rules above, and the rules are tested (`packages/recipes/offline/offline.test.js` runs the generated worker against a fake scope and fails if it keeps a POST, another address, a data file or a `no-store` response).

## Not decided here

- **Background sync, push and periodic updates.** A worker that sends or receives anything while the page is closed is a different decision, with its own privacy questions. This one has none.
- **Keeping the ticket across browsers or devices.** It needs a server and an account; payment and confirmation, a later piece, takes it up.
- **A legal read.** What a site may keep on a visitor's device is a matter of its own law and its own words; the recipe keeps no more than the visitor's own ticket, but the site's lawyer reads this note with the consent notice.
