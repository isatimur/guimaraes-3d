#!/usr/bin/env node
// Port engine updates from the braga-3d source of truth into this fork,
// without ever overwriting this fork's own work (waves 6-8 and later).
//
//   scripts/sync-engine.sh --dry-run   print the table (also the default)
//   scripts/sync-engine.sh --apply     apply 'behind' files, write *.conflict for 'diverged'
//   scripts/sync-engine.sh --record    set the base to braga's committed HEAD
//   --verbose                          also list files this fork does not carry
//
// A 3-way compare per engine file, by git blob hash:
//   base  = the file in braga at the commit recorded in scripts/engine-base.json
//   fork  = this fork's working-tree file
//   head  = the file at braga's committed HEAD (uncommitted braga work is invisible)
//
//   same      fork == head                          nothing to do
//   behind    only braga changed since base         --apply copies braga's file
//   ahead     only this fork changed since base     skipped, listed
//   diverged  both changed, and they differ         --apply writes <file>.conflict (braga's
//                                                   version) next to the fork file, skips it
//
// Engine = src/, scripts/, api/, index.html, vite.config.js, minus this fork's
// city files (src/models/guimaraes/, src/locales/*.guimaraes.js) and the sync
// script itself. Files that braga has and this fork does not carry (braga's own
// models and locales) are not engine files for this fork: counted as 'absent'.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRAGA = process.env.BRAGA_DIR || resolve(ROOT, '..', 'braga-3d');
const BASE_FILE = join(ROOT, 'scripts', 'engine-base.json');
const PATHS = ['src', 'scripts', 'api', 'index.html', 'vite.config.js'];
const EXCLUDE = [/^src\/models\/guimaraes\//, /^src\/locales\/[a-z]+\.guimaraes\.js$/, /^scripts\/sync-engine\.(sh|mjs)$/, /^scripts\/engine-base\.(json|txt)$/, /\.conflict$/];
const args = new Set(process.argv.slice(2));
const mode = args.has('--apply') ? 'apply' : args.has('--record') ? 'record' : 'dry-run';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();
const die = (m) => { console.error(`error: ${m}`); process.exit(1); };
if (!existsSync(join(BRAGA, '.git'))) die(`braga-3d not found at ${BRAGA} (set BRAGA_DIR)`);

const HEAD = git(BRAGA, 'rev-parse', 'HEAD');
if (mode === 'record') {
  writeFileSync(BASE_FILE, JSON.stringify({ commit: HEAD, recorded: new Date().toISOString().slice(0, 10), source: 'braga-3d' }, null, 2) + '\n');
  console.log(`recorded engine base: ${HEAD}`);
  process.exit(0);
}
if (!existsSync(BASE_FILE)) die(`no ${BASE_FILE}; run with --record`);
const BASE = JSON.parse(readFileSync(BASE_FILE, 'utf8')).commit;

// path -> blob hash, for a commit's engine paths
function tree(commit) {
  const out = git(BRAGA, 'ls-tree', '-r', commit, '--', ...PATHS);
  const m = new Map();
  for (const line of out ? out.split('\n') : []) {
    const [meta, path] = line.split('\t');
    if (!EXCLUDE.some((re) => re.test(path))) m.set(path, meta.split(' ')[2]);
  }
  return m;
}
const baseTree = tree(BASE);
const headTree = tree(HEAD);
const forkHash = (p) => {
  const f = join(ROOT, p);
  return existsSync(f) ? execFileSync('git', ['hash-object', f], { encoding: 'utf8' }).trim() : null;
};

const rows = [];
let absent = 0;
for (const p of [...new Set([...baseTree.keys(), ...headTree.keys()])].sort()) {
  const b = baseTree.get(p) ?? null;
  const h = headTree.get(p) ?? null;
  const f = forkHash(p);
  if (f === null && b === h) { absent++; continue; } // braga's own file, never carried here
  if (f === null && h !== null && b === null) { rows.push({ p, state: 'behind', note: 'new in braga' }); continue; }
  if (f === null) { absent++; continue; }
  if (f === h) { rows.push({ p, state: 'same' }); continue; }
  const forkChanged = f !== b;
  const bragaChanged = h !== b;
  if (!forkChanged && bragaChanged) rows.push({ p, state: 'behind', note: h === null ? 'deleted in braga' : '' });
  else if (forkChanged && !bragaChanged) rows.push({ p, state: 'ahead' });
  else rows.push({ p, state: 'diverged' });
}

const width = Math.max(4, ...rows.filter((r) => r.state !== 'same').map((r) => r.p.length));
console.log(`engine source : ${BRAGA}`);
console.log(`base          : ${BASE}`);
console.log(`braga HEAD    : ${HEAD}${BASE === HEAD ? '  (base == HEAD)' : ''}`);
console.log(`mode          : ${mode}\n`);
console.log(`${'file'.padEnd(width)}  state`);
console.log(`${'-'.repeat(width)}  --------`);
for (const r of rows) if (r.state !== 'same') console.log(`${r.p.padEnd(width)}  ${r.state}${r.note ? ` (${r.note})` : ''}`);
const count = (s) => rows.filter((r) => r.state === s).length;
console.log(`\nsame ${count('same')} | behind ${count('behind')} | ahead ${count('ahead')} | diverged ${count('diverged')} | absent in fork ${absent}`);
if (args.has('--verbose')) console.log('(absent = braga files this fork does not carry: braga models, locales, game, discovery)');

if (mode === 'apply') {
  console.log('');
  for (const r of rows) {
    const dest = join(ROOT, r.p);
    if (r.state === 'behind') {
      if (headTree.get(r.p) == null) { rmSync(dest, { force: true }); console.log(`removed   ${r.p}`); continue; }
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, execFileSync('git', ['show', `${HEAD}:${r.p}`], { cwd: BRAGA, maxBuffer: 1 << 28 }));
      console.log(`applied   ${r.p}`);
    } else if (r.state === 'diverged') {
      writeFileSync(`${dest}.conflict`, execFileSync('git', ['show', `${HEAD}:${r.p}`], { cwd: BRAGA, maxBuffer: 1 << 28 }));
      console.log(`conflict  ${r.p}.conflict (braga's version; merge by hand, delete the .conflict file)`);
    }
  }
  console.log('\ndone. Review: git diff --stat && npm run verify. After merging, run --record to move the base.');
} else if (count('behind') || count('diverged')) {
  console.log('\nReport only. --apply copies the behind files and writes *.conflict for diverged ones; ahead files are never touched.');
}
