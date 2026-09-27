// Folio build: one ES module for the whole document. Every <script type="module">
// (with a src, or inline) becomes one virtual module, imported in page order, so
// shared code (core, the engine) is included once and runs once.

import * as esbuild from 'esbuild';
import { dirname, join } from 'node:path';

/**
 * @param {{ file?: string, code?: string, dir: string }[]} scripts  module scripts in page order
 * @param {string} root  where root-absolute imports (/packages/...) resolve
 * @returns {Promise<{ code: string, warnings: string[] }>}
 */
export async function bundleModules(scripts, root = process.cwd()) {
  const entry = scripts.map((_, i) => `import 'folio:script-${i}';`).join('\n');
  const plugin = {
    name: 'folio-scripts',
    setup(build) {
      build.onResolve({ filter: /^folio:script-\d+$/ }, a => ({ path: a.path, namespace: 'folio' }));
      // /packages/... is the repo root, as the dev server and the builder read it
      build.onResolve({ filter: /^\// }, a => ({ path: join(root, a.path) }));
      build.onLoad({ filter: /.*/, namespace: 'folio' }, a => {
        const s = scripts[+a.path.split('-').pop()];
        return s.file
          ? { contents: `import ${JSON.stringify(s.file)};`, resolveDir: dirname(s.file), loader: 'js' }
          : { contents: s.code, resolveDir: s.dir, loader: 'js' };
      });
    },
  };
  const out = await esbuild.build({
    stdin: { contents: entry, resolveDir: process.cwd(), loader: 'js' },
    bundle: true, format: 'esm', target: 'es2022', write: false, minify: true,
    charset: 'utf8', legalComments: 'none', logLevel: 'silent', plugins: [plugin],
  });
  return { code: out.outputFiles[0].text, warnings: out.warnings.map(w => `${w.location?.file ?? ''}:${w.location?.line ?? ''} ${w.text}`) };
}
