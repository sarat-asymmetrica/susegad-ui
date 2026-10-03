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
   `node apps/docs/gallery.build.mjs --check`, `node tools/cem.mjs --check`,
   `node tools/check-skill-coverage.mjs`, `node tools/skill-inventory.mjs --check`, `npm run check` (every engine the
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
- No npm publish step at all until the owner reserves a name
  (`susegad`, `susegad-ui` or `@susegad/cli` were all free as of
  2026-09-28) and says to use it.
