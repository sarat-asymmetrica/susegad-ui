// The soak: a long quiet run of a page, a scene or a playlist of scenes, the way an event kiosk or a lobby TV runs it,
// sampled for leaks and slow drift, with a verdict against budgets (tools/lib/soak.core.js says each one and why).
//
//   npm run soak -- kolam                         a scene, 1080p, quick (2 minutes)
//   npm run soak -- /tools/fixtures/soak/leak.html    a page by path (anything with a "/" or ".html" is a page)
//   npm run soak -- --playlist paus,tollem,kolam --dwell 20 --mode rung     cycle scenes: a mount/unmount leak shows
//   npm run soak -- kolam --profile 4k --mode release --json soak-kolam.json
//
//   <target>             a scene name, or a page path; or none with --playlist
//   --profile 1080p|4k   viewport 1920x1080 or 3840x2160, one device pixel per CSS pixel (default 1080p)
//   --mode quick|rung|release   2 minutes (tests, slices), 30 minutes (the rigour rung), 2 hours (before a release); default quick
//   --playlist a,b,c     scene names (or page paths, as for a target), cycled through one iframe replaced every --dwell seconds (default 20)
//   --json <file>        write the samples and the verdict
//   --duration S --interval S --warmup S    override the mode (the tests use a 30 s run)
//   --register --theme --palette --seed --param k=v --content    as the other tools
//
// Holds one browser slot for the whole run, however long (tools/lib/slots.mjs); two hours holds it two hours, so release mode
// belongs to a quiet machine. Exit code 0 pass, 1 fail, 3 not judged (too few samples, or a frame drift a busy machine could explain; neither pass nor fail,
// as perf.mjs), 2 bad usage. Chromium only.

import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { parseArgs } from './lib/args.mjs';
import { TARGET_SPEC, targetFrom, targetPath } from './lib/target.mjs';
import { MODES, PROFILES, BUDGETS, formatReport } from './lib/soak.core.js';
import { runSoak } from './lib/soak.run.mjs';

const SPEC = { ...TARGET_SPEC, profile: 'string', mode: 'string', playlist: 'string', dwell: 'number', json: 'string', duration: 'number', interval: 'number', warmup: 'number' };

async function main() {
  const { opts, positional } = parseArgs(process.argv.slice(2), SPEC, { profile: '1080p', mode: 'quick', dwell: 20 });
  const profile = PROFILES[opts.profile];
  if (!profile) throw new Error(`--profile must be one of ${Object.keys(PROFILES).join(', ')}`);
  const mode = MODES[opts.mode];
  if (!mode) throw new Error(`--mode must be one of ${Object.keys(MODES).join(', ')}`);
  const seconds = opts.duration ?? mode.seconds, interval = opts.interval ?? mode.interval, warmup = opts.warmup ?? mode.warmup;

  let target, label, cycle = 0;
  if (opts.playlist) {
    if (positional.length || opts.scene || opts.url) throw new Error('give a target or --playlist, not both');
    const names = opts.playlist.split(',').map(s => s.trim()).filter(Boolean);
    const q = new URLSearchParams({ dwell: String(opts.dwell) });
    for (const name of names) q.append('s', targetPath(/[/.]/.test(name) ? targetFrom({ ...opts, url: name }) : { ...targetFrom({ ...opts, scene: name }), scene: name }));
    target = { url: `/tools/fixtures/soak/playlist.html?${q}` };
    cycle = names.length * opts.dwell;
    label = `playlist(${names.join(',')}, ${opts.dwell}s)`;
  } else {
    const first = positional[0];
    const asPage = first && /[/.]/.test(first) && !opts.scene && !opts.url;
    target = targetFrom(asPage ? { ...opts, url: first } : opts, asPage ? [] : positional);
    if (!target.scene && !target.url) throw new Error('give a scene name or a page path (or --playlist a,b,c)');
    targetPath(target); // throws on a bad name now, not after a slot wait
    label = target.scene ?? target.url;
  }

  console.log(`soak: ${label}, ${opts.profile} (${profile.width}x${profile.height}), ${opts.mode}: ${seconds} s, a sample every ${interval} s, warm-up ${warmup} s, ${os.cpus().length} cores`);
  const r = await runSoak({ target, view: { width: profile.width, height: profile.height, dpr: profile.dpr }, seconds, interval, warmup, onSample: line => console.log(line) });
  const text = formatReport(r.verdict, { target: label, profile: opts.profile, mode: opts.mode, seconds: r.samples.at(-1)?.t ?? 0, cores: os.cpus().length });
  console.log('\n' + text);
  if (opts.playlist) {
    console.log(`Playlist: ${r.mounts} mounts, ${r.unmounts} unmounts`);
    const windowSeconds = r.verdict.window * interval;
    if (windowSeconds < cycle) console.log(`Note: each comparison window is ${windowSeconds} s but one pass of the playlist is ${cycle} s, so the first and last windows hold different scenes and their frame times and counts are not like for like. Run at least ${Math.ceil(3 * cycle + warmup)} s (or lengthen --duration) for windows of a whole cycle.`);
  }
  console.log(`Browser: Chromium ${r.browser}${r.crashes ? `, ${r.crashes} crash(es)` : ''}`);
  if (opts.json) {
    writeFileSync(opts.json, JSON.stringify({ target: label, profile: opts.profile, mode: opts.mode, seconds, interval, warmup, browser: r.browser, cores: os.cpus().length, budgets: BUDGETS, verdict: r.verdict, errors: r.errors, mounts: r.mounts, unmounts: r.unmounts, samples: r.samples }, null, 2));
    console.log(`wrote ${opts.json}`);
  }
  process.exitCode = r.verdict.overall === 'fail' ? 1 : r.verdict.overall === 'not-judged' ? 3 : 0;
}

main().catch(e => { console.error(`soak: ${e.message}`); process.exitCode = 2; });
