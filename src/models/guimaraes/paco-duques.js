// Paço dos Duques de Bragança (begun 1420-22, restored 1937-59), metric
// builder. data/dimensions.json: OSM relation 2433235 is a near-square block
// (63.5 x 61.4 m, 3370 m²) with a central courtyard as its inner ring
// (465 m²); 3 storeys, eaves ~14 m, four corner towers and 39 chimneys
// topping out near 22 m. footprints.json carries the outer way and (from
// the OSM relation, projected here) the courtyard ring, kept open.
//
// Frame (fit.js): +z is the north-west front (bearing 294) over the Colina
// Sagrada. The plan is the real comb-shaped outline with a courtyard hole:
// three wings to the south (-z), the ranges round the garth, a stepped
// north front. From the photos (assets/img/paco-duques*.jpg): grey coursed
// granite, a deep corbel table under the eaves, rows of twin mullioned
// windows, steep tiled roofs with many brick chimneys, and four round
// corner towers with conical roofs. The garth is arcaded on the ground
// floor with a gallery above.
import * as THREE from 'three';
import { corniceProfile, MAT } from '../kit.js';
import { win, cartouche } from '../parts.js';
import { bbox, offset, edges } from '../geom.js';
import { polyWindows, onEdge, polyCornice } from '../metric.js';

const G = 'granite';
const T = 'graniteWarm';
const L = 'graniteLight';
const D = 'graniteDark';

// The courtyard ring from OSM relation 2433235 (way 182728792), in local m.
const COURTYARD = [[-12.3, 10.8], [-12.9, -7.66], [12.1, -8.35], [12.69, 10.11]];

// Monumental brick chimney: tapered stack, corbelled granite cap, pots.
function chimney(k, x, z, y0, h) {
  k.box(0.92, h, 0.92, 'brick', x, y0, z, { jit: 0.05 });
  k.box(1.06, 0.22, 1.06, L, x, y0 + h, z, { jit: 0.04 });
  k.box(1.4, 0.3, 1.4, 'graniteLight', x, y0 + h + 0.22, z, { jit: 0.04 });
  for (const [ox, oz] of [[-0.32, -0.32], [0.32, 0.32], [-0.32, 0.32], [0.32, -0.32]]) k.cyl(0.12, 0.16, 0.55, 6, 'terracotta', x + ox, y0 + h + 0.52, z + oz);
}

// Twin mullioned window (the palace lights).
function mullion(k, x, y, w, h, z, o = {}) {
  win(k, x, y, w, h, z, { bw: o.bw ?? 0.3, depth: 0.3, pane: 'glass', trim: o.trim ?? T, emit: o.emit ?? 0.12, sill: !!o.sill });
  k.box(0.22, h, 0.24, T, x, y, z + 0.16);
  k.box(w, 0.18, 0.24, T, x, y + h * 0.5, z + 0.16);
}

// Distribute n chimneys along the ridge (x0,z0)-(x1,z1) at height y.
function chimneysAlong(k, n, x0, z0, x1, z1, y) {
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    chimney(k, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, y, 1.9 + (i % 3) * 1.0);
  }
}

