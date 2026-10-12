import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CliError, loadRegistry } from './registry.js';
import { commit, planAdd } from './commands.js';
import { LOCKFILE, readLock, writeLock } from './lockfile.js';
import { hashContent } from './hash.js';
import { toPosix } from './paths.js';

const REGISTERS = ['quiet', 'warm', 'playful'];
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
const listing = names => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** The templates a registry offers, by the short name `--template` takes: template-event is "event". */
const templatesOf = reg => [...reg.items.values()].filter(i => i.type === 'template').map(i => i.name.replace(/^template-/, ''));

/** What is in a folder that would stop us starting a site there. A .git folder alone does not. */
function inTheWay(dir) {
  if (!existsSync(dir)) return [];
  if (!statSync(dir).isDirectory()) throw new CliError(`${dir} is a file, not a folder. Pick a folder name, for example: susegad create my-site`);
  return readdirSync(dir).filter(n => n !== '.git');
}

/** A yes or no from the person at the keyboard. Anything but an n is a yes; a pipe or a script is always a yes. */
async function askYes(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try { return !/^n/i.test((await rl.question(`${question} [Y/n] `)).trim()); } finally { rl.close(); }
}

/** The languages a template's strings.js lists, in order: the tags in `export const LANGS = [...]`. */
const languagesOf = strings => [...(strings.match(/export const LANGS = \[([\s\S]*?)\n\];/)?.[1] ?? '').matchAll(/tag: '([^']+)'/g)].map(m => m[1]);

