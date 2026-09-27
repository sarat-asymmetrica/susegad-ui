# 0008: recipes live in packages/recipes/<name>/

*Sutradhar, 24 September 2026, Wave 1. Status: accepted. Proposed by the CLI Karigar.*

Recipes are copied into a builder's project like any other item. If they lived in `recipes/`, their imports (`../../packages/...`) would have to be rewritten on copy, and a copied file would no longer be byte-identical to the registry's, which breaks hashes, `diff`, overwrite protection and `--check`.

Decision:
- Recipes live in `packages/recipes/<name>/` with `type: "recipe"` in their `registry.json`, and import siblings as `../../<package>/...`, exactly like components.
- `registry/build.mjs` checks that every relative reference in a copied file (JS imports, CSS `url()` and `@import`, HTML `src`/`href`) resolves to a file copied with it or with a dependency. The build fails otherwise.
- A recipe's `index.html` is copied and must work in a builder's project: it links `../../tokens/fonts.css` and `../../tokens/tokens.css` relatively and does not load anything from `/tools/`. It may read `?register`, `?theme` and `?palette` from the URL with a few inline lines, which is useful to builders and lets the tools drive it. Component `demo.html` pages are not copied and keep using `tools/harness/demo.js`.
- The top-level `recipes/` folder from GOAL.md §1 is not used.
