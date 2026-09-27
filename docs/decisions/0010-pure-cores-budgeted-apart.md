# 0010: a component's pure core is budgeted apart from its element

*Sutradhar, 24 September 2026, Wave 2. Status: accepted.*

The date range picker has a 12.9 KB element and a 7.6 KB pure core (`date-range.core.js`: picking, turnover, APG grid moves, labels, season runs), which runs in Node and is fully tested. Counting both as "behaviour" against one 12 to 16 KB figure (0005, 0009) punishes exactly the separation the charter asks for: a pure core with tests.

Decision: a component's `*.core.js` (pure, no DOM, tested in Node) has its own allowance of 12 KB. The element file keeps 12 KB, or up to 16 KB with a reason (0009). Skins keep 8 KB each; a shared skin helper counts as one skin. `budget.jsBytes` in the manifest stays the declared total, and `budget.reason` lists the parts.
