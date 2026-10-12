#!/usr/bin/env node
// Holds every SKILL.md in the repo to the Agent Skills specification (https://agentskills.io/specification,
// read 6 October 2026): the root SKILL.md and each skills/<name>/SKILL.md.
//
//   node tools/skill-spec.mjs                 check this repo
//   node tools/skill-spec.mjs --root <dir>    check another tree (the tests use fixtures)
//
// From the spec: frontmatter with a `name` (1 to 64 characters, lowercase letters, digits and single hyphens,
// not starting or ending with one, matching the skill's directory) and a `description` (1 to 1024 characters,
// non-empty); the body stays under 500 lines; files are referenced by relative path from the skill root.
// The spec also allows license, compatibility, metadata and allowed-tools. House rule, stricter than the spec:
// ours carry `name` and `description` only, so every client reads the same two fields and nothing hides in the
// frontmatter; detail belongs in references/.
// The root SKILL.md is named for the library (`susegad-ui`) since the repo folder is not the skill's folder:
// the CLI installs it into a folder with that name.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

export const SPEC_FIELDS = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];
export const HOUSE_FIELDS = ['name', 'description'];
export const ROOT_SKILL_NAME = 'susegad-ui';
export const LIMITS = { name: 64, description: 1024, bodyLines: 500 };
const NAME = /^[\p{Ll}\p{Nd}]+(-[\p{Ll}\p{Nd}]+)*$/u;

/** Split a SKILL.md into its frontmatter keys (top-level `key: value` lines) and body. null frontmatter when there is none. */
export function parseSkill(text) {
  text = text.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { front: null, body: text, unparsed: [] };
  const front = {}, unparsed = [];
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = line.match(/^([A-Za-z][\w-]*):(?:\s+(.*))?$/);
    if (!kv || /^\s/.test(line)) { unparsed.push(line); continue; }
    let v = (kv[2] ?? '').trim();
    if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
    front[kv[1]] = v;
  }
  return { front, body: m[2], unparsed };
}

/**
 * @param {string} text the SKILL.md
 * @param {{ expectedName: string, label: string, dir?: string }} where
 * @returns {string[]} problems, each starting with the file
 */
export function checkSkill(text, { expectedName, label, dir }) {
  const problems = [], say = msg => problems.push(`${label}: ${msg}`);
  const { front, body, unparsed } = parseSkill(text);
  if (!front) { say('has no frontmatter; the spec wants --- name and description --- at the very top'); return problems; }
  for (const line of unparsed) say(`frontmatter line "${line.trim().slice(0, 40)}" is not a plain "key: value" (keep description on one line; no folded or nested values)`);
  for (const key of Object.keys(front)) {
    if (!SPEC_FIELDS.includes(key)) say(`frontmatter key "${key}" is not in the Agent Skills spec (name, description, license, compatibility, metadata, allowed-tools)`);
    else if (!HOUSE_FIELDS.includes(key)) say(`frontmatter key "${key}" is allowed by the spec but not here: skills carry name and description only; move the detail to references/`);
  }
  const { name, description } = front;
  if (name === undefined) say('has no name');
  else {
    if (name.length < 1 || name.length > LIMITS.name) say(`name is ${name.length} characters; it must be 1 to ${LIMITS.name}`);
    if (!NAME.test(name)) say(`name "${name}" must be lowercase letters, digits and single hyphens, not starting or ending with a hyphen`);
    if (name !== expectedName) say(`name "${name}" must match ${expectedName === ROOT_SKILL_NAME ? 'the library name' : 'its directory'} "${expectedName}"`);
  }
  if (description === undefined || description === '') say('has no description (it must be 1 to 1024 characters and say what the skill does and when to use it)');
  else if (description.length > LIMITS.description) say(`description is ${description.length} characters; the limit is ${LIMITS.description}`);
  const lines = body.replace(/^\n+/, '').replace(/\n$/, '').split('\n').length;
  if (lines > LIMITS.bodyLines) say(`body is ${lines} lines; the spec asks for under ${LIMITS.bodyLines}, with detail in references/`);
  if (dir) {
    for (const m of body.matchAll(/\]\((references\/[^)#\s]+)/g)) {
      if (!existsSync(join(dir, m[1]))) say(`links to ${m[1]}, which does not exist`);
    }
  }
  return problems;
}

/** The root SKILL.md and every skills/<dir>/SKILL.md under root. */
export function checkRepoSkills(root = ROOT) {
  const problems = [], checked = [];
  const run = (file, expectedName, label, dir) => {
    checked.push(label);
    if (!existsSync(file)) { problems.push(`${label}: is missing`); return; }
    problems.push(...checkSkill(readFileSync(file, 'utf8'), { expectedName, label, dir }));
  };
  run(join(root, 'SKILL.md'), ROOT_SKILL_NAME, 'SKILL.md', root);
  const skills = join(root, 'skills');
  if (existsSync(skills)) {
    for (const e of readdirSync(skills, { withFileTypes: true })) {
      if (e.isDirectory()) run(join(skills, e.name, 'SKILL.md'), e.name, `skills/${e.name}/SKILL.md`, join(skills, e.name));
    }
  }
  return { problems, checked };
}

function main(argv) {
  const i = argv.indexOf('--root');
  const { problems, checked } = checkRepoSkills(i === -1 ? ROOT : resolve(argv[i + 1]));
  if (problems.length) {
    console.error(`${problems.length} Agent Skills spec problem${problems.length === 1 ? '' : 's'}:`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  console.log(`${checked.length} skill${checked.length === 1 ? '' : 's'} meet the Agent Skills spec (${checked.join(', ')}).`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
