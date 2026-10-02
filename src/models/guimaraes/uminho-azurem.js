// Universidade do Minho, Campus de Azurém, metric builder (1:1 metres).
//
// data/dimensions.json: the OSM outline (way 182091438) is the whole campus
// (785.3 x 422.9 m, 17.8 ha); the parts are 36 buildings (every OSM building
// inside), a garden, a pond and 68 footpaths. Local frame: +z = the main
// entrance on Alameda da Universidade (south-west edge). Every building is
// drawn on its real part polygon with flat roofs and ribbon glazing; the
// paths are light bands, the garden and pond flat slabs. Height 16 m (the
// Residência Bloco G2, five levels). The boundary hedge and ground slab sit
// on the real outline so the model covers the campus extent exactly.
import * as THREE from 'three';
import { ribbonWindows } from '../parts.js';
import { bbox, clean, offset, centroid, area } from '../geom.js';

const CONCRETE = 'graniteLight';
const CONCRETE_DARK = 'graniteGrey';
const WHITE = 'plaster';

// Flat ribbon of width w along a polyline at height y (paths, kerbs).
function band(k, line, w, y, color, o = {}) {
  const pts = [];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(L / (o.step ?? 10)));
    for (let j = i === 1 ? 0 : 1; j <= n; j++) pts.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n]);
  }
  if (pts.length < 2) return;
  const side = (i) => {
    const a = pts[Math.max(0, i - 1)];
    const c = pts[Math.min(pts.length - 1, i + 1)];
    let dx = c[0] - a[0];
    let dz = c[1] - a[1];
    const L = Math.hypot(dx, dz) || 1;
    dx /= L;
    dz /= L;
    return [[pts[i][0] - dz * w / 2, pts[i][1] + dx * w / 2], [pts[i][0] + dz * w / 2, pts[i][1] - dx * w / 2]];
  };
  const S = pts.map((_, i) => side(i));
  const pos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [l0, r0] = S[i];
    const [l1, r1] = S[i + 1];
    pos.push(l0[0], y, l0[1], r0[0], y, r0[1], r1[0], y, r1[1]);
    pos.push(l0[0], y, l0[1], r1[0], y, r1[1], l1[0], y, l1[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  k.add(g, color, { flat: true, ...o });
}

function uminho(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const hTotal = H.total ?? 16;
  const O = clean(footprint.outline, 0.4);
  const buildings = footprint.partsOf('building');
  const paths = footprint.partsOf('path');

  k.begin('main');
  // --- campus ground and the boundary hedge on the real outline
  k.prism(O, -0.6, 0.55, 'grass', { mat: 5 });
  for (let i = 0; i < O.length; i++) k.wallLine(O[i], O[(i + 1) % O.length], 1.3, 0.8, 'hedge', 0, { ext: 0.2, mat: 5 });

  // --- buildings on their real part polygons
  for (const p of buildings) {
    const pts = clean(p.pts, 0.5);
    if (pts.length < 3) continue;
    const a = Math.abs(area(pts));
    const c = centroid(pts);
    const isG2 = /G2/.test(p.name || '') || (a > 900 && c[0] > 250 && c[1] > 100);
    const h = Math.min(isG2 ? hTotal : (p.height_m ?? 7), 15.2);
    const wall = a > 1200 ? CONCRETE : a > 300 ? (Math.abs(c[0]) % 2 > 1 ? CONCRETE : WHITE) : WHITE;
    if (isG2) k.begin('height');
    k.prism(pts, -0.8, h + 0.4 + 0.8, wall, { mat: 3 });
    k.prism(pts, h, 0.4, 'lead'); // flat dark roof deck
    k.prism(offset(pts, 0.18), h - 0.5, 0.5, CONCRETE_DARK); // eaves band
    const storeys = Math.max(1, Math.round(h / 3.2));
    if (a > 60) ribbonWindows(k, pts, 0, {
      storeys, first: 1.0, storey: 3.2, h: 1.5, margin: 1.4,
      minLen: a > 900 ? 9 : 6, emit: 0.12, trim: CONCRETE_DARK, out: 0.05,
    });
    // roof plant on the big flat blocks
    const b = bbox(pts);
    if (a > 700) k.box(Math.min(6, b.w * 0.2), 0.9, Math.min(4, b.d * 0.2), WHITE, b.cx, h + 0.4, b.cz);
    if (isG2) k.end('height');
  }

  // --- footpaths as light bands
  for (const p of paths) {
    if (!p.pts || p.pts.length < 2) continue;
    band(k, p.pts, 2.4, 0.08, 'graniteGrey', { mat: 8, step: 10 });
  }
  // --- garden and pond
  for (const p of footprint.partsOf('garden')) k.prism(clean(p.pts, 0.5), -0.1, 0.25, 'grass', { mat: 5 });
  for (const p of footprint.partsOf('water')) k.prism(clean(p.pts, 0.4), -0.1, 0.4, 'water', { mat: 7, emit: 0.2 });
  k.end('main');
}

uminho.metric = true;
uminho.rule = {
  extent: [/building/],
  view: 0.7,
  note: 'every OSM building part drawn on its real polygon (flat roofs, ribbon glazing), paths as light bands, campus ground and hedge on the outline; height 16 m at the G2 residence',
};

export default { 'uminho-azurem': uminho };
