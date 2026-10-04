// Largo do Toural, metric builder (1:1 metres).
//
// Frame (fit.js): +z = 245.9 deg, from the square centre toward the Igreja
// de São Pedro (dimensions.json). The OSM outline (w591247671, 129.7 x
// 44.8 m) is the whole largo including the garden; the Chafariz do Toural
// (w591247672, an 18-polygon, 18th c.) is a water part and the Igreja de
// São Pedro a church part beyond the outline to the front. The 18th-c.
// house fronts line the side opposite the church.
// From data/dimensions.json: São Pedro front/pediment 20 m, fountain 6 m,
// garden opened 1878 (three basins, requalified 2012).
// From the photos: a granite terrace of 3-storey house fronts with granite
// ground floors, the broad pedimented church front, and the tiered
// baroque fountain in a small parterre garden.
import { corniceProfile, MAT, PROFILES } from '../kit.js';
import { win, pediment, cartouche } from '../parts.js';
import { bbox, offset, edges, centroid } from '../geom.js';
import { polyCornice } from '../metric.js';
import { lowTree } from '../drape.js';

const G = 'granite';
const GL = 'graniteLight';
const GD = 'graniteDark';

// The longest edge of a polygon whose normal points toward `dir`.
function edgeFacing(pts, dir) {
  let best = null;
  for (const e of edges(pts)) {
    if (e.len < 5) continue;
    const d = e.nx * dir[0] + e.nz * dir[1];
    if (best === null || d > best.d) best = { e, d };
  }
  return best && best.d > 0.3 ? best.e : null;
}

// A cheap framed window (granite frame, glass, splayed sill, shutters).
function bay(k, x, y, w, h, z, o = {}) {
  k.box(w + 0.45, h + 0.45, 0.14, o.trim ?? GL, x, y - 0.22, z + 0.03);
  k.box(w, h, 0.1, 'glass', x, y, z + 0.09, { emit: o.emit ?? 0.08, mat: MAT.flat });
  k.box(w + 0.8, 0.14, 0.28, o.trim ?? GL, x, y - 0.3, z + 0.1);
  for (const s of [-1, 1]) k.box(w * 0.4, h * 0.92, 0.07, 'wood', x + s * (w / 2 + w * 0.22), y + h * 0.04, z + 0.24);
}

// A terrace of `n` house fronts along an OSM edge: granite shopfronts or
// round-arched arcades, plaster upper storeys, tile roofs, built inside the
// square. The wider fronts carry an arcade, the narrow ones a shopfront.
function terrace(k, e, depth, h, n) {
  const pitch = e.len / n;
  for (let i = 0; i < n; i++) {
    const u = -e.len / 2 + (i + 0.5) * pitch;
    const tag = i % 3;
    const hh = h + (tag === 1 ? 1.6 : 0) - (tag === 2 ? 1.2 : 0);
    // centre the block on the inward side of the edge; local +z = inward
    const x = e.mx - e.nx * (depth / 2) + e.ex * u;
    const z = e.mz - e.nz * (depth / 2) + e.ez * u;
    k.push({ x, z, ry: e.ry + Math.PI });
    k.box(pitch - 0.1, hh, depth, tag === 0 ? 'ochre' : tag === 1 ? 'cream' : 'plaster', 0, -1, 0);
    k.box(pitch - 0.1, 3.2, depth + 0.16, G, 0, 0, 0);
    k.cornice(pitch, corniceProfile('eave', 0.4), GL, 0, hh - 0.4, 0);
    k.hipRoof(pitch - 0.1, depth, 1.4, 'terracotta', 0, hh, 0, { over: 0.35, mat: MAT.tile });
    // granite pilasters between the bays and a moulded string course
    for (const pu of [-pitch / 2, pitch / 2]) k.box(0.5, hh - 3.4, 0.35, GL, pu, 3.2, depth / 2 - 0.02, { mat: MAT.ashlar });
    k.box(pitch, 0.3, depth + 0.2, GL, 0, 3.2, 0, { mat: MAT.ashlar });
    // ground floor: an arcade of round arches on the wider fronts, else a shop
    const zf = depth / 2 + 0.02;
    if (pitch >= 6.5) {
      k.arcade(pitch - 0.9, 3.1, 0.45, 2, pitch * 0.31, 2.65, G, 0, 0, zf - 0.1, { mat: MAT.ashlar });
      k.box(pitch - 1.0, 2.65, 0.2, 'dark', 0, 0, zf - 0.5);
      for (const cu of [-pitch / 4, pitch / 4]) k.box(0.5, 0.28, 0.5, GL, cu, 2.38, zf - 0.12, { mat: MAT.ashlar });
    } else {
      const sw = pitch * 0.62;
      k.box(sw, 2.7, 0.14, 'dark', 0, 0.05, zf);
      k.box(sw * 0.7, 1.8, 0.08, 'wood', 0, 0.3, zf + 0.08);
      k.box(sw + 0.3, 0.22, 0.3, GL, 0, 2.75, zf + 0.06);
    }
    // door, stone steps and upper shuttered windows
    k.box(1.1, 2.5, 0.12, 'wood', pitch * 0.32, 0.05, zf + 0.04);
    k.box(1.6, 0.18, 0.7, GL, pitch * 0.32, 0.02, zf + 0.3);
    bay(k, 0, 4.2, 1.0, 1.5, zf, {});
    if (hh > 12) bay(k, 0, 7.4, 1.0, 1.6, zf, {});
    // chimney and ridge tiles
    k.box(0.8, 1.6, 0.8, 'plaster', pitch * 0.28, hh + 0.3, 0);
    k.box(1.0, 0.24, 1.0, GL, pitch * 0.28, hh + 1.9, 0);
    for (let r = -depth / 2 + 0.6; r < depth / 2 - 0.4; r += 1.1) k.box(0.5, 0.16, 1.05, 'terracotta', 0, hh + 1.4, r);
    k.pop();
  }
}

