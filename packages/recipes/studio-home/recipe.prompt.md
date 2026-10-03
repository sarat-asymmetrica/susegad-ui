# Studio home

*The home page of a one-person software studio: who it is, what it's doing now, the work, what a client said, how to get in touch.*

## The prompt

Build a static home page for a small studio from the library's pieces, in the page's register. A site nav with the home page marked current. An introduction beside a now note, with the availability as a badge and the date it was last updated. A grid of postcards for the work, each one link, with where and when and Live, Shipped or Experiment as a badge beside them. What a client said as a quote, with its link going to the voice note it came from, beside the conversation it came from as a chat thread, redacted at build time, with the voice note as a message. A reach block to say hello, with email and WhatsApp links built at build time. Mark every piece of copy that isn't real as placeholder. It must read in full without JavaScript, pass axe in every register and theme, never play a sound before a press, and never scroll sideways on a phone.

## Words to code

| When you say | Piece |
|---|---|
| a site nav with the home page marked current | `sg-site-nav`, `aria-current="page"` |
| a now note … a badge … the date | `sg-now-note`, `sg-badge` |
| postcards … one link … as a badge | `sg-postcard`, `sg-badge` on `.sg-postcard-where` |
| a quote, with its link going to the voice note | `sg-quote`, `a.sg-quote-source href="#voice"` |
| a chat thread, redacted at build time, with the voice note as a message | `renderThread()`, `sg-chat-thread`, `sg-voice-note` |
| email and WhatsApp links built at build time | `waLink()`, `mailtoLink()`, `sg-reach` |
