# 0014: the diagram's pure core may be 26 KB

*Sutradhar, 24 September 2026, Wave 3. Status: accepted. Proposed by karigar-proposal with Rasika's FB1 fix.*

Decision 0010 gives a component's pure core (`*.core.js`, no DOM, tested in Node) 12 KB. The diagram's core, `packages/folio/diagram/diagram.core.js`, is 25.1 KB. It holds:
- the line grammar and its line-numbered errors;
- the layered layout;
- loop-back routing that avoids every box but its own two ends;
- label placement that keeps each label nearer its own line than any other, with numbered badges when no clear spot exists;
- the text alternative;
- the measuring and clash helpers the tests and checks use.

FB1 showed that a diagram whose labels or lines mislead is worse than no diagram. The layout is the component, and it's the part that needs to be pure and tested.

Decision: `diagram.core.js` may be up to **26 KB** (26,624 bytes), declared in `folio-diagram`'s manifest with the reason. This is a named exception for the diagram, not a new general allowance. Growth past it needs a new decision, and the first thing to try is splitting the layout into its own module.
