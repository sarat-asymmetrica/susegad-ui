# Chat thread

`<sg-chat-thread>` shows a conversation as a list of messages instead of a screenshot. It enhances an `<ol>`.

## Use

Write the markup by hand, or build it (Astro frontmatter, a Node script) with `renderThread()`, which also redacts:

```js
import { renderThread } from './susegad/components/chat-thread/chat-thread.core.js';

const html = renderThread([
  { day: '2026-03-04' },
  { from: 'them', who: 'Maya, Aldona Organics', text: 'Call Rohan on +91 98765 43210', time: '2026-03-04T10:12' },
  { from: 'me', who: 'Studio', text: 'Will do.', time: '2026-03-04T10:31', status: 'read' },
], { label: 'A conversation with Aldona Organics', redact: { names: ['Rohan'] } });
```

The page then holds "Call <span class="sg-redacted">name removed</span> on <span class="sg-redacted">number removed</span>". The original is gone before the HTML is written. Never redact in the browser: by then the text has already been sent.

## Markup

| Element | What it is |
|---|---|
| `<ol aria-label>` | the conversation; one `<li>` per message or divider |
| `<li class="sg-chat-day"><time datetime>` | a date divider |
| `<li data-from="them|me" data-status="sent|delivered|read">` | a message; `data-status` draws ticks on my messages and the component adds the word ("Sent", "Delivered", "Read") inside the `<time>`, visually hidden ||me" data-status="sent\|delivered\|read">` | a message; `data-status` draws ticks on my messages, decoration only |
| `.sg-chat-who` | the sender's name |
| `.sg-chat-text` | the words; one or more `<p>` |
| `<time class="sg-chat-time" datetime>` | when it was sent |
| `.sg-redacted` | what was taken out, in words |
| `blockquote.sg-chat-reply` | a reply's quote of an earlier message: `<span class="sg-chat-sr">Replying to: </span><span class="sg-chat-reply-who">Maya</span> <span class="sg-chat-reply-text">…</span>`, before the words |
| `.sg-chat-reaction` | a reaction on this message: `<span class="sg-chat-reaction" role="img" aria-label="Reacted with a heart"><span aria-hidden="true">❤️</span></span>`, after the time |

`renderThread()` writes both from `reply: { who, text }` and `reaction: '❤️'` (the reply is redacted like the words). If the markup leaves out the "Replying to:" words, the role, the label or the hidden emoji, the element adds them: `reactionLabel()` names ❤️ 👍 😂 🙏 😮 😢 🎉 🔥 and says "an emoji" for the rest. The emoji is hidden because Chromium otherwise exposes it as text under the image, so it would be read twice.

Anything else in a message (an `<sg-voice-note>`, an image with alt text) sits under the words.

## Attributes

| Attribute | Values | Default |
|---|---|---|
| `label` | the list's name, if the `<ol>` has none | "Conversation" |
| `register` | `quiet`, `warm`, `playful` | inherited |

A server can append messages (htmx `hx-swap="beforeend"` on the `<ol>`); runs, bubbles and bounces follow.

## Registers

| | Look | Motion |
|---|---|---|
| quiet | a ruled transcript: speaker in small capitals, words, time | none |
| warm | hand-inked bubbles on paper, a tail on the first of a run | none |
| playful | bright bubbles, mine in the accent colour | a small bounce as each message comes into view, once |

| | A reply's quote | A reaction |
|---|---|---|
| quiet | an indented quote with a ruled edge | a small chip under the words |
| warm | a snippet in a pencil bracket, the name in the hand | a chip on the bubble's lower edge, on the speaker's side |
| playful | a tinted inset with a bar in the accent colour | the same chip |

A quote shows two lines of the earlier message; all of it is read aloud. A bubble with a reaction keeps room under it so the chip never sits on the next message.

Reduced motion: no bounce. Without JavaScript: the quiet transcript.

## Core exports

`redact(text, { phones, emails, names, labels })`, `redactHtml()`, `renderThread(items, { label, redact, register })`, `runs()`, `clockOf()`, `dayOf()`, `leakIn()`, `bubbleOutline()`, `arrival()`, `STRINGS`.

The phone pattern takes a leading + with 8 to 15 digits, or 10 to 15 digits without one, so dates, times, prices and order numbers stay.

## Accessibility

- Every message names its sender in the DOM; a repeated name is hidden from the eye only.
- Redaction markers say what was removed.
- Contrast for the playful bubbles (text and soft text on the highlighter, on-accent on accent) is tested for every palette and theme.

### Conformance (WCAG 2.2 AA)

