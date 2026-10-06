# susegad

The Susegad UI command line. It copies pieces of the library into your project, where they become your code: change anything you like. Node 22 or later, no dependencies.

```sh
node packages/cli/bin/susegad.mjs list
node packages/cli/bin/susegad.mjs add scene-kolam
```

## Commands

| Command | What it does |
|---|---|
| `susegad list` | Everything on the shelf, grouped by type. |
| `susegad info <item…>` | Files, dependencies, registers, budget, and the prompt path. |
| `susegad add <item…>` | Copies the items and everything they depend on. |
| `susegad diff [item…]` | Which copied files differ from the registry, and why. With no items, checks everything you have added. |
| `susegad check [item…]` | The library's lighter gate for a change, in one command: the tier read from the diff, the lints (motif, canvas text, copy) and the evidence pack. With no items it takes the pieces your diff touches. Run it from the susegad-ui checkout; open the pack's contact sheet before you open a PR. |
| `susegad skill` | Installs Susegad UI's skill (SKILL.md and references/) for an agent harness, so the harness knows how to use the library. |

Options: `--dir <folder>` (default `src/lib`), `--registry <repo folder, index file, file: URL or https:// index URL>`, `--ref <commit, branch or tag>`, `--dry-run`, `--overwrite`, `--patch` (for diff), `--json` (for list and info). `susegad skill` takes `--harness <name>` (default claude), `--global` and `--dir`.

## Install from a commit

```sh
node ../susegad-ui/packages/cli/bin/susegad.mjs add enquiry date-range --dir public/vendor --ref main
```

`--ref` reads the registry as it was committed, never the working tree. The CLI runs `git archive` for the index and `packages/` at that commit, unpacks them into a temporary folder (with its own small tar reader), runs the command against that, and removes the folder. So uncommitted work in the library's checkout never reaches your project, and a stale index there never blocks you. It works with every command: `list`, `info`, `add` and `diff`. The registry has to be a git repository, and the commit has to include `registry/registry.json`. Files arrive exactly as committed, with no line-ending conversion.

## Over HTTP, and the live registry

`add` and `diff` work against an `http://` or `https://` registry the same way they work against a local one: `--registry https://susegad.asymmetrica.ai/registry/registry.json` and every file the index lists is fetched relative to that index's own base URL. Each file's `sha256` hash is checked against what the index recorded, and nothing is written unless every file matches; a mismatch names the file and refuses the whole command. A file the index lists but the server does not have is reported as missing rather than guessed at. `--dry-run`, `--overwrite` and the lockfile behave exactly as locally, so the same protections (your edits are never replaced without `--overwrite`) hold over the network too.

When no `--registry` is given, the CLI reads the index in the repo it lives in (`registry/registry.json`, built with `node registry/build.mjs`). If that file is not there (the CLI installed on its own, away from the repo), it falls back to the live registry at `https://susegad.asymmetrica.ai/registry/registry.json`. `--registry` overrides both.

## The skill command

```sh
susegad skill --harness claude --global
susegad skill --harness opencode            # this project's skills folder
susegad skill --dir somewhere/else          # where you want it, no table consulted
```

It copies the repo's `SKILL.md` and its `references/` folder into `<skills folder>/susegad-ui/`, and leaves an existing install alone unless you pass `--overwrite`.

The destinations come from a table in `src/harnesses.js`, and every path in it was checked against that harness's own documentation, which the entry cites:

| Harness | Without `--global` | With `--global` | Verified against |
|---|---|---|---|
| `claude` (default) | `.claude/skills/` | `~/.claude/skills/` | https://code.claude.com/docs/en/skills |
| `opencode` | `.opencode/skills/` | `~/.config/opencode/skills/` | https://opencode.ai/docs/skills/ |
| `hermes` | `.hermes/skills/` | `~/.hermes/skills/` | https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/ |
| `codex` | none | none | https://developers.openai.com/codex/guides/agents-md |

Codex reads `AGENTS.md` files, not a skills folder, so its entry is marked unverified and the command refuses to guess: it asks you for `--dir <folder>` instead. The rule is general: any harness without a documented skills folder gets an honest "I do not know" rather than a made-up path that happens to look right.

