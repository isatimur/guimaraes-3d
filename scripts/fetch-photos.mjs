// Fetch landmark photos from Wikimedia Commons and record their credits.
//
// Agents write data/new/<id>.content.json with a `main_photo` and a
// `gallery` whose entries carry a `commons` file title (e.g.
// "File:Guimarães, Padrão do Salado (1).jpg"). This script:
//   - resolves the 1600 px thumbnail and the attribution from the Commons API,
//   - downloads it to assets/img/<id>.jpg and assets/img/<id>-1..N.jpg,
//   - re-encodes with ImageMagick to a JPEG under 600 KB,
//   - rewrites the fragment with `image` / `image_credit` and each gallery
//     entry's `src` + `credit`, dropping the temporary `commons` keys.
//
// Idempotent: a fragment that already has final `image` + credited gallery is
// left alone unless --force. Usage:
//   node scripts/fetch-photos.mjs [--force] [id ...]
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEW = join(ROOT, 'data', 'new');
const IMG = join(ROOT, 'assets', 'img');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'guimaraes-3d photo fetcher (https://github.com/isatimur/guimaraes-3d)';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.filter((a) => !a.startsWith('-'));

const landmarksFile = join(ROOT, 'data', 'landmarks.json');
const ids = existsSync(landmarksFile)
  ? JSON.parse(readFileSync(landmarksFile, 'utf8')).map((l) => l.id)
  : [];
const targets = (only.length ? only : ids).filter((id) => existsSync(join(NEW, `${id}.content.json`)));

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class CommonsError extends Error {}

async function imageInfo(title) {
  const file = title.startsWith('File:') ? title : `File:${title}`;
  const url = `${API}?action=query&titles=${encodeURIComponent(file)}&prop=imageinfo` +
    `&iiprop=url|extmetadata|size&iiurlwidth=1600&format=json&origin=*`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new CommonsError(`${file}: HTTP ${res.status}`);
  const json = await res.json();
  const page = Object.values(json.query?.pages || {})[0];
  if (!page || page.missing != null || !page.imageinfo?.[0]) throw new CommonsError(`${file}: not found on Commons`);
  const ii = page.imageinfo[0];
  const m = ii.extmetadata || {};
  const license = stripHtml(m.LicenseShortName?.value);
  if (license && /fair use|non-free|copyright/i.test(license) && !/CC|public domain|CC0/i.test(license)) {
    throw new CommonsError(`${file}: non-free license "${license}"`);
  }
  return {
    title: page.title,
    thumb: (ii.thumburl || ii.url).split('?')[0],
    width: ii.thumbwidth || ii.width,
    source_url: ii.descriptionurl,
    credit: {
      author: stripHtml(m.Artist?.value) || 'Wikimedia Commons',
      license: license || 'see source',
      source_url: ii.descriptionurl,
    },
  };
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new CommonsError(`download ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = mkdtempSync(join(tmpdir(), 'g3d-'));
  const raw = join(tmp, 'raw');
  writeFileSync(raw, buf);
  try {
    for (const q of [84, 78, 72, 66, 60, 54, 48, 42]) {
      execFileSync('magick', [raw, '-resize', '1600x1600>', '-strip', '-interlace', 'Plane', '-sampling-factor', '4:2:0', '-quality', String(q), dest]);
      const size = existsSync(dest) ? readFileSync(dest).length : Infinity;
      if (size < 600 * 1024) return size;
    }
    execFileSync('magick', [raw, '-resize', '1280x1280>', '-strip', '-interlace', 'Plane', '-sampling-factor', '4:2:0', '-quality', '52', dest]);
    return readFileSync(dest).length;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function needsWork(c) {
  if (force) return true;
  const gallery = c.gallery || [];
  return !c.image || !!c.main_photo || gallery.some((g) => g.commons);
}

for (const id of targets) {
  const path = join(NEW, `${id}.content.json`);
  const c = JSON.parse(readFileSync(path, 'utf8'));
  if (!needsWork(c)) {
    console.log(`${id}: already final, skipped`);
    continue;
  }
  const mainTitle = c.main_photo?.commons || c.main_photo || c._main_commons;
  const gallerySpec = (c.gallery || [])
    .map((g) => (typeof g === 'string' ? { commons: g } : { ...g, commons: g.commons || g._commons }))
    .filter((g) => g.commons);

  try {
    if (mainTitle) {
      const info = await imageInfo(mainTitle);
      const dest = join(IMG, `${id}.jpg`);
      const size = await download(info.thumb, dest);
      c.image = `assets/img/${id}.jpg`;
      c.image_credit = info.credit;
      console.log(`${id}: main ${info.title} -> ${(size / 1024).toFixed(0)} KB`);
    } else if (!c.image) {
      console.warn(`${id}: no main photo`);
    }

    const gallery = [];
    for (let i = 0; i < gallerySpec.length; i++) {
      const g = gallerySpec[i];
      const info = await imageInfo(g.commons);
      const dest = join(IMG, `${id}-${i + 1}.jpg`);
      const size = await download(info.thumb, dest);
      gallery.push({
        src: `assets/img/${id}-${i + 1}.jpg`,
        kind: g.kind || 'exterior',
        caption_ru: g.caption_ru || '',
        credit: info.credit,
        _commons: info.title,
      });
      console.log(`${id}: gallery ${i + 1} ${info.title} -> ${(size / 1024).toFixed(0)} KB`);
    }
    if (gallery.length) c.gallery = gallery;

    c._main_commons = mainTitle || c._main_commons;
    delete c.main_photo;
    writeFileSync(path, JSON.stringify(c, null, 2) + '\n');
    console.log(`${id}: fragment updated`);
  } catch (e) {
    console.error(`${id}: FAILED — ${e.message}`);
    process.exitCode = 1;
  }
}
