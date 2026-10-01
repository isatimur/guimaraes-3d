// Fetch every OSM building footprint in the city's core bbox and write <data dir>/buildings.json.
// Node 22, no dependencies. Run after fetch-footprints.mjs (it reads <data dir>/footprints.json
// to exclude the landmark objects). Run: node scripts/fetch-buildings.mjs [--city <id>] [--dry-run]
// (default city: braga; see cities/<id>.json)
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CITY, BBOX, ORIGIN, overpass, wait, simplifyRing, ringArea, centroid, toXY, r5, tagHeight, dataPath, cachePath, dataRel } from './geo-lib.mjs';

const OUT = dataPath('buildings.json');
const FOOT = dataPath('footprints.json');
const CACHE_DIR = cachePath();
const GRID = 3;
const TOL_M = 1;
const MAX_BYTES = 8 * 1024 * 1024;
const CENTRAL_R_M = 2000;
const SMALL_M2 = 25;

if (process.argv.includes('--dry-run')) {
  console.log(`city ${CITY.id}; data dir ${dataRel()}`);
  console.log('bbox', BBOX, 'origin', ORIGIN, `grid ${GRID}x${GRID}`);
  console.log(`out ${dataRel('buildings.json')}; footprints ${dataRel('footprints.json')}; cache ${dataRel('.cache')}/buildings-r<i>c<j>.json`);
  process.exit(0);
}

// ---- 1. Download a 3x3 grid of tiles (cached, so a re-run does not hit Overpass) ----
mkdirSync(CACHE_DIR, { recursive: true });
const tiles = [];
for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
  const s = BBOX.s + ((BBOX.n - BBOX.s) * i) / GRID, n = BBOX.s + ((BBOX.n - BBOX.s) * (i + 1)) / GRID;
  const w = BBOX.w + ((BBOX.e - BBOX.w) * j) / GRID, e = BBOX.w + ((BBOX.e - BBOX.w) * (j + 1)) / GRID;
  tiles.push({ name: `r${i}c${j}`, b: [s, w, n, e].map(v => v.toFixed(5)).join(',') });
}

const byKey = new Map(); // "w123" / "r456" -> element (dedup across tile borders)
for (const t of tiles) {
  const file = join(CACHE_DIR, `buildings-${t.name}.json`);
  let els;
  if (existsSync(file)) {
    els = JSON.parse(readFileSync(file, 'utf8'));
  } else {
    const q = `[out:json][timeout:180];(way["building"](${t.b});relation["building"]["type"="multipolygon"](${t.b}););out geom;`;
    els = await overpass(q, { label: t.name, allowEmpty: true });
    writeFileSync(file, JSON.stringify(els));
    await wait(2000);
  }
  for (const el of els) byKey.set(el.type[0] + el.id, el);
  console.log(`tile ${t.name}: ${els.length} elements (total unique ${byKey.size})`);
}

// ---- 2. Landmark exclusion list ----
const excludeIds = new Set();
const excludeOutlines = [];
if (existsSync(FOOT)) {
  const fp = JSON.parse(readFileSync(FOOT, 'utf8'));
  for (const v of Object.values(fp)) {
    for (const id of v.osm_ids || []) excludeIds.add(id);
    if (v.exclude_outline) excludeOutlines.push(v.outline.map(toXY));
  }
} else {
  console.warn(`WARNING: ${dataRel('footprints.json')} missing; landmarks are NOT excluded. Run fetch-footprints.mjs first.`);
}

function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- 3. Geometry: ways are rings; multipolygons keep outer rings, holes dropped ----
function joinRings(ways) {
  const rings = [];
  const open = ways.map(w => w.slice());
  while (open.length) {
    let cur = open.shift();
    let guard = 0;
    while ((cur[0][0] !== cur.at(-1)[0] || cur[0][1] !== cur.at(-1)[1]) && guard++ < 1000) {
      const end = cur.at(-1);
      const k = open.findIndex(o => (o[0][0] === end[0] && o[0][1] === end[1]) || (o.at(-1)[0] === end[0] && o.at(-1)[1] === end[1]));
      if (k < 0) break;
      const nxt = open.splice(k, 1)[0];
      cur = cur.concat(nxt[0][0] === end[0] && nxt[0][1] === end[1] ? nxt.slice(1) : nxt.reverse().slice(1));
    }
    if (cur.length >= 4) rings.push(cur);
  }
  return rings;
}

