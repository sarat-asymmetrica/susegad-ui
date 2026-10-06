# susegad-mcp

The Susegad UI MCP server. It gives an agent harness five tools over stdio: search the shelf, read one piece in full (including the prompt that teaches an agent how to use it), show its posters, and add pieces into a project or diff what it has copied. The add and diff tools run the susegad CLI's own code (packages/cli/src/commands.js), so what the server writes is exactly what `susegad add` writes, hashes and lockfile included.

Node 22 or later, no dependencies. The server must run from the Susegad UI repo (it imports the CLI beside it), and its working directory should be the project it adds into.

## Running it by hand

```sh
node packages/mcp/bin/susegad-mcp.mjs
```

Without `--registry` the server behaves like the CLI: the repo's own registry when it runs from the repo, the live site (`https://susegad.asymmetrica.ai/registry/registry.json`) otherwise. You can point it anywhere:

```sh
node packages/mcp/bin/susegad-mcp.mjs --registry https://susegad.asymmetrica.ai/registry/registry.json
node packages/mcp/bin/susegad-mcp.mjs --registry ../some-project     # a repo folder with a registry/
```

The same value can be given as the `SUSEGAD_REGISTRY` environment variable.

## The tools

| Tool | What it does |
|---|---|
| `search` | Words, a kind (`package`, `scene`, `surface`, `component`, `recipe`, `adapter`) and a register (`quiet`, `warm`, `playful`). Returns name, title, type, description, version, stability. A word nothing has is an honest empty list. |
| `info` | One piece: files and where they land, dependencies, registers, stability, budget, the prompt path and the prompt's text. |
| `preview` | The poster URLs for one piece in each register and theme, on the live site, so a harness can show the choice. Scenes and pieces with a demo page have posters. |
| `add` | Copies pieces and everything they need, through the CLI's `add`. `dir` (default `src/lib`), `cwd` (default the server's working directory), `dryRun`, `overwrite`, `registry`. |
| `diff` | Which copied files have drifted from the registry, through the CLI's `diff`. No `items` checks everything the lockfile knows; `patch: true` shows the lines. |

A tool that fails answers with `isError: true` and the message: the CLI's own words for a missing item, for example. Nothing writes unless `add` really ran.

## Install lines

Start from the repo clone. `<repo>` below is where Susegad UI is checked out; use forward slashes on Windows. These lines follow each harness's own documentation, cited next to each.

### Claude Code

`claude mcp add --transport stdio susegad -- node <repo>/packages/mcp/bin/susegad-mcp.mjs`

Or a `.mcp.json` (or `~/.claude.json`) entry, which the same docs page describes:

```json
{ "mcpServers": { "susegad": { "type": "stdio", "command": "node", "args": ["<repo>/packages/mcp/bin/susegad-mcp.mjs"] } } }
```

Source: Claude Code docs, "Connect Claude Code to tools via MCP" (https://code.claude.com/docs/en/mcp), options 3 and the JSON configuration section.

### Codex

`codex mcp add susegad -- node <repo>/packages/mcp/bin/susegad-mcp.mjs`

Or in `~/.codex/config.toml` (or a project `.codex/config.toml`):

```toml
[mcp_servers.susegad]
command = "node"
args = ["<repo>/packages/mcp/bin/susegad-mcp.mjs"]
```

Source: OpenAI's "Model Context Protocol" page for Codex (https://developers.openai.com/codex/mcp/), "Configure with the CLI" and "Configure with config.toml".

### Hermes

`hermes mcp add susegad --command node --args <repo>/packages/mcp/bin/susegad-mcp.mjs`, or in `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  susegad:
    command: "node"
    args: ["<repo>/packages/mcp/bin/susegad-mcp.mjs"]
    cwd: "<your-project>"   # the project the tools add into
```

Source: Hermes Agent docs, "MCP" (https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp/), which documents `mcp_servers` under `~/.hermes/config.yaml` with `command`, `args` and `cwd`.

### OpenCode

In `opencode.json` (the OpenCode config file):

```json
{ "mcp": { "susegad": { "type": "local", "command": ["node", "<repo>/packages/mcp/bin/susegad-mcp.mjs"] } } }
```

Source: OpenCode docs, "MCP servers" (https://opencode.ai/docs/mcp-servers/), the Local section, which documents `type: "local"` and a `command` array.

### What is not verified here

The MCP configuration formats above were checked against each harness's docs on 3 October 2026, and each line cites its page. Two things were not verified and say so:

- The `cwd` key works in Hermes's documented schema (cited above) and in OpenCode's (same page, the options table). Claude Code and Codex document `cwd` for MCP servers too, but adding into a project other than the server's working directory is not covered by those pages' examples, so prefer setting the server entry's working directory, or pass `cwd` in the `add` tool call itself, which needs no config support anywhere.
- Nothing here is published to npm yet, so every install line runs the server straight from the clone. When `@susegad/mcp` is published (see packages/cli/README.md on why it is not published by an agent), `npx @susegad/mcp` should work the same way the CLI's docs describe.

## Tests

```sh
node --test packages/mcp/mcp.test.js
```

The tests never touch the live site. They drive the server through a real child process over stdio against the good fixture registry (`registry/fixtures/good`) served locally with tools/serve.mjs: initialize, the initialized notification, tools/list, and every tool, including the honest failures (a search for a word nothing has, an add of a piece that does not exist, which returns the CLI's own error text). The pure cores (search filtering, the dependency closure, the poster URL scheme) are tested in process.
