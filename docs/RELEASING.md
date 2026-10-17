# Releasing

Susegad UI is copied into a builder's project, shadcn-style, so a "release"
is really two things: a tagged snapshot of the whole repo (for anyone
tracking it with git, and for `susegad add --ref <tag>`), and, later, a
published `@susegad/cli` package on npm (see decision-in-waiting: the owner
has not reserved the npm name yet, per `docs/ROADMAP.md`'s open questions).

This is the process for the first kind, the repo tag. It does not publish
anything: no `npm publish`, no `git push`, no GitHub release. Those are the
owner's call, each one, every time.

## Semver

Rules are in [`docs/ROADMAP.md`](ROADMAP.md#semver-for-a-visual-library):

- **Major:** a removed or renamed attribute, event, slot, CSS custom
  property, token or registry field; a changed default that alters
  behaviour.
- **Minor:** new pieces, parameters or registers; a visual redraw of a
  scene or skin (noted in the changelog with before and after shots).
- **Patch:** fixes that don't change the public surface or a drawing's
  composition.

## Steps

1. **Everything is green.** `npm test`, `node registry/build.mjs --check`,
   `npm run docs:build` (0 failures; it builds the gallery too), `node tools/cem.mjs --check`,
   `node tools/skill-inventory.mjs --check`, `npm run check` (every engine the
   CI runs — see rung 4). If a check is red, the release waits.
2. **Move Unreleased into a version.** In `CHANGELOG.md`, rename
   `## [Unreleased]` to `## [x.y.z] - YYYY-MM-DD` (today, IST), add a fresh
   empty `## [Unreleased]` above it, and update the comparison links at the
   bottom of the file.
3. **Bump the version.** `package.json`'s `version` at the repo root, and
   `packages/cli/package.json`'s `version` if the CLI changed since its
   last bump. They don't have to move together: the repo version tracks
   the whole library; the CLI's own version is what npm would see.
4. **Commit.** One commit, "Release x.y.z", touching only the changelog and
   the version bump(s).
5. **Tag.** `git tag -a vx.y.z -m "x.y.z"` on that commit. Not pushed here:
   the owner pushes tags (`git push origin vx.y.z`) when they're ready for
   it to be public.
6. **Export.** `node tools/publish/export.mjs --out <path to the public
   clone>` refreshes the public snapshot from this commit (see the script's
   own comment for what it keeps private). The owner commits and pushes
   that clone separately; this repo's tag is what the export was built
   from, so the public repo's history can point back to it in the commit
   message.

## What this repo does not do yet

- No automated tag-triggered publish. CI (rung 3) runs tests and checks on
  push and pull request; it does not push tags, create GitHub releases, or
  run `npm publish`.
- npm publishing is by hand, by the owner (2FA): `@susegad/cli` and
  `@susegad/mcp` went out at 0.1.0 on 2026-10-06. Publish the CLI before
  the MCP server, which depends on it:
  `npm publish -w @susegad/cli -w @susegad/mcp --auth-type=web`.

## CI on a private branch

The public repo's CI normally sees only `main`. To run it on any private branch
(an integration branch, a slice) before it merges, from a clone of the public repo:

1. `git -C <clone> fetch origin` (the new branch starts from `origin/main`).
2. `node tools/publish/export.mjs --ci-branch <clone>`, on the private branch to be tested. It
   commits the public tree of HEAD to `ci/<branch>` in the clone (`run/rigour` becomes
   `ci/run-rigour`) and prints the two commands below. It refuses a clone with uncommitted
   changes, a clone that is really a checkout of this repo, and a detached HEAD. The private
   list and the DENY scan apply as for `--out`. It never pushes.
3. The owner runs what it printed:
   `git -C <clone> push -u origin ci/<branch>`, then
   `gh pr create --draft -R sarat-asymmetrica/susegad-ui --base main --head ci/<branch> --title "..." --body "..."`.
   The workflow runs on `pull_request`; its summary is headed "Private-branch run".
4. Read the result in the PR's checks, then close the PR and delete the branch.

Pushing and opening the PR are the owner's. A private workflow that runs on this repo itself,
if it ever gets a GitHub remote, is `tools/publish/private-ci.yml` (its header says how to
enable it). The test job also runs `npm audit --omit=dev --audit-level=high`: production
advisories at high or above fail it; advisories in dev tooling do not.