function ringsOf(el) {
  if (el.type === 'way') return el.geometry && el.geometry.length >= 4 ? [el.geometry.map(g => [g.lat, g.lon])] : [];
  const outers = (el.members || []).filter(m => m.type === 'way' && m.role !== 'inner' && m.geometry?.length >= 2)
    .map(m => m.geometry.map(g => [g.lat, g.lon]));
  return joinRings(outers);
}

const HOUSE = new Set(['house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'residential', 'farm', 'yes', 'cabin', 'static_caravan']);
const SMALL = new Set(['garage', 'garages', 'shed', 'hut', 'carport', 'roof', 'kiosk', 'toilets', 'greenhouse']);
const KIND = {
  residential: ['house', 'detached', 'semidetached_house', 'terrace', 'bungalow', 'residential', 'apartments', 'dormitory', 'farm', 'cabin', 'static_caravan'],
  commercial: ['commercial', 'retail', 'office', 'supermarket', 'hotel', 'kiosk', 'mall'],
  industrial: ['industrial', 'warehouse', 'factory', 'manufacture', 'hangar', 'storage_tank', 'service', 'barn', 'farm_auxiliary'],
  church: ['church', 'chapel', 'cathedral', 'basilica', 'religious', 'monastery', 'convent', 'mosque', 'temple', 'shrine', 'synagogue'],
  public: ['public', 'civic', 'government', 'school', 'university', 'college', 'hospital', 'kindergarten', 'townhall', 'train_station', 'transportation', 'stadium', 'sports_hall', 'sports_centre', 'museum', 'fire_station', 'library'],
};
const kindMap = new Map();
for (const [k, list] of Object.entries(KIND)) for (const v of list) kindMap.set(v, k);

const R_CENTRE = CENTRAL_R_M;
const all = [];
let excludedById = 0, excludedByOutline = 0, badGeom = 0;
for (const [key, el] of byKey) {
  if (excludeIds.has(key)) { excludedById++; continue; }
  const tags = el.tags || {};
  const bval = tags.building || 'yes';
  const th = tagHeight(tags);
  const h = th ? th.h : SMALL.has(bval) ? 3.5 : HOUSE.has(bval) ? 7 : 12;
  const k = kindMap.get(bval) || (tags.amenity === 'place_of_worship' ? 'church' : 'other');
  for (const ring of ringsOf(el)) {
    const c = centroid(ring);
    const cxy = toXY(c);
    if (excludeOutlines.some(p => pointInPoly(cxy, p))) { excludedByOutline++; continue; }
    const simp = simplifyRing(ring, TOL_M).map(([a, b]) => [r5(a), r5(b)]);
    const pts = simp.filter((p, i) => i === 0 || p[0] !== simp[i - 1][0] || p[1] !== simp[i - 1][1]);
    if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
    if (pts.length < 3) { badGeom++; continue; }
    const area = Math.abs(ringArea(ring));
    all.push({ b: { p: pts, h, k }, area, dist: Math.hypot(cxy[0], cxy[1]) });
  }
}

// ---- 4. Size budget: drop < 25 m² outside the central 2 km only if needed ----
const build = list => JSON.stringify({ origin: ORIGIN, bbox: BBOX, buildings: list.map(x => x.b) });
let kept = all, json = build(kept), dropped = 0;
if (json.length > MAX_BYTES) {
  kept = all.filter(x => !(x.area < SMALL_M2 && x.dist > R_CENTRE));
  dropped = all.length - kept.length;
  json = build(kept);
  console.log(`Size over 8 MB: dropped ${dropped} buildings < ${SMALL_M2} m² outside ${R_CENTRE} m`);
}
writeFileSync(OUT, json);
const kinds = {};
for (const x of kept) kinds[x.b.k] = (kinds[x.b.k] || 0) + 1;
console.log(`Wrote ${OUT}: ${kept.length} buildings, ${(json.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`excluded landmark ids ${excludedById}, excluded inside landmark outlines ${excludedByOutline}, bad geometry ${badGeom}, dropped small ${dropped}`);
console.log('kinds', kinds);
if (json.length > MAX_BYTES) console.warn('WARNING: file still larger than 8 MB');