| Criterion | Status | How it was checked |
|---|---|---|
| 1.1.1 Non-text content | Meets | The delivery ticks are CSS art, so each status is also said in words: the component puts a visually hidden "Sent", "Delivered" or "Read" inside `.sg-chat-time` (in `packages/components/chat-thread/chat-thread.js` for authored markup and `renderThread` in `chat-thread.core.js` for built markup). `packages/components/chat-thread/chat-thread.check.mjs`: "a delivered and a read message each say so in words to assistive technology" reads the message's accessibility tree (Playwright `ariaSnapshot`) in each register; it failed before the fix. The reaction (`role="img"` with "Reacted with a thumbs up"), the warm bubble outline and the redaction markers: "the heart is read once, as words, and the emoji itself is not read". |
| 1.3.1 Info and relationships | Meets | A named `<ol>` of `<li>`, with `<time datetime>`, a `<blockquote>` for a reply that begins "Replying to:" in text only a screen reader gets, and a sender name on every message. `chat-thread.check.mjs`: "every message names its speaker to a screen reader, including the second of a run" and "the reply is a quote that says what it is and whom it quotes". The delivery status is said in words inside the time (see 1.1.1). |
| 1.4.1 Use of color | Meets | A `read` tick is told from a `delivered` tick by shape and by words, not by colour: delivered is a bare double tick, read is a solid chip with the double tick cut out of it (`li[data-status="read"] > .sg-chat-time::after` in `packages/components/chat-thread/chat-thread.css`), and each is also said in words. `packages/components/chat-thread/chat-thread.check.mjs`: "a read tick differs from a delivered tick in shape, not colour alone" thresholds each tick's screenshot to an ink mask and compares the two: 0 percent of the ink differed on the old code (same shape, different colour), 83 percent now, in all three registers. Everything else (who spoke, a reply, a reaction, redaction) is in words or shape: "warm and playful hide a repeated name only visually (1 px box), quiet shows it". |
| 1.4.3 Contrast (minimum) | Meets | `packages/components/chat-thread/chat-thread.test.js`: "AA: <palette> <theme>: playful bubble text reads at 4.5:1" for every palette, light and dark. `chat-thread.check.mjs`: "axe, light, all three registers: 0 violations", the same in dark, and with JavaScript off. Quiet and warm text is `--sg-text` and `--sg-text-soft`, tested in `packages/tokens/tokens.test.js`. |
| 1.4.4 Resize text | Meets with author's part | Manual test, 2026-10-07: the demo with the root font size at 200 percent in three registers (1280 px wide), no sideways scroll, and every message in full except one thing: a quoted reply shows two lines of the quoted text and hides the rest (`-webkit-line-clamp: 2` on `.sg-chat-reply-text` in `packages/components/chat-thread/chat-thread.css`; at 320 px the demo's quote is cut from three lines to two). The quote is a preview of a message that is itself in the thread, and the full text stays in the accessibility tree, so the author keeps the quoted message on the page. |
| 1.4.10 Reflow | Meets | `chat-thread.check.mjs`: "at 390 px the page does not scroll sideways", and "at <width> px no reaction overlaps another message, its time, its words or its reply". Manual test at 320 CSS px, three registers, 2026-10-07: no sideways scroll and no element past the viewport. |
| 1.4.11 Non-text contrast | Meets | The reply rule and the reaction chip border are `--sg-rule-strong`, and the focus ring is `--sg-focus`, both tested 3:1 or more on every surface for every palette and theme in `packages/tokens/tokens.test.js`. The playful bubble text is tested in `chat-thread.test.js` (see 1.4.3). The delivery ticks are redundant with their words (1.1.1) and are drawn in the text colour, so they are not the only way to get the information. |
| 1.4.12 Text spacing | Meets | Manual test, 2026-10-07: the WCAG text-spacing values (line height 1.5, letter 0.12em, word 0.16em, paragraph spacing 2em) injected on the demo in three registers, no clipped or overlapping text and no reaction over a message (throwaway Playwright script). No check in the repository asserts it yet. |
| 4.1.2 Name, role, value | Meets | A list named by `label`, list items, a `role="img"` reaction with its words, and nothing to operate. `chat-thread.check.mjs`: axe with 0 violations in light and dark, in each register, and with JavaScript off. |

**The page author owns:**

- The messages, names and times, in the language of the page, and `lang` on a message in another language (3.1.2).
- Redaction: removing names and numbers before the HTML is written (`renderThread`), never in the browser.
- Keeping the quoted message on the page, since a reply quote shows only two lines of it.
- The colours the page sets behind the thread, if it overrides the tokens.
