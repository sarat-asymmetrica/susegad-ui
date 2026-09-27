# packages/player/fixtures

`sample.webm` (461 KB, under the charter's ~600 KB guidance) and
`sample.vtt` are the player's own test clip: the library's Kolam scene,
exported through `packages/export`, so the demo and the checks never fetch
anything from the web. Regenerate after a Kolam or export change:

```sh
node packages/player/fixtures/generate.mjs
```

## A known limitation of this clip (and of raw MediaRecorder WebM generally)

`sample.webm` is written directly by `MediaRecorder`, which does not include
a Cues (seek index) element in its WebM container. Chromium reports such a
file's `video.seekable` range as `[0, 0]` **however much of it is actually
buffered**, so `currentTime` assignments are silently ignored — confirmed
directly (`video.seekable.length === 1`, range `[0, 0]`, even at
`readyState === 4` with the whole file buffered). This is a real Chromium
limitation of unmuxed MediaRecorder output, not a bug in `<sg-player>`'s
scrubber or in `tools/serve.mjs`.

Consequences:

- The clip plays straight through correctly (as a `<source>`, in
  `<sg-player>`, anywhere) and its **duration** reads correctly once the
  player has seeked once (the standard "seek to a huge time, then back to
  zero" workaround; `<sg-player>` does not need this for playback, only a
  test reading `.duration` does).
- It **cannot be scrubbed** to an arbitrary point in Chromium without an
  external remux step (for example through `ffmpeg -c copy` to add Cues).
- `player.check.mjs`'s keyboard tests therefore verify what `<sg-player>`
  itself controls — that Space/arrows/M/C ask the media element for the
  right `currentTime`, `muted` and caption state — by spying on the
  `currentTime` setter, rather than trusting this particular file to honour
  a seek. The pure seek maths (`timeFromFraction`, `seekStep`) are fully
  covered in `player.test.js` regardless.

If `packages/export`'s WebM output is ever meant to be scrubbed by someone
outside this library (a proposal recipe embedding an exported clip, say),
it will need a small remux pass to add a Cues element — worth its own
decision if that need comes up. Recorded here as a residual risk, not fixed
in this slice: adding a remuxer is either a new dependency or a non-trivial
EBML writer, out of scope for the player and export slices as briefed.
