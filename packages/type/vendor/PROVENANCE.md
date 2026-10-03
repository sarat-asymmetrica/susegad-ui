# Pretext, vendored

`pretext.js` in this folder is an ESM build of Cheng Lou's Pretext (`@chenglou/pretext`), MIT licensed (`LICENSE`, copied unchanged from the source). Decision 0019 pins it to `main`, not to npm 0.0.9, for its browser-exact line breaking, until a release on npm contains the same work.

| | |
|---|---|
| Source | https://github.com/chenglou/pretext |
| Commit | `e73081fc409c49eaff47f58908abd73995c380cd` (27 September 2026) |
| Entry | `src/layout.ts` (the plain-text API; `rich-inline` is not included) |
| Bundler | esbuild 0.28.2 (this repo's dev dependency) |
| Built | 28 September 2026, on Windows, from a clean checkout at the commit above |
| Output | 112,443 bytes minified; 55,941 bytes gzipped |
| sha256 | `058d95234605e3a8ba51559b8140dda7901a7e59494057ebc61ff80915732646` |

The command, run from this repo's root with the Pretext checkout at `C:\Projects\pretext`:

```sh
npx esbuild C:/Projects/pretext/src/layout.ts --bundle --format=esm --minify --target=es2022 --legal-comments=none "--banner:js=// @chenglou/pretext at e73081fc409c49eaff47f58908abd73995c380cd (MIT). Built by esbuild; see PROVENANCE.md. Do not edit." --outfile=packages/type/vendor/pretext.js
```

Nothing in the file is edited by hand. To upgrade: check out the new commit (or install the npm release), rebuild with the same command, update this table, run `npm test` and the scenes' checks, take a perf reading, and record it in the ledger (decision 0019, Consequences).

Exports used by the tier (`../layout.js`): `prepareWithSegments`, `layoutNextLineRange`, `materializeLineRange`, `measureLineStats`. The rest of Pretext's plain-text API is exported too (`prepare`, `layout`, `layoutWithLines`, `layoutNextLine`, `walkLineRanges`, `measureNaturalWidth`, `clearCache`, `setLocale`).