function church(k, P, dims) {
  const b = bbox(P.pts);
  const hTop = dims?.height_m?.sao_pedro_pediment ?? 20;
  const cx = b.cx;
  const eave = 13.5;
  const ridge = 17;
  // granite nave and chancel on the OSM part
  k.prism(P.pts, -1.5, eave + 1.5, G);
  k.prism(offset(P.pts, 0.2), -1.5, 1.8, GD);
  polyCornice(k, P.pts, eave - 0.6, corniceProfile('eave', 0.6), GL, { minLen: 3 });
  k.gableRoof(b.w - 0.4, b.d, ridge - eave, 'terracotta', cx, eave, b.cz, { over: 0.5, mat: MAT.tile });
  // side windows between pilasters
  for (const e of edges(P.pts)) {
    if (e.len < 12 || Math.abs(e.nx) < 0.7) continue;
    k.push({ x: e.mx + e.nx * 0.05, z: e.mz + e.nz * 0.05, ry: e.ry });
    const n = Math.max(2, Math.floor(e.len / 6));
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * (e.len / n)) / 2 + i * (e.len / n);
      win(k, u, 6.4, 1.5, 3.4, 0, { arch: 'round', bw: 0.32, depth: 0.28, trim: GL, pane: 'glass', emit: 0.1, sill: true });
      k.box(0.85, eave - 0.6, 0.35, GL, u + (e.len / n) / 2, 0, 0.1);
    }
    k.pop();
  }
  // broad pedimented front facing the square (-z local of the part)
  const zf = b.z0;
  k.push({ x: cx, z: zf, ry: Math.PI });
  k.box(b.w + 0.5, hTop - 4.5, 1.1, G, 0, -1, 0);
  k.box(b.w + 0.5, 0.9, 0.4, GD, 0, 0, 0.55);
  // door, great window, paired pilasters
  win(k, 0, 0.1, 2.9, 4.6, 0.5, { arch: 'round', bw: 0.45, depth: 0.4, trim: GL, pane: 'wood', sill: false });
  for (const s of [-1, 1]) {
    k.box(1.0, 11.5, 0.5, GL, s * (b.w / 2 - 1.0), 0, 0.55);
    k.box(1.0, 11.5, 0.5, GL, s * 2.55, 0, 0.5);
    k.box(1.6, 0.35, 0.7, G, s * (b.w / 2 - 1.0), 11.5, 0.7);
    k.box(1.6, 0.35, 0.7, G, s * 2.55, 11.5, 0.65);
  }
  win(k, 0, 6.6, 2.0, 4.0, 0.55, { arch: 'round', bw: 0.4, depth: 0.35, trim: GL, pane: 'glass', emit: 0.2, sill: true, head: 'seg' });
  cartouche(k, 1.2, 1.3, 0.25, GL, 0, 11.0, 0.75, { scrolls: true });
  // pediment and cross to the real 20 m
  const yp = 11.5;
  pediment(k, b.w + 0.5, 4.0, 0.9, GL, 0, yp, 0.35, { frame: 0.4 });
  k.box(0.5, 0.7, 0.5, GL, 0, yp + 3.6, 0.3);
  k.box(0.16, hTop - (yp + 4.0), 0.16, 'iron', 0, yp + 4.0, 0.3);
  k.box(0.7, 0.14, 0.14, 'iron', 0, yp + 4.9, 0.3);
  k.pop();
}

