// Build data/CREDITS.md from the credits recorded in the landmark fragments.
// Every photo in assets/img/ is a Wikimedia Commons thumbnail; this file
// lists its author, licence and source page as the licence requires.
// Usage: node scripts/make-credits.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEW = join(ROOT, 'data', 'new');
const base = JSON.parse(readFileSync(join(ROOT, 'data', 'landmarks.json'), 'utf8'));

const esc = (s) => String(s || '').replace(/\|/g, '\\|');

const rows = [];
let main = 0;
let gallery = 0;
for (const l of base) {
  const p = join(NEW, `${l.id}.content.json`);
  const c = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : l;
  const items = [
    { kind: 'main', src: l.image, credit: l.image_credit || c.image_credit, commons: c._main_commons },
    ...(l.gallery || []).map((g) => ({ kind: g.kind, src: g.src, credit: g.credit, commons: g._commons })),
  ];
  for (const it of items) {
    if (!it.src) continue;
    if (it.kind === 'main') main++; else gallery++;
    rows.push(`| ${l.id} | ${it.src.replace('assets/img/', '')} | ${esc(it.kind)} | ${esc(it.credit?.author)} | ${esc(it.credit?.license)} | ${it.credit?.source_url || it.commons || ''} |`);
  }
}

const md = `# Credits

## Photos

All photos come from Wikimedia Commons. Files in \`assets/img/\` are 1600 px
Commons thumbnails, re-encoded with ImageMagick to JPEG under 600 KB. They
were not cropped or otherwise edited. Every file keeps its original free
licence. ${main} main photos and ${gallery} gallery photos, ${main + gallery} in total.

| Landmark id | File | Kind | Author | License | Source |
|---|---|---|---|---|---|
${rows.join('\n')}
`;

writeFileSync(join(ROOT, 'data', 'CREDITS.md'), md);
console.log(`wrote data/CREDITS.md with ${main + gallery} photos (${main} main, ${gallery} gallery)`);
