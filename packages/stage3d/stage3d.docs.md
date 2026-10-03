# Stage3d

The three.js tier (decision 0017). Core, engine, tokens and components never import three; a stage3d element does, through this module, and only when it will draw live.

## Install

```sh
node <path-to-susegad-ui>/packages/cli/bin/susegad.mjs add depth-photo   # brings stage3d with it
npm install                                                               # add wrote three 0.186.1 into package.json
```

`susegad add` puts three into your package.json for you (its manifest declares `npmDependencies`). It is pinned exactly: three changes its API most months.

Then either let your bundler resolve `import('three')`, or give the page an import map:

```html
<script type="importmap">{ "imports": { "three": "/node_modules/three/build/three.module.js" } }</script>
```

Or load it from anywhere with `setThreeLoader(() => import('/vendor/three.js'))`.

## API

| Export | What it does |
|---|---|
| `loadThree()` | three's namespace, loaded once; resolves `null` if it cannot load (one console warning). |
| `setThreeLoader(fn)` | Replace the loader. |
| `webglAvailable()` | WebGL2, tested once. |
| `liteDevice()` | Save-Data, or 1 GB of memory or less. |
| `watchVisible(el, cb)` | `cb(visible)` as the element enters and leaves the viewport or the tab hides; returns an unwatch. |
| `decoded(src)` | An image loaded and decoded, as a fixed-size `ImageBitmap` (an `<img>` with a `srcset` can change size under a texture). |
| `chooseTier({ webgl, three, motion, lite, forced })` | `'live'`, `'2d'` or `'still'`. Pure. |
| `depthToZ`, `reproject`, `projectPoint`, `coverWindow`, `cameraAt`, `follow`, `parseVec` | The camera maths. Pure. |

## The tiers

| Tier | When | Downloads three |
|---|---|---|
| `live` | WebGL2, three loaded, motion allowed (warm or playful, no reduced motion), not a lite device | yes |
| `2d` | quiet, reduced motion, Save-Data, 1 GB or less, no WebGL, three failed | no |
| `still` | forced, or the images failed to load | no |

## Bytes

A page with no live 3D pays nothing for three. `packages/stage3d/stage3d.check.mjs` proves it from the request log: scene pages, the docs home, and the depth photo in quiet, under reduced motion and without WebGL request nothing from `/node_modules/three`, and a control run on the live tier must see three requested.

What three costs when a page does use it, bundled and minified by esbuild 0.28.2 (measured on 29 September 2026 for the veranda staged in 3D):

| What is bundled | Minified | gzip | brotli |
|---|---|---|---|
| `import('three')`, the whole module, as `loadThree()` does today | 745,430 B | 192,931 B | 156,241 B |
| only the 16 names `depth-photo.gl.js` uses (`WebGLRenderer`, `Texture`, `ShaderMaterial`, `PerspectiveCamera` and the rest), tree-shaken | 529,357 B | 133,181 B | 109,570 B |
| `depth-photo.gl.js` on its own, minified | 11,422 B | | |

`WebGLRenderer` carries most of three, so naming imports saves about 30%, not most of it. A page that ships the named-import bundle through `setThreeLoader()` gets the smaller figure. The tier's own code stays in its declared budget: `stage3d` 10,076 of 12,288 bytes, `depth-photo` 45,800 of 46,080.
