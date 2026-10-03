# three.js, vendored and shaken

`three.named.js` in this folder is an ESM build of three.js (MIT, `LICENSE`, copied unchanged from the npm package) that contains only the names `three-entry.js` exports. `loadThree()` in `../stage3d.js` imports the whole of `three`, which is 745,430 bytes minified (192,931 gzip, 156,241 brotli). The 16 names `<sg-depth-photo>` uses are 529,270 bytes (133,146 gzip); with the nine the turning pot adds (a lathe, a torus, a tube, two lights and a group) the build is 538,181 bytes (135,588 gzip); a page that hands this build to `setThreeLoader()` downloads that instead. `WebGLRenderer` carries most of three, so shaking saves about 30%, not most.

| | |
|---|---|
| Source | the npm package `three` at exactly 0.186.1 (decision 0017), from this repo's `node_modules` |
| Entry | `three-entry.js` (25 names: 16 for the depth photo, 9 for the pot) |
| Bundler | esbuild 0.28.2 (this repo's dev dependency) |
| Built | 29 September 2026, on Windows |
| Output | 538,181 bytes minified; 135,588 bytes gzipped (529,270 and 133,146 with the first 16 names) |
| sha256 | `dac770d49fa5b9b65008091e43dafb9e7053737ea4879761937a69e42e166a0c` |

The command, from the repo's root (it does what `build.mjs` does, and prints the size and the hash):

```sh
node packages/stage3d/vendor/build.mjs
# which is: esbuild packages/stage3d/vendor/three-entry.js --bundle --format=esm --minify --target=es2022 --legal-comments=none --banner:js="// three 0.186.1 (MIT), only the names in three-entry.js. Built by esbuild; see PROVENANCE.md. Do not edit."
```

Nothing in `three.named.js` is edited by hand. To add a name: add it to `three-entry.js`, rebuild, update this table and the sizes above, run the stage checks, and take a perf reading. `build.mjs` refuses to run unless the installed three is 0.186.1, so an upgrade of three is a deliberate change with its own ledger entry (decision 0017).

Use it:

```js
import { setThreeLoader } from '../stage3d.js';
setThreeLoader(() => import('./vendor/three.named.js'));   // before the first <sg-depth-photo> starts
```
