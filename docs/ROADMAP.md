# Roadmap

*Sutradhar with the owner, 28 September 2026. A living document: rewrite it when reality disagrees with it. Dates are intentions, not promises.*

Susegad UI grew out of use (a real site, real documents, real scenes), and it should keep growing that way. This roadmap is about making it easy for **other people, and their agents**, to use it as well as we do.

## The loop

```
auditions ──find gaps──▶ skill / docs / MCP ──ship as──▶ plugin + skill + MCP in each harness
    ▲                                                          │
    └──── atelier feedback (anchored, positional) ◀── people create with it
```

- **Auditions** run the library's own tasks through agents of every class. The variable under test is our documentation, not the model: every failure is a missing sentence, a vague prompt or an unhelpful error.
- **Harness packaging** carries the library into the tools people already use: Claude Code, Claude Desktop, Codex, opencode and Hermes.
- **The atelier** is where people, especially beginners, watch a piece grow and point at exactly what should change.

## Six months

| Month | Theme | Done looks like |
|---|---|---|
| 1 (Oct) | **Open the door** | Stability labels on every item; CHANGELOG and tagged releases; CI on the public repo; WebKit and Firefox in the checks; `llms.txt`; a Custom Elements Manifest; SKILL.md reshaped for progressive disclosure; the registry served over HTTP; the CLI reachable with `npx`; the contribution model decided and written down |
| 2 (Nov) | **Real users** | Audition round 1 done and its gaps fixed; two or three outside projects on it (asymmetrica.ai, letspoai, and one from the builders' meetup); their friction becomes the backlog |
| 3 (Dec) | **Freeze the foundations** | 1.0 of tokens, `data-register`, the `<sg-scene>` contract and the registry format; a breaking-change policy |
| 4 (Jan) | **In every harness** | `susegad-mcp` (search, info, add, diff, preview); a Claude Code plugin and marketplace; one-line installs for Codex, opencode and Hermes; audition round 2 run through those installs |
| 5–6 (Feb–Mar) | **The atelier and the ecosystem** | `npx susegad atelier` (a live piece in every register, a timeline over iterations, anchored comments an agent can read); full-page templates; a showcase; the type tier and scapes stable |

## Standing principles

1. **Foundations are the only permanent thing.** Token names, `data-register`, the scene contract and the registry format are copied into other people's code. Change them before 1.0, deliberately, and rarely after.
2. **Copying code has a cost.** People own their copies, so fixes don't reach them on their own. The changelog, `susegad diff` and security notes are how a fix reaches them.
3. **Say no.** Components, scenes, Folio, stage3d and type are separate tiers so they stay separable. Write down what Susegad won't do.
4. **Write it down.** Decisions, the ledger and the prompts are what let someone else, or a fresh agent, pick the work up.
5. **Grow from use.** The best pieces came from dogfooding a real site. Keep that the engine.
6. **Function before form.** A beautiful piece that is a pain to use has failed (the owner, 28 September 2026).

## Semver for a visual library

- **Major:** a removed or renamed attribute, event, slot, CSS custom property, token or registry field; a changed default that alters behaviour.
- **Minor:** new pieces, parameters or registers; a **visual redraw** of a scene or skin (noted in the changelog with before and after shots, because pages may be composed around the old drawing).
- **Patch:** fixes that don't change the public surface or the drawing's composition.

## Open questions for the owner

- **Contribution model:** (a) develop in the public repository, or (b) keep the public snapshot and port outside pull requests by hand. Either way, a CONTRIBUTING.md.
- **npm name:** `susegad`, `susegad-ui` and `@susegad/cli` were all free on 28 September 2026. Reserving one is a publish under the owner's account.