/** How many Konkani (or other) entries in the chosen languages still read [TODO ...], waiting for words. */
const unwritten = (strings, tags) => [...strings.matchAll(/'\[TODO ([A-Za-z-]+)\] /g)].filter(m => tags.includes(m[1])).length;

/** The chosen Konkani (gom) languages that still have keys no native reader has checked, read from the strings.js just written. */
async function draftTags(target, langs) {
  try {
    const mod = await import(pathToFileURL(join(target, 'strings.js')).href);
    if (typeof mod.unreviewed !== 'function') return [];
    const left = mod.unreviewed();
    return langs.filter(l => left[l]?.length);
  } catch { return []; }
}

/**
 * susegad create [folder] [--template event] [--register quiet] [--lang en-IN,gom-Deva] [--site https://...] [--yes]
 *
 * Starts a site from a template in an empty folder: the template's pages go at the folder's root and
 * the pieces they use are copied by the same planner `add` uses, so the lockfile, `diff` and the
 * registry stay the one source of truth. Nothing of the library is copied twice and nothing is
 * written outside the folder.
 */
export async function create(args, ctx) {
  if (args.items.length > 1) throw new CliError('I can start one site at a time. Give me one folder, for example: susegad create my-site');
  const reg = await loadRegistry(ctx.registry, ctx.cwd);
  const name = args.template ?? 'event';
  const offered = templatesOf(reg);
  const item = reg.items.get(`template-${name}`);
  if (item?.type !== 'template') {
    throw new CliError(offered.length
      ? `I do not have a template called "${name}". The templates I have: ${offered.join(', ')}.`
      : `This registry has no templates, so I cannot start a site from it. Point me at one that does with --registry.`);
  }

  const target = resolve(ctx.cwd, args.items[0] ?? '.');
  const shown = toPosix(relative(ctx.cwd, target)) || '.';
  const there = inTheWay(target);
  if (there.length) {
    throw new CliError(`${shown === '.' ? 'This folder' : shown} already has ${plural(there.length, 'thing')} in it (${there.slice(0, 3).join(', ')}${there.length > 3 ? ', and more' : ''}). ` +
      `I only start a site in an empty folder, so nothing of yours can be replaced.\nPick a new one, for example: susegad create my-site`);
  }

  const register = args.register;
  if (register && !REGISTERS.includes(register)) throw new CliError(`${register} is not a look I know. The looks are ${listing(REGISTERS)}.`);
  let site = args.site;
  if (site !== undefined) {
    if (!/^https?:\/\/[^\s/]+/i.test(site)) throw new CliError(`--site wants the address the site will have, such as https://conclave.example.in, and ${site} is not one.`);
    site = site.replace(/\/+$/, '');
  }

  const { items, lock } = await planAdd(reg, [item.name], target);
  const own = items.find(p => p.item.name === item.name);
  const stringsFile = own.files.find(f => f.to === 'strings.js');
  let strings = stringsFile ? stringsFile.content.toString('utf8') : '';
  const offeredLangs = languagesOf(strings);
  const langs = args.lang ? args.lang.split(',').map(s => s.trim()).filter(Boolean) : offeredLangs;
  if (args.lang && stringsFile) {
    const unknown = langs.filter(l => !offeredLangs.includes(l));
    if (unknown.length) throw new CliError(`This template has no ${listing(unknown)} page. It has ${listing(offeredLangs)}.`);
    if (langs[0] !== offeredLangs[0] || new Set(langs).size !== langs.length) throw new CliError(`The first page, at the front door, is ${offeredLangs[0]}. List it first, then the others you want, for example: --lang ${offeredLangs.slice(0, 2).join(',')}`);
  }

  const dropped = offeredLangs.filter(l => !langs.includes(l));
  const folderOf = tag => tag.toLowerCase();
  const noKonkani = !langs.some(l => /^(gom|kok)/.test(l));
  const skip = f => dropped.some(l => f.to.startsWith(folderOf(l) + '/')) || (noKonkani && f.to === 'KONKANI-FOR-READER.md');
  const edits = !!(register || site || dropped.length);

  const look = register ?? strings.match(/export const REGISTER = '([a-z]+)'/)?.[1] ?? 'the default';
  ctx.out(`Starting the ${name} site in ${shown === '.' ? 'this folder' : shown}` +
    `${stringsFile ? ` (look: ${look}; pages: ${langs.join(', ')})` : ''}.`);
  if (!(args.yes || await (ctx.confirm ?? askYes)('Go ahead?'))) { ctx.out('Nothing was written.'); return 0; }
  ctx.out('');

  if (edits && stringsFile) {
    if (register) strings = strings.replace(/export const REGISTER = '[a-z]+';/, `export const REGISTER = '${register}';`);
    if (site) strings = strings.replace(/export const SITE = '[^']*';/, `export const SITE = '${site}';`);
    if (dropped.length) strings = strings.replace(/export const LANGS = \[[\s\S]*?\n\];/, `export const LANGS = [\n${langs.map((l, i) => `  { tag: '${l}', folder: '${i ? folderOf(l) : ''}' },`).join('\n')}\n];`);
    stringsFile.content = Buffer.from(strings);   // the lockfile keeps the registry's hash, so diff shows this as an edit, which it is
  }
  // The shipped README has a table of the pages: write it for the pages actually made, and say which were not.
  const readme = own.files.find(f => f.to === 'README.md');
  if (dropped.length && readme) {
    const madeKonkani = langs.filter(l => /^(gom|kok)/.test(l));
    const row = madeKonkani.length
      ? `| ${madeKonkani.map(l => `\`${folderOf(l)}/index.html\``).join(', ')} | The Konkani page${madeKonkani.length === 1 ? '' : 's'} you asked for (the address scheme of decision 0025: the language tag, in lower case, before the path). |`
      : null;
    const text = readme.content.toString('utf8').split('\n').flatMap(line => {
      if (line.startsWith('| `gom-deva/index.html`')) return row ? [row] : [];
      if (noKonkani && line.startsWith('| `KONKANI-FOR-READER.md`')) return [];
      return [line];
    });
    const note = `> Made with \`--lang ${langs.join(',')}\`: ${listing(dropped)} ${dropped.length === 1 ? 'was' : 'were'} not made, so there ${dropped.length === 1 ? 'is no page' : 'are no pages'} for ${dropped.length === 1 ? 'it' : 'them'} below. Their words are still in \`strings.js\`; add the language to \`LANGS\` and run \`node pages.mjs\` to make them.`;
    const at = text.findIndex(l => l.startsWith('# '));
    text.splice(at + 1, 0, '', note);
    readme.content = Buffer.from(text.join('\n'));
  }
  commit(items, lock, target, skip);

  if (edits && stringsFile) {
    const ran = spawnSync(process.execPath, ['pages.mjs'], { cwd: target, encoding: 'utf8' });
    if (ran.status !== 0) throw new CliError(`I copied everything, but writing the pages again with your choices failed:\n${(ran.stderr || ran.stdout || '').trim()}\nThe folder is ${shown}; node pages.mjs there shows the same message.`);
    // The pages now differ from the registry's because of create's own choices. Note what it wrote, so diff
    // shows the builder's edits and not these.
    const lockNow = readLock(target);
    const onDisk = f => hashContent(readFileSync(join(target, f.to)));
    lockNow.items[item.name].written = Object.fromEntries(own.files.filter(f => !skip(f) && onDisk(f) !== f.hash).map(f => [f.to, onDisk(f)]));
    writeLock(target, lockNow);
  }

  const written = items.flatMap(p => p.files.filter(f => !skip(f)));
  const mine = written.filter(f => !f.to.startsWith('susegad/'));
  const library = items.filter(p => p.item.name !== item.name).map(p => p.item.name);
  ctx.out(`Made ${plural(mine.length, 'file')} of your own, and copied ${plural(written.length - mine.length, 'file')} from ${plural(library.length, 'library piece')} into susegad/:`);
  const pages = mine.map(f => f.to).filter(p => /(^|\/)index\.html$/.test(p));
  const others = [...new Set(mine.map(f => f.to).filter(p => !pages.includes(p)).map(p => p.includes('/') ? p.split('/')[0] + '/' : p))];
  ctx.out(`  ${pages.join(', ')}  (the pages)`);
  ctx.out(`  ${others.join(', ')}`);
  ctx.out(`  susegad/  (${listing(library)})`);
  ctx.out(`I noted what I copied in ${LOCKFILE}, so next time I can tell your edits from mine.`);

  if (dropped.length) {
    ctx.out('');
    ctx.out(`You asked for fewer pages, so ${listing(dropped)} ${dropped.length === 1 ? 'was' : 'were'} not made. README.md still describes all three, and strings.js still holds the words for the ones you left out.`);
  }

  const waiting = unwritten(strings, langs);
  if (waiting) {
    ctx.out('');
    ctx.out(`${plural(waiting, 'Konkani entry', 'Konkani entries')} in strings.js still read [TODO ...], because no one has written those words yet. They show on the page exactly as they read now, so nobody publishes them by mistake.`);
  }
  // The template says which Konkani keys a native reader has checked (strings.js: unreviewed()).
  const draft = stringsFile ? await draftTags(target, langs) : [];
  if (draft.length) {
    ctx.out('');
    ctx.out('The Konkani is a first draft by a non-native writer. Ask a Goan reader to check KONKANI-FOR-READER.md before you publish.');
  }

  const cd = shown === '.' ? '' : `cd ${shown}, then `;
  ctx.out('');
  ctx.out('What to do next');
  ctx.out(`  1. Open it. It is plain files, so any static server will do: ${cd}npx serve   and open the address it prints.`);
  ctx.out('     (Open index.html straight from the folder and the page reads, but its scripts need a server.)');
  ctx.out('  2. Change the words. They are all in strings.js, with the date, the venue and the address of the site. After editing, run: node pages.mjs');
  ctx.out(`  3. Read the docs. README.md says what each part is and how to add a language; each piece in susegad/ has its own README and prompt, and the whole library is at https://susegad.asymmetrica.ai.`);
  return 0;
}
