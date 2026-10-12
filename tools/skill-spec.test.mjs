import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSkill, checkRepoSkills, parseSkill, LIMITS, ROOT_SKILL_NAME } from './skill-spec.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'skill-spec');
const ok = (extra = '', body = '# x\n', front = { name: 'a-skill', description: 'Does a thing. Use when asked.' }) =>
  `---\n${Object.entries({ ...front }).map(([k, v]) => `${k}: ${v}`).join('\n')}${extra}\n---\n\n${body}`;
const check = (text, name = 'a-skill') => checkSkill(text, { expectedName: name, label: 'S' });

test('a skill with a name and a description meets the spec', () => {
  assert.deepEqual(check(ok()), []);
});

test('the repo\'s own skills meet the spec (green on the repo)', () => {
  const { problems, checked } = checkRepoSkills();
  assert.deepEqual(problems, []);
  assert.deepEqual(checked, ['SKILL.md', 'skills/susegad-scene/SKILL.md']);
});

test('the good fixture is green and the bad fixture goes red on each of its seven faults (fail first)', () => {
  assert.deepEqual(checkRepoSkills(join(fixtures, 'good')).problems, []);
  const bad = checkRepoSkills(join(fixtures, 'bad')).problems.join('\n');
  for (const re of [/Bad-Name.*lowercase/, /dead-link.*references\/missing\.md/, /double--hyphen.*single hyphens/, /extra-key.*"version" is not in the Agent Skills spec/,
    /extra-key.*"metadata" is allowed by the spec but not here/, /no-description.*has no description/, /wrong-name.*must match its directory/]) assert.match(bad, re);
  const run = spawnSync(process.execPath, [join(here, 'skill-spec.mjs'), '--root', join(fixtures, 'bad')], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /7 Agent Skills spec problems/);
  const green = spawnSync(process.execPath, [join(here, 'skill-spec.mjs')], { encoding: 'utf8' });
  assert.equal(green.status, 0, green.stderr);
});

test('an extra frontmatter key fails, a spec-legal one too (house rule), and an unknown one says it is not in the spec', () => {
  assert.match(check(ok('\nversion: 2')).join(), /"version" is not in the Agent Skills spec/);
  assert.match(check(ok('\nlicense: MIT')).join(), /"license" is allowed by the spec but not here/);
  assert.match(check(ok('\nallowed-tools: Read')).join(), /"allowed-tools" is allowed by the spec but not here/);
});

test('the description limit is 1024 characters, inclusive', () => {
  const at = ok('', '# x\n', { name: 'a-skill', description: 'd'.repeat(LIMITS.description) });
  assert.deepEqual(check(at), []);
  const over = ok('', '# x\n', { name: 'a-skill', description: 'd'.repeat(LIMITS.description + 1) });
  assert.match(check(over).join(), /description is 1025 characters; the limit is 1024/);
  assert.match(check(ok('', '# x\n', { name: 'a-skill', description: '' })).join(), /has no description/);
});

test('name rules: length, case, hyphens, and the directory it must match', () => {
  const named = n => ok('', '# x\n', { name: n, description: 'Does a thing.' });
  assert.deepEqual(check(named('a'.repeat(64)), 'a'.repeat(64)), []);
  assert.match(check(named('a'.repeat(65)), 'a'.repeat(65)).join(), /name is 65 characters/);
  for (const bad of ['-pdf', 'pdf-', 'pdf--x', 'PDF', 'pdf_x', 'pdf x']) assert.match(check(named(bad), bad).join(), /lowercase letters, digits and single hyphens/, bad);
  assert.match(check(named('other'), 'a-skill').join(), /must match its directory "a-skill"/);
  assert.match(checkSkill(named('x'), { expectedName: ROOT_SKILL_NAME, label: 'SKILL.md' }).join(), /must match the library name "susegad-ui"/);
});

test('the body must stay under 500 lines; frontmatter must exist and be plain key: value', () => {
  assert.deepEqual(check(ok('', 'line\n'.repeat(LIMITS.bodyLines))), []);
  assert.match(check(ok('', 'line\n'.repeat(LIMITS.bodyLines + 1))).join(), /body is 501 lines/);
  assert.match(check('# no frontmatter\n').join(), /has no frontmatter/);
  assert.match(check('---\nname: a-skill\ndescription: >\n  folded text\n---\n\n# x\n').join(), /is not a plain "key: value"/);
  assert.deepEqual(parseSkill('---\r\nname: a\r\ndescription: "quoted"\r\n---\r\nbody').front, { name: 'a', description: 'quoted' });
});
