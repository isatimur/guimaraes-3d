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
import { bbox, clean, offset, centroid, area, edges, rect } from '../geom.js';

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
    // main volume: plinth, banded concrete frame, flat deck and parapet
    k.prism(pts, -0.8, h + 0.8, wall, { mat: 3 });
    k.prism(offset(pts, 0.22), -0.8, 1.5, CONCRETE_DARK, { mat: 1 });
    k.prism(offset(pts, 0.1), h * 0.5, 0.3, CONCRETE_DARK, { mat: 1 });
    k.prism(pts, h, 0.4, 'lead'); // flat dark roof deck
    k.prism(offset(pts, 0.18), h + 0.4, 0.5, CONCRETE, { mat: 1 }); // parapet upstand
    const storeys = Math.max(1, Math.round(h / 3.2));
    if (a > 60) ribbonWindows(k, pts, 0, {
      storeys, first: 1.0, storey: 3.2, h: 1.5, margin: 1.4,
      minLen: a > 900 ? 9 : 6, emit: 0.12, trim: CONCRETE_DARK, out: 0.05,
    });
    // bigger teaching blocks: a ground colonnade and a glazed entrance atrium
    if (a > 400) {
      const fe = edges(pts).reduce((x, e) => (e.len > (x?.len ?? 0) ? e : x), null);
      if (fe) {
        k.push({ x: fe.mx + fe.nx * 0.05, y: 0, z: fe.mz + fe.nz * 0.05, ry: fe.ry });
        const n = Math.max(3, Math.floor(fe.len / 5));
        for (let i = 0; i <= n; i++) k.box(0.35, 3.6, 0.35, CONCRETE, -fe.len / 2 + (i * fe.len) / n, 0, 0.15, { mat: 1 });
        k.box(fe.len, 0.5, 0.6, CONCRETE, 0, 3.6, 0.15, { mat: 1 });
        k.box(Math.min(9, fe.len * 0.3), 4.6, 1.4, 'glass', 0, 0, 0.75, { emit: 0.16, mat: 0 });
        k.box(Math.min(10, fe.len * 0.34), 0.35, 2.4, CONCRETE, 0, 4.6, 0.9, { mat: 1 });
        k.pop();
      }
    }
    // roof plant on the big flat blocks
    const b = bbox(pts);
    if (a > 700) k.box(Math.min(6, b.w * 0.2), 0.9, Math.min(4, b.d * 0.2), WHITE, b.cx, h + 0.4, b.cz);
    if (a > 1600) k.box(Math.min(4, b.w * 0.14), 1.6, Math.min(3, b.d * 0.16), CONCRETE_DARK, b.cx + 4, h + 0.4, b.cz - 2);
    if (isG2) k.end('height');
  }

  // --- footpaths as light bands
  for (const p of paths) {
    if (!p.pts || p.pts.length < 2) continue;
    band(k, p.pts, 2.4, 0.08, 'graniteGrey', { mat: 8, step: 10 });
  }
  // --- garden and pond
  for (const p of footprint.partsOf('garden')) {
    const gp = clean(p.pts, 0.5);
    k.prism(gp, -0.1, 0.25, 'grass', { mat: 5 });
    const gb = bbox(gp);
    if (gb.w > 40) {
      // clipped hedges and a gravel walk across the larger gardens
      for (let i = 0; i < Math.floor(gb.w / 22); i++) {
        const hx = gb.x0 + 12 + i * 22;
        k.box(9, 0.7, 2.2, 'hedge', hx, 0.15, gb.cz, { mat: 5 });
      }
      k.box(gb.w - 8, 0.14, 3, 'graniteGrey', gb.cx, 0.15, gb.cz - 6, { mat: 8 });
    }
  }
  for (const p of footprint.partsOf('water')) {
    const wp = clean(p.pts, 0.4);
    k.prism(wp, -0.1, 0.4, 'water', { mat: 7, emit: 0.2 });
    // a timber deck and rail on one edge of the campus pond
    const wb = bbox(wp);
    if (wb.w > 8) k.box(wb.w * 0.5, 0.1, 2.2, 'wood', wb.cx, 0.3, wb.z0 - 1.1, { mat: 8 });
  }

  // --- the entrance plaza and car park on the Alameda frontage
  {
    const b = bbox(O);
    const pz = b.z1 - 14;
    k.prism(rect(b.cx, pz, 40, 18), 0.02, 0.14, 'graniteGrey', { mat: 8 });
    k.prism(rect(b.cx, pz, 8, 8), 0.16, 0.3, 'graniteLight', { holes: [rect(b.cx, pz, 5, 5)] });
    k.prism(rect(b.cx, pz, 5, 5), 0.2, 0.05, 'water', { emit: 0.28 });
    for (let i = -3; i <= 3; i++) {
      k.box(0.16, 5.2, 0.16, 'steel', b.cx + i * 6, 0.1, pz, { mat: 9 });
      k.sphere(0.34, 0xefdca0, b.cx + i * 6, 5.4, pz, { seg: 7, rings: 4, emit: 0.6 });
    }
    // parking bays with low kerbs on the west side of the plaza
    for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) {
      const x = b.x0 + 14 + i * 3.0;
      const z = pz + 8 + r * 6;
      k.box(2.6, 0.06, 5.0, 'graniteGrey', x, 0.05, z, { mat: 8 });
    }
  }
  k.end('main');
}

uminho.metric = true;
uminho.rule = {
  extent: [/building/],
  view: 0.7,
  note: 'every OSM building part drawn on its real polygon (flat roofs, ribbon glazing), paths as light bands, campus ground and hedge on the outline; height 16 m at the G2 residence',
};

export default { 'uminho-azurem': uminho };
