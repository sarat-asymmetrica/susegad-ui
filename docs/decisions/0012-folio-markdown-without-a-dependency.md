# 0012: Folio Markdown is our own small parser, with no dependency

*Karigar (core), 24 September 2026, Wave 3. Status: accepted by the Sutradhar.*

Folio documents are written in Markdown with directives (`::scene{...}`, `:::note ... :::`). The obvious dependencies were a CommonMark parser (markdown-it or micromark) plus a directive extension (remark-directive and the unified stack).

Decision: `packages/folio/md/` is a small parser of our own: 14.7 KB for the parser (parse.js) and 18.2 KB for the directives and the page (index.js), with comments, pure and tested in Node, with no dependency.

Why:
- **The directives are the point**, and they need what an extension would make awkward: a schema per directive, checked values (real dates, a departure after an arrival, known registers), and errors a writer can act on, all listed at once with line numbers ("line 5: ::price-table: departure must be after arrival"). With remark we would write most of this ourselves anyway, on top of a large stack.
- **The subset is small and known**: headings (ATX and setext), paragraphs, block quotes, nested and loose lists, fenced code, pipe tables with alignment, thematic breaks, raw HTML blocks; emphasis, strong, code spans, links (with balanced parentheses), images, autolinks, escapes and hard breaks. Writers of proposals and storybooks need no more.
- **Documents must stay honest under a strict policy**: table alignment is written as classes, not style attributes, and script URLs in links are refused. That is easier to guarantee in code we own.
- **It can be copied** into a builder's project like the rest of the library.

What it does not do, on purpose: reference-style links, indented code blocks, footnotes, inline HTML inside a paragraph (it is escaped), and full CommonMark edge cases (emphasis delimiter rules are simplified). If a document needs one of these, raise it and we will add it, with a test.

If the grammar grows past what a small parser handles well, the fallback is micromark with a directive extension, with our validation kept as a separate pass over its tree.