// The baroque Chafariz do Toural: three tiered basins over an octagonal
// plinth, a column and a crowning figure, to about 6 m.
function fountain(k, pts, h) {
  const [fx, fz] = centroid(pts);
  const r = bbox(pts).w / 2;
  k.cyl(r, r + 0.2, 0.85, 8, G, fx, -0.2, fz);
  k.cyl(r - 0.35, r - 0.35, 0.12, 8, 'water', fx, 0.6, fz, { emit: 0.25 });
  k.cyl(0.55, 0.7, 1.1, 8, GL, fx, 0.6, fz);
  k.lathe(PROFILES.basin, 10, G, fx, 1.7, fz, { sr: 1.6, sh: 0.6, smooth: true });
  k.cyl(0.4, 0.5, 0.9, 8, GL, fx, 2.3, fz);
  k.lathe(PROFILES.basin, 10, G, fx, 3.2, fz, { sr: 1.1, sh: 0.5, smooth: true });
  k.cyl(0.28, 0.36, 1.0, 8, GL, fx, 3.7, fz);
  k.lathe(PROFILES.finial, 8, GL, fx, 4.7, fz, { sr: 0.75, sh: 1.1, smooth: true });
  k.marker('fountain', fx, 0.7, fz, { kind: 'tiered', r: +(r - 0.35).toFixed(2), jet: h });
}

function toural(k, { footprint, dims }) {
  const O = footprint.outline;
  const ob = bbox(O);

  k.begin('mask');
  // paved largo and the garden kerb
  k.prism(O, -0.7, 0.7, 'sand', { mat: MAT.ashlar });
  k.prism(offset(O, 0.3), -0.7, 0.78, GD, { holes: [O] });
  k.end('mask');

  // ------------------------------------------------ 18th-c. house terraces
  // the two long sides of the largo that are not the church front
  const longs = edges(O).filter((e) => e.len > 40).sort((a, b) => b.len - a.len);
  for (const e of longs.slice(0, 2)) terrace(k, e, 6.5, 12.4, Math.max(6, Math.round(e.len / 7)));

  // ------------------------------------------------------------ the church
  const ch = footprint.part(/São Pedro/);
  if (ch) church(k, ch, dims);

  // ------------------------------------------------- the fountain and garden
  const w = footprint.part(/Chafariz/);
  if (w) {
    fountain(k, w.pts, dims?.height_m?.fountain ?? 6);
    // small parterre garden round the fountain
    const wb = bbox(w.pts);
    const gr = [[wb.x0 - 9, wb.z0 - 7], [wb.x1 + 5, wb.z0 - 7], [wb.x1 + 5, wb.z1 + 5], [wb.x0 - 9, wb.z1 + 5]];
    k.prism(gr, -0.7, 0.74, 'grass', { mat: MAT.leaf });
    k.prism(offset(gr, 0.4), -0.7, 0.86, GL, { holes: [gr] });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      k.box(6, 0.7, 2.4, 'hedge', wb.cx + sx * 7, 0.05, wb.cz + sz * 5);
      lowTree(k, wb.cx + sx * 8, 0.1, wb.cz + sz * 6, 7.5, { spread: 0.45, lobes: 1 });
    }
    for (let i = -2; i <= 2; i++) {
      k.box(0.24, 4.2, 0.24, 'steel', wb.cx + i * 5, 0.05, wb.z1 + 5.5, { mat: MAT.metal });
      k.sphere(0.34, 0xefdca0, wb.cx + i * 5, 4.5, wb.z1 + 5.5, { seg: 7, rings: 4, emit: 0.7 });
    }
  }

  // a low garden balustrade along the long garden edge opposite the church
  const bal = edges(O).find((e) => e.len > 60);
  if (bal && w) {
    k.push({ x: bal.mx + bal.nx * 1.5, z: bal.mz + bal.nz * 1.5, ry: bal.ry });
    k.balustrade(bal.len - 6, 0.9, GL, 0, 0.1, 0, { cheap: true, d: 0.22, sp: 0.7 });
    k.pop();
  }
  void ob;
}

toural.metric = true;
toural.rule = {
  extent: [/church/],
  view: 0.45,
  note: 'paved largo on the OSM outline (main/mask); house terraces on the two long sides; the Chafariz do Toural on its OSM polygon with its parterre; the Igreja de São Pedro on its OSM part, front facing the square',
};

export default { toural };