One limit: the skill lives in the library's checkout (its `SKILL.md` and `references/` beside the repo root), so `susegad skill` needs a clone or a checkout there. A tarball install that shipped without them says so plainly instead of failing mysteriously.

## Where files go

`packages/<path>` in the registry becomes `<dir>/susegad/<path>` in your project, with the tree kept, so the relative imports between pieces keep working:

```
packages/scenes/kolam/render.js  ->  src/lib/susegad/scenes/kolam/render.js
packages/engine/index.js         ->  src/lib/susegad/engine/index.js
```

Then on a page:

```html
<script type="module">
  import './src/lib/susegad/core/index.js';
  import './src/lib/susegad/scenes/kolam/index.js';
</script>
<sg-scene name="kolam"></sg-scene>
```

## Your edits are safe

`add` writes `<dir>/susegad.json`, recording each item's version and the hash of every file it copied. On the next `add`:

- a file you have not touched is updated to the registry's version;
- a file you have changed is left alone, and nothing else is written either, until you pass `--overwrite`. `susegad diff <item> --patch` shows what differs first.

Hashes read CRLF as LF, so line-ending settings never count as an edit.

## The registry

Each piece has a `registry.json` beside its code (or `<name>.registry.json` when a folder holds a second item, like `core/component.registry.json`). `files`, `docs` and `prompt` are relative to that folder:

```json
{
  "name": "scene-kolam",
  "type": "scene",
  "title": "Kolam",
  "description": "A threshold drawing that closes as work completes.",
  "version": "0.1.0",
  "files": ["index.js", "model.js", "render.js", "meta.js", "kolam.prompt.md"],
  "dependencies": ["core", "engine", "tokens"],
  "registers": ["quiet", "warm", "playful"],
  "budget": { "jsBytes": 40000, "frameMs": 16.7 },
  "prompt": "kolam.prompt.md"
}
```

Paths that start with `packages/` and exist from the repo root are still accepted, with a note asking for the relative form. The schema is `registry/schema.json`.

Everything the CLI copies lives under `packages/`, recipes included: `packages/recipes/<name>/` lands in `<dir>/susegad/recipes/<name>/`, and its imports are written against the same tree (`../../components/toast/toast.js`, never `../../packages/...`). Nothing is rewritten on the way, so a copied file is always byte-identical to the registry's. The build checks that every relative reference in a copied file (JS imports, CSS `url()` and `@import`, HTML `src` and `href`) points at a file copied with it, its own or a dependency's, and warns about root paths like `/tools/...` that only exist on the dev server.

`node registry/build.mjs` checks every manifest (schema, files exist, dependencies exist and do not loop, budgets) and writes the index, `registry/registry.json`. The CLI reads only the index, and refuses to copy from an index older than the source. `--check` fails if the index is out of date; `--strict` turns warnings into errors.

## Proving it end to end

```sh
node packages/cli/e2e.mjs scene-kolam [--scratch <folder>] [--shots .shots/cli]
node packages/cli/e2e.mjs scene-dot --registry registry/fixtures/good
```

This adds the item to a fresh project outside the repo, serves that project on its own, loads it in Chromium, and passes when `sg-ready` fires, the scene drew something, and the console is clean. The screenshot goes to `.shots/cli/<item>.png`.

## As a package

This folder (`packages/cli`) is a self-contained npm package, `@susegad/cli` (`package.json`'s `files` field ships only `bin/`, `src/` and this README; no test files, no `e2e.mjs`). Nothing under `src/` imports anything outside `packages/cli/`, so it works installed on its own, away from the rest of this repo.

```sh
npm pack               # from packages/cli/: writes susegad-cli-0.1.0.tgz
npm install /path/to/susegad-cli-0.1.0.tgz   # in a scratch project, to prove the tarball installs clean
npx susegad list --registry https://susegad.asymmetrica.ai/registry/registry.json
```

`npx susegad` and a bare `npm install @susegad/cli` don't work yet: the name has not been published (`docs/ROADMAP.md`'s open questions; `susegad`, `susegad-ui` and `@susegad/cli` were all free on 28 September 2026). Reserving one and running `npm publish` is the owner's call, not something this repo, its CI or any agent does on its own. Until then, install from a packed tarball (above), from a clone (`node packages/cli/bin/susegad.mjs ...`, see the top of this file), or from a commit with `--ref` (see "Install from a commit").
