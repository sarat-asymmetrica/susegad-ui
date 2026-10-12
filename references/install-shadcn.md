# Installing through shadcn

Susegad UI also publishes a shadcn-compatible view of its registry, for projects that already use `npx shadcn add`. The `susegad` CLI stays the first choice: it knows the tree, tracks your edits in `susegad.json`, copies fonts and audio, and tells you what to put on the page. Use the shadcn route when shadcn is what the project already has.

The view is generated from `registry/registry.json` (our own schema stays the source of truth) by `registry/shadcn.mjs`: an index (`registry.json`, in shadcn's registry schema) and one `<item>.json` per item with every text file's content inlined. It is never committed. The docs build (`node apps/docs/build.mjs`) writes it to `/r/` in its output, so the address of an item is `https://susegad.asymmetrica.ai/r/<item>.json`, and `node registry/build.mjs --check` builds it in memory and fails if it is malformed or a `registryDependency` names no item.

## What you need in the project

shadcn insists on a project it recognises. A plain HTML or JS project needs three small files before the first `add` (shadcn 4.21, October 2026; without them it asks to create `components.json`, then stops with "Couldn't find tsconfig.json"):

```json
// package.json
{ "name": "p", "private": true }
```

```json
// components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york", "rsc": false, "tsx": false,
  "tailwind": { "config": "", "css": "styles.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" }
}
```

```json
// jsconfig.json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./*"] } } }
```

`tailwind.css` must name a file that exists; an empty `styles.css` will do. Susegad UI does not use Tailwind and shadcn does not touch that file for these items.

## Install

```sh
npx shadcn@latest add https://susegad.asymmetrica.ai/r/button.json        # a component
npx shadcn@latest add https://susegad.asymmetrica.ai/r/scene-paus.json    # a scene
```

An item's `registryDependencies` are URLs, so shadcn fetches what it needs: `scene-paus` pulls `core`, `engine`, `tokens`, `core-sheet` and `core-movable`; `button` pulls `core`, `core-component`, `engine` and `tokens`. Files land at the project root as `susegad/<path>`, the same tree the CLI writes (default `src/lib/susegad/` there; here `./susegad/`), so relative imports between pieces resolve. Then use the page snippet in the item's prompt (`susegad/scenes/paus/paus.prompt.md`) or the one in [`SKILL.md`](../SKILL.md): load `core/index.js`, the item's own module and its CSS, and `<sg-scene name="paus">`.

**npm pins are yours to install.** `depth-photo` and `stage3d` need `three@0.186.1`. The view does not list it as a shadcn `dependency`: with it, `npx shadcn add .../depth-photo.json --yes` hung for us (no output, 500 s, three tries across two people) while it ran the package manager. Run `npm i three@0.186.1` yourself; the pin is in the item's `meta.npmDependencies` and its `docs` line.

## What differs from the CLI

- **Fonts and audio are not carried, so do not link `susegad/tokens/fonts.css` after a shadcn install:** it names `.woff2` files that are not there and the page logs 404s. The tokens' own CSS (colours, spacing, motion) is carried and fine; text uses system fonts. To get the real faces, run `npx @susegad/cli add tokens` (it brings the `.woff2` files; link `fonts.css` after that). Details: A shadcn item is JSON text, so binary files (the `.woff2` faces under `tokens`, `.wav` clips) are left out and listed in the item's `meta.binaryFiles`; its `docs` line says so. Without the faces, text falls back to system fonts. Run `susegad add tokens` (or copy `packages/tokens/fonts/` from the repo) to get them.
- **No lockfile.** shadcn does not write `susegad.json`, so `susegad diff` has nothing to compare against. Re-running `add` skips files that exist; pass `--overwrite` to replace them.
- **Targets start with `~/`.** shadcn rewrites the first `src/` in a target (it turned `engine/src/noise.js` into `engine/noise.js` and broke the imports), but leaves `~/`-rooted targets, the project root, alone. If you want the pieces elsewhere, move the `susegad/` folder as a whole.
- **Types.** components are `registry:component`; scenes and recipes `registry:block`; packages `registry:lib`; the surface `registry:theme`. Every file is `registry:file`, because none of these are React and there is no `ui` alias to resolve against. The real Susegad type is in `meta.susegadType`.
- **Templates are not offered.** `susegad create` starts a template (a whole site, its pages and `package.json` at the folder's root), and shadcn would offer to overwrite a project's own files with them, so the shadcn view leaves them out.
- **No `cssVars`.** Tokens ship as CSS files (`:root` custom properties and `@font-face`) and are copied as they are.

## Building the view for a local server

The view points at `https://susegad.asymmetrica.ai/r`. To serve it from your own host, write it somewhere with that base:

```sh
node registry/build.mjs --out /tmp/idx.json --shadcn-out ./r --base-url http://localhost:8765/r
```
