import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lintEntries } from "./lint.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

async function errorsFor(dirName) {
  const dir = path.join(here, "fixtures", dirName);
  const lines = await lintEntries(dir);
  return { lines, dir };
}

test("a good entry passes clean", async () => {
  const { lines } = await errorsFor("good");
  assert.deepEqual(lines, []);
});

test("a missing title fails with the field named", async () => {
  const { lines, dir } = await errorsFor("broken/missing-title");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /missing-title\/entry\.jsonc: title: missing required field/);
  assert.equal(new RegExp(path.basename(dir), "").test(lines[0]), true);
});

test("a missing rememberedBy fails with the field named", async () => {
  const { lines } = await errorsFor("broken/missing-remembered-by");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /rememberedBy/);
  assert.match(lines[0], /missing required field|must/);
});

test("a personPhoto reference without consent fails with consent named", async () => {
  const { lines } = await errorsFor("broken/person-photo-no-consent");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /consent/);
  assert.match(lines[0], /personPhoto|agreed/);
});

test("sacred tier without communityLead fails with communityLead named", async () => {
  const { lines } = await errorsFor("broken/sacred-no-community-lead");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /communityLead/);
  assert.match(lines[0], /sacred/);
});

test("a bad status value fails with status named", async () => {
  const { lines } = await errorsFor("broken/bad-status");
  assert.equal(lines.length, 1);
  assert.match(lines[0], /status/);
  assert.match(lines[0], /sketch, proposed, promoted/);
});
