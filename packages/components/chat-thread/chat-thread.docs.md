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
| `<li data-from="them\|me" data-status="sent\|delivered\|read">` | a message; `data-status` draws ticks on my messages, decoration only |
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
