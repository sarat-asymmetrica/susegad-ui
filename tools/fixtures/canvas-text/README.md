# canvas-text lint fixtures

Three render.js stand-ins, for `tools/canvas-text-lint.mjs` and its test:

- `clean-render.js`: no canvas text, must pass.
- `broken-render.js`: `fillText` in an unlisted render file, must fail.
- `allowed-render.js`: the same call under a decided exception, must pass because
  `ALLOWED` lists the file (the test passes its own allow-list).