function paco(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const eaves = H.eaves ?? 14;
  const total = H.total ?? 22;
  const b = bbox(footprint.outline); // x -30.58..30.58, z -31.65..31.65
  const x0 = b.x0;
  const x1 = b.x1;
  const z0 = b.z0;
  const z1 = b.z1;
  const cy = COURTYARD;
  const rise = 4;
  const ridge = eaves + rise;
  const towerR = 4.2;
  const towerTop = 17;

  k.begin('main');
  // ranges on the real outline with the courtyard open: a granite lower
  // storey under whitewashed upper floors (the alternating palace tone),
  // plus a battered plinth
  k.prism(footprint.outline, -1.0, 6.0, G, { holes: [cy] });
  k.prism(footprint.outline, 4.8, eaves - 4.8, 'plaster', { holes: [cy], mat: 3 });
  k.prism(offset(footprint.outline, 0.22), -1.0, 1.6, D, { holes: [offset(cy, -0.22)] });
  k.prism(offset(footprint.outline, 0.16), 4.7, 0.35, L, { holes: [offset(cy, -0.16)] });
  polyCornice(k, footprint.outline, eaves - 0.55, corniceProfile('eave', 0.55), L);
  polyCornice(k, [...cy].reverse(), eaves - 0.55, corniceProfile('band', 0.45), L);
  // granite corner quoins on the four outer corners
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const qx = sx > 0 ? x1 : x0;
    const qz = sz > 0 ? z1 : z0;
    for (let c = 0; c * 0.95 < eaves - 1; c++) {
      const y = 0.6 + c * 0.95;
      const long = c % 2 ? 0.95 : 0.55;
      const short = c % 2 ? 0.55 : 0.95;
      k.box(long, 0.88, short, L, qx + sx * (long / 2 - 0.42), y, qz + sz * (short / 2 - 0.42), { jit: 0.05 });
    }
  }

  // ---- deep corbel table under the outer eaves (the palace's trademark)
  for (const e of edges(footprint.outline)) {
    if (e.len < 2) continue;
    onEdge(k, e, 0, 0);
    const n = Math.max(2, Math.round(e.len / 1.5));
    for (let i = 0; i < n; i++) {
      const u = -e.len / 2 + (i + 0.5) * (e.len / n);
      for (let s = 0; s < 3; s++) k.box(0.42, 0.26, 0.24 + s * 0.16, T, u, eaves - 1.5 + s * 0.34, 0.1 + s * 0.08, { jit: 0.05 });
    }
    k.pop();
  }

  // ---- roofs over the ranges and the three south wings (tiled, steep)
  k.hipRoof(12.6, 20.9, rise, 'terracotta', -24.3, eaves, 21.2, { over: 0.5, mat: MAT.tile });
  k.hipRoof(34.1, 13.3, rise, 'terracotta', -0.95, eaves, 17.4, { over: 0.5, mat: MAT.tile });
  k.hipRoof(14.5, 18.1, rise, 'terracotta', 23.3, eaves, 19.8, { over: 0.5, mat: MAT.tile });
  k.hipRoof(61.2, 14.3, rise, 'terracotta', 0, eaves, -15.5, { over: 0.5, mat: MAT.tile });
  k.hipRoof(17.7, 19.2, rise, 'terracotta', -21.7, eaves, 1.2, { over: 0.5, mat: MAT.tile });
  k.hipRoof(17.9, 19.2, rise, 'terracotta', 21.6, eaves, 1.2, { over: 0.5, mat: MAT.tile });
  k.hipRoof(11.6, 9.0, 2.6, 'terracotta', -24.8, eaves, -27.2, { over: 0.5, mat: MAT.tile });
  k.hipRoof(13.9, 9.0, 2.6, 'terracotta', -2.9, eaves, -27.2, { over: 0.5, mat: MAT.tile });
  k.hipRoof(13.8, 9.0, 2.6, 'terracotta', 23.5, eaves, -27.2, { over: 0.5, mat: MAT.tile });
  // 39 chimneys along the ridges
  chimneysAlong(k, 2, -24.3, 15.7, -24.3, 26.7, ridge);
  chimneysAlong(k, 8, -16, 17.4, 14, 17.4, ridge);
  chimneysAlong(k, 3, 23.3, 14.3, 23.3, 25.3, ridge);
  chimneysAlong(k, 10, -26, -15.5, 26, -15.5, ridge);
  chimneysAlong(k, 4, -21.7, -5, -21.7, 8, ridge);
  chimneysAlong(k, 3, 21.6, -5, 21.6, 8, ridge);
  chimneysAlong(k, 3, -24.8, -29, -18, -29, ridge - 1.2);
  chimneysAlong(k, 3, -6, -29, 1, -29, ridge - 1.2);
  chimneysAlong(k, 3, 20, -29, 27, -29, ridge - 1.2);

  // ---- four round corner towers with conical roofs to the 22 m total
  const towers = [[-26.2, 27.6], [26.5, 25.0], [-26.3, -26.9], [26.3, -27.6]];
  for (const [tx, tz] of towers) {
    k.cyl(towerR - 0.5, towerR, towerTop - 2, 12, G, tx, 0, tz, { jit: 0.0 });
    k.cyl(towerR - 0.02, towerR - 0.06, 0.3, 12, L, tx, eaves - 0.4, tz);
    k.cyl(towerR - 0.02, towerR - 0.06, 0.3, 12, L, tx, towerTop - 2.3, tz);
    // corbelled crown
    const nc = 12;
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * Math.PI * 2;
      k.box(0.4, 0.4, 0.5, T, tx + Math.cos(a) * (towerR - 0.05), towerTop - 2.0, tz + Math.sin(a) * (towerR - 0.05), { ry: -a, jit: 0.05 });
    }
    k.cyl(towerR + 0.1, towerR + 0.1, 2.0, 12, G, tx, towerTop - 2.2, tz);
    // a mullioned window on each tower facing +z and +x
    mullion(k, tx, 6.6, 1.3, 2.2, tz + towerR - 0.05, { bw: 0.24, emit: 0.1 });
    mullion(k, tx, 10.8, 1.1, 1.8, tz + towerR - 0.05, { bw: 0.22, emit: 0.1 });
    // conical slate roof to 22 m
    k.cone(towerR + 0.3, total - towerTop, 12, 'slate', tx, towerTop, tz, { smooth: false });
    k.cyl(0.1, 0.14, 0.8, 5, 'iron', tx, total - 0.4, tz);
  }

  // ---- rows of twin mullioned windows on the outer walls and the garth
  polyWindows(k, footprint.outline, {
    storeys: [2.0, 6.4, 10.6],
    bay: 7.0,
    w: 1.35,
    h: 2.3,
    minLen: 4,
    win: { bw: 0.28, depth: 0.28, trim: T, pane: 'glass', bars: false, emit: 0.12 },
  });
  polyWindows(k, [...cy].reverse(), {
    storeys: [6.4, 10.6],
    bay: 5.5,
    w: 1.25,
    h: 2.2,
    minLen: 4,
    out: 0.02,
    win: { bw: 0.26, depth: 0.24, trim: T, pane: 'glass', emit: 0.12 },
  });
  // add the mullion bars and sills over the front and garth windows
  for (const e of edges(footprint.outline)) {
    if (e.len < 6) continue;
    onEdge(k, e, 0, 0.02);
    const n = Math.max(2, Math.floor((e.len - 1) / 7.0));
    const pitch = (e.len - 1) / n;
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * pitch) / 2 + i * pitch;
      for (const y of [2.0, 6.4, 10.6]) {
        k.box(0.22, 2.3, 0.24, T, u, y, 0.16);
        k.box(1.35, 0.18, 0.24, T, u, y + 1.15, 0.16);
      }
    }
    k.pop();
  }

  // ---- arcaded courtyard: round arches on the garth edges, gallery above
  const gcx = (cy[0][0] + cy[2][0]) / 2;
  const gcz = (cy[0][1] + cy[1][1]) / 2;
  const sides = [
    { a: [cy[0][0], 10.8], bb: [cy[3][0], 10.11], ry: Math.PI }, // north garth edge faces -z
    { a: [cy[1][0], -7.66], bb: [cy[2][0], -8.35], ry: 0 }, // south edge faces +z
    { a: [cy[1][0], -7.66], bb: [cy[0][0], 10.8], ry: Math.PI / 2 }, // west edge faces +x
    { a: [cy[2][0], -8.35], bb: [cy[3][0], 10.11], ry: -Math.PI / 2 }, // east edge faces -x
  ];
  for (const s of sides) {
    const len = Math.hypot(s.bb[0] - s.a[0], s.bb[1] - s.a[1]) - 0.6;
    const cx = (s.a[0] + s.bb[0]) / 2;
    const cz = (s.a[1] + s.bb[1]) / 2;
    const n = Math.max(2, Math.round(len / 3.4));
    k.push({ x: cx, z: cz, ry: s.ry });
    k.arcade(len, 4.4, 0.6, n, (len / n) * 0.66, 3.2, L, 0, 0, 0, { mat: MAT.ashlar });
    for (let i = 0; i <= n; i++) k.box(0.55, 4.4, 0.8, D, -len / 2 + (i * len) / n, 0, 0.1);
    k.pop();
  }
  // central fountain of the garth
  k.cyl(1.6, 1.8, 0.7, 12, G, gcx, 0, gcz);
  k.cyl(1.5, 1.5, 0.12, 12, 'water', gcx, 0.6, gcz);
  k.cyl(0.3, 0.4, 2.4, 8, G, gcx, 0.6, gcz);
  k.lathe([[0, 0], [0.3, 0], [0.2, 0.35], [0.22, 0.55], [0.95, 0.66], [1, 1], [0.9, 1], [0, 0.88]], 10, G, gcx, 2.6, gcz, { sr: 1.0, sh: 0.8, smooth: true });
  k.cyl(0.06, 0.1, 0.9, 5, 'water', gcx, 3.4, gcz, { emit: 0.5 });

  // ---- the north-west front: a grand round-arched portal with the arms
  const zf = 24.05; // the middle reach of the stepped north front
  const px = 2.0;
  k.surround({ x: px, y: 0, w: 2.6, h: 4.6, arch: 'round' }, 0.5, 0.4, T, zf);
  k.plane((() => { const s = new THREE.Shape(); const r = 1.3; s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, 3.3); s.absarc(0, 3.3, r, 0, Math.PI, false); s.lineTo(-r, 0); return s; })(), 'dark', px, 0, zf + 0.05, { mat: MAT.flat });
  for (let i = 0; i < 3; i++) k.box(0.14, 2.0, 0.2, L, px - 0.6 + i * 0.6, 0.2, zf + 0.12);
  cartouche(k, 1.4, 1.7, 0.3, L, px, 5.6, zf + 0.15, { inlay: T });
  k.box(3.2, 0.4, 1.0, T, px, 4.6, zf + 0.5);
  k.balustrade(2.6, 1.0, L, px, 5.0, zf + 0.9, { cheap: true, d: 0.24, sp: 0.4 });
  k.end('main');

  // height group reaches the chimney/tower crown
  k.begin('height');
  k.box(0.3, 0.3, 0.3, 'dark', 0, total - 0.3, 0);
  k.end('height');
  void corniceProfile;
}

paco.metric = true;
paco.rule = {
  view: 0.35,
  note: 'real OSM comb outline with the OSM courtyard ring kept open (garnered from relation 2433235, way 182728792); 3 storeys to 14 m eaves, tiled ranges, four round corner towers and 39 chimneys to 22 m (dims estimate). Corbel table and twin mullioned windows from the photos.',
};

export default { 'paco-duques': paco };
