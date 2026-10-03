// Rebuilds three.named.js from the pinned three in node_modules (see PROVENANCE.md). From the repo's root:
//   node packages/stage3d/vendor/build.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const version = JSON.parse(readFileSync('node_modules/three/package.json', 'utf8')).version;
if (version !== '0.186.1') throw new Error(`three ${version} is installed; the vendored build is pinned at 0.186.1`);
const banner = `// three ${version} (MIT), only the names in three-entry.js. Built by esbuild; see PROVENANCE.md. Do not edit.`;
const r = await build({
  entryPoints: ['packages/stage3d/vendor/three-entry.js'], bundle: true, format: 'esm', minify: true, target: 'es2022',
  legalComments: 'none', banner: { js: banner }, write: false,
});
const out = r.outputFiles[0].contents;
writeFileSync('packages/stage3d/vendor/three.named.js', out);
console.log(`${out.length} bytes minified, ${gzipSync(out).length} gzip, sha256 ${createHash('sha256').update(out).digest('hex')}`);
