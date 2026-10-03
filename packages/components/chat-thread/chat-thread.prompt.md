# Chat thread

*A conversation shown as text instead of a screenshot: a client's messages on a case study, a support transcript, what guests asked before they booked.*

A screenshot of a chat is a picture of words: a screen reader can't read it, it can't be searched, and the phone numbers in it are there for anyone to zoom into. This is the same conversation as a list.

```html
<link rel="stylesheet" href="susegad/components/chat-thread/chat-thread.css">
<script type="module" src="susegad/components/chat-thread/chat-thread.js"></script>

<sg-chat-thread>
  <ol aria-label="A conversation with Aldona Organics">
    <li class="sg-chat-day"><time datetime="2026-03-04">4 March 2026</time></li>
    <li data-from="them"><span class="sg-chat-who">Maya, Aldona Organics</span>
      <p class="sg-chat-text">Can we move the shoot to Friday?</p>
      <time class="sg-chat-time" datetime="2026-03-04T10:12">10:12</time></li>
    <li data-from="me" data-status="read"><span class="sg-chat-who">Studio</span>
      <p class="sg-chat-text">Friday works.</p>
      <time class="sg-chat-time" datetime="2026-03-04T10:31">10:31</time></li>
  </ol>
</sg-chat-thread>
```

## The prompt

Make a web component that shows a chat conversation as real text. The markup is an ordered list with a name; each message is a list item with the sender, the words and a `<time>`, and a date divider is a list item holding a date. Without JavaScript it must read as a ruled transcript. Take phone numbers, emails and names out before the HTML exists, in a pure function a build step calls, and put a visible marker in their place that says what was removed, so the original text is never in the page. Give it three registers. Quiet: a court record, every message on its own row, the speaker in small capitals, the time at the end, hairline rules between rows; on a narrow screen the speaker and time share a line above the words. Warm: speech on paper, each message in a hand-inked bubble with a small tail on the speaker's side, drawn twice like a nib going round, fitted to the message's measured size. Playful: bright bubbles, mine in the accent colour, theirs in the highlighter, and each one bounces a little as it scrolls into view, once, never under reduced motion. In a run of messages from one person, hide the repeated name from the eye only. Show sent, delivered and read ticks as decoration only. A reply quotes the earlier message inside its bubble as a blockquote that begins with visually hidden words, "Replying to:", then who said it and two lines of what they said: in quiet an indented quote with a ruled edge, in warm a snippet in a pencil bracket, in playful a tinted inset with an accent bar. A reaction is one emoji in a small chip, `role="img"` with a label such as "Reacted with a heart" and the emoji itself hidden, so it is read once as words; in quiet it sits under the words, in warm and playful on the bubble's lower edge on the speaker's side, with room kept under the bubble so it never covers the next message.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| an ordered list with a name | native first | `<ol aria-label>`; the element names it from `label` (or "Conversation") when the markup doesn't. |
| before the HTML exists | build-time redaction | `redact()`, `redactHtml()` and `renderThread()` in `chat-thread.core.js` return runs where a redacted run keeps only its kind. The original characters are dropped in Node, so no CSS or script can reveal them. `leakIn()` warns in the browser if a marker still holds digits, an @ or a sentence. |
| a court record | CSS grid | Three columns (speaker, words, time) with a hairline under each row; a container query folds it to two at 30rem. |
| hand-inked bubble … fitted to the measured size | noise, SVG | `bubbleOutline(w, h, seed, { side, tail })` resamples a rounded rectangle with a tail every 5 px and pushes each point out by seeded Perlin noise; two passes, the second fainter. A ResizeObserver redraws only when a bubble's size changes. |
| bounces a little … once | Web Animations, IntersectionObserver | `arrival(motion, order, from)` returns keyframes (transform and opacity only) at full motion, null otherwise. Each message animates the first time it is 20% in view; a batch is staggered and capped. |
| hide the repeated name from the eye only | visually hidden | `runs()` marks the second message of a run `data-run="continue"`; warm and playful clip its name to 1 px, so it is still read aloud. |
| begins with visually hidden words, "Replying to:" | a named quote | `blockquote.sg-chat-reply` with a clipped `.sg-chat-sr` span; the element adds it if the markup didn't. The check reads Chromium's accessibility tree and finds "Replying to: Maya, Aldona Organics Can we move…". |
| read once as words | role="img" | `reactionLabel(emoji)`; the emoji sits in an `aria-hidden` span, because Chromium exposes an image's text children. The check counts one "Reacted with a heart" and no emoji text. |
| never covers the next message | layout | `li:has(> .sg-chat-reaction) { margin-bottom }`; the check compares the chip's box with every other message and its own words, time and quote at 1280 and 390 px. |
| ticks as decoration only | CSS mask | `data-status="sent|delivered|read"` draws a tick on an empty `::after`, with nothing for assistive technology to read. |

## Accessibility

- A named ordered list; every message carries its sender's name in the DOM.
- Redaction markers are text ("number removed"), so everyone learns the same thing.
- Nothing in the thread is focusable except the builder's own links.
- The bounce runs only at full motion (playful, no reduced motion) and never hides a message before it arrives.
- Forced colours: bubbles get a system-colour border; ticks and redaction bars stay visible.
