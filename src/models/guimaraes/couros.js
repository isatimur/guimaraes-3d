// Zona de Couros, metric builder (1:1 metres).
//
// data/dimensions.json: OSM relation 19769884 is seven groups of granite
// tanning tanks (73-665 m2, 1619 m2 in all) along the Ribeira de Couros;
// the outline is their convex hull (140.9 x 81.2 m, matches_osm false) and
// the houses between them stay in buildings.json. The lavoir (way 820481034,
// 9 x 7 m) is a part. Height total 1.2 m: the tank rims stand about 1.2 m
// above the paving. Each OSM group is drawn as a grid of open rectangular
// granite vats with their water, plus the lavoir basin and the low stone
// channel of the stream. The zone is inscribed in the WH list (2023).
import { bbox, offset, clean, inside, rect } from '../geom.js';
import { MAT } from '../kit.js';

const G = 'granite';
const D = 'graniteDark';
const L = 'graniteLight';
const GR = 'graniteGrey';

// A grid of open vats filling an OSM group polygon: a granite apron, a
// coursed kerb, and vats sharing their dividing walls as the real tanning
// tanks do. Some cells are shallower (first steep, then the finishing vats),
// and all hold standing water.
function vats(k, pts, rimH, cell = 3.6) {
  const poly = clean(pts, 0.5);
  if (poly.length < 3) return;
  const inner = offset(poly, -0.42);
  const b = bbox(poly);
  // granite apron and its coping
  k.prism(offset(poly, 0.45), 0, 0.42, GR, { mat: MAT.ashlar });
  k.prism(offset(poly, 0.45), 0.42, 0.1, L, { mat: MAT.ashlar });
  k.prism(poly, 0.32, 0.12, D, { mat: MAT.smooth });
  const w = cell * 0.9;
  const grid = Math.max(1, Math.round(b.w / cell));
  const gz = Math.max(1, Math.round(b.d / cell));
  for (let ix = 0; ix < grid; ix++) {
    for (let iz = 0; iz < gz; iz++) {
      const cx = b.x0 + ((ix + 0.5) * b.w) / grid;
      const cz = b.z0 + ((iz + 0.5) * b.d) / gz;
      if (!inside(inner, cx, cz)) continue;
      const deep = (ix + iz) % 3 === 0;
      const h = deep ? rimH : rimH * 0.78;
      k.prism(rect(cx, cz, w, w), 0.02, h, G, { holes: [rect(cx, cz, w - 0.42, w - 0.42)] });
      // rim cap and a slightly tapered inner face read as dressed granite
      k.prism(rect(cx, cz, w + 0.08, w + 0.08), h, 0.1, L, { mat: MAT.ashlar, holes: [rect(cx, cz, w - 0.34, w - 0.34)] });
      k.prism(rect(cx, cz, w - 0.42, w - 0.42), 0.04, 0.14, D);
      k.prism(rect(cx, cz, w - 0.66, w - 0.66), Math.max(0.16, h - 0.3), 0.07, 'water', { emit: deep ? 0.34 : 0.24 });
    }
  }
}

// A low stone channel with worked granite banks and three small weirs,
// following the real course of the Ribeira de Couros.
function stream(k, line, y) {
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    k.segment([a[0], y + 0.02, a[1]], [b[0], y + 0.02, b[1]], 3.4, 0.08, 'water', { emit: 0.26, mat: MAT.water, ext: 0.4 });
    for (const s of [-1, 1]) {
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz) || 1;
      const nx = (dz / len) * s;
      const nz = (-dx / len) * s;
      k.wallLine([a[0] + nx * 1.9, a[1] + nz * 1.9], [b[0] + nx * 1.9, b[1] + nz * 1.9], 0.55, 0.5, GR, y, { ext: 0.4, mat: MAT.ashlar });
    }
  }
  for (const t of [0.22, 0.52, 0.8]) {
    const i = Math.min(line.length - 2, Math.floor(t * (line.length - 1)));
    const a = line[i];
    const b = line[i + 1];
    const px = a[0] + (b[0] - a[0]) * 0.5;
    const pz = a[1] + (b[1] - a[1]) * 0.5;
    k.box(3.6, 0.5, 0.8, L, px, y, pz, { mat: MAT.ashlar });
    k.box(3.2, 0.16, 0.5, 'water', px, y - 0.16, pz + 0.7, { emit: 0.5 });
  }
}

function couros(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const rimH = H.tank_rims ?? 1.2;
  const ol = footprint.outline; // convex hull of the tank zone

  k.begin('main');
  // --- cobbled ground on the hull and the streambed of the Ribeira de Couros
  k.prism(offset(ol, -0.2), -0.4, 0.35, GR, { mat: MAT.ashlar });
  k.prism(offset(ol, 1.5), -0.4, 0.16, D, { mat: MAT.smooth, holes: [ol] });
  stream(k, [[2, -70], [11, -54], [5, -34], [9, -10], [2, 12], [7, 36], [3, 70]], 0.32);

  // --- the seven OSM tank groups as grids of open granite vats
  for (const p of footprint.partsOf('ruins')) vats(k, p.pts, rimH);

  // --- the lavoir: a rectangular basin with its washing ledge, posts and water
  const lav = footprint.part(/Lavadouro/);
  if (lav) {
    const lb = bbox(lav.pts);
    k.prism(offset(clean(lav.pts, 0.4), 0.35), 0, 0.45, GR, { mat: MAT.ashlar });
    k.prism(offset(clean(lav.pts, 0.4), 0.3), 0.42, 0.1, L, { mat: MAT.ashlar });
    k.prism(offset(clean(lav.pts, 0.4), 0.25), 0, H.lavoir ?? 1.0, L, { holes: [offset(clean(lav.pts, 0.4), -0.3)] });
    k.prism(lav.pts, 0.1, 0.2, D);
    k.prism(offset(clean(lav.pts, 0.4), -0.5), 0.7, 0.07, 'water', { emit: 0.3 });
    // sloped granite washing ledges along the two long sides
    for (const sx of [-1, 1]) {
      k.box(0.7, 0.4, 1.3, D, lb.cx + sx * (lb.w / 2 - 0.3), 0.42, lb.cz, { rx: 0.3 });
      for (let i = -1; i <= 1; i++) k.box(0.24, 0.68, 0.24, L, lb.cx + sx * (lb.w / 2 - 0.05), 0.3, lb.cz + i * (lb.d / 3.2), { mat: MAT.ashlar });
    }
  }

  // --- low granite retaining walls with coping along the lanes between tanks
  const walls = [
    [[-41, -12], [-14, -16]],
    [[16, -18], [40, -6]],
    [[-40, 24], [-10, 30]],
    [[12, 38], [40, 52]],
    [[-30, 44], [-6, 52]],
  ];
  for (const [a, b] of walls) {
    k.wallLine(a, b, 0.85, 0.5, D, 0, { ext: 0.2, mat: MAT.ashlar });
    k.wallLine(a, b, 0.12, 0.62, L, 0.85, { ext: 0.2, mat: MAT.ashlar });
  }
  // two roofless tannery yard walls (houses stay in buildings.json)
  for (const pts of [[[-38, -58], [-18, -58], [-18, -44]], [[26, 46], [40, 46], [40, 62]]]) {
    for (let i = 0; i < pts.length; i++) {
      k.wallLine(pts[i], pts[(i + 1) % pts.length], 1.1, 0.45, G, 0, { ext: 0.2, mat: MAT.ashlar });
      k.wallLine(pts[i], pts[(i + 1) % pts.length], 0.1, 0.56, L, 1.1, { ext: 0.2 });
    }
    // a granite gate pier at the corner
    k.box(0.7, 1.3, 0.7, L, pts[0][0], 0, pts[0][1], { mat: MAT.ashlar });
  }
  // a small stone footbridge over the stream by the lavoir
  k.box(1.2, 0.3, 5.0, L, -6, 0.5, -22, { rz: 0.04, mat: MAT.ashlar });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.3, 1.05, 0.3, G, -6 + sx * 0.4, 0, -22 + sz * 2.2, { mat: MAT.ashlar });
  k.end('main');
}

couros.metric = true;
couros.rule = {
  view: 0.4,
  note: 'the seven OSM tank groups as grids of open granite vats; the lavoir, the stone stream channel with weirs and lane walls; houses between the tanks stay in buildings.json (height total 1.2 m)',
};

export default { couros };
