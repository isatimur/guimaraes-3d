// Plataforma das Artes e da Criatividade / CIAJG, metric builder (1:1 m).
//
// Frame (fit.js): +z = 335.6 deg, the long north-west side on the raised
// square (dimensions.json). The OSM outline (w454870532, 118.3 x 25.3 m) is
// the CIAJG museum bar on the south-east side of the square
// (w171548441, layer 1); the two workshop bars are parts (w454870535
// Laboratórios Criativos, w664204282 Oficinas Emergentes).
// From data/dimensions.json: museum bar 16 m, workshop bars 12 m, 4 floor
// levels, project 2010 (Pitágoras). From the photos: the 2012 museum is a
// black metal-mesh lattice cube over the old market, standing on a raised
// granite platform; the workshop bars are simpler dark volumes.
import { MAT } from '../kit.js';
import { ribbonWindows } from '../parts.js';
import { bbox, offset, edges } from '../geom.js';
import { lowTree } from '../drape.js';

const G = 'graniteGrey';
const GD = 'graniteDark';
const MESH = 'iron';
const DARK = 'dark';

// Woven metal-mesh face on an edge of the box: a square grid of vertical and
// horizontal flat members deep enough to read as the CIAJG's black lattice,
// with a recessed second layer so the screen has depth. y0..y1 is the band,
// `spacing` the pitch in metres.
function lattice(k, e, y0, y1, spacing = 1.8, deep = true) {
  const H = y1 - y0;
  k.push({ x: e.mx + e.nx * 0.05, z: e.mz + e.nz * 0.05, ry: e.ry });
  const nv = Math.max(2, Math.round(e.len / spacing));
  const nh = Math.max(1, Math.round(H / spacing));
  const sw = Math.min(0.16, spacing * 0.14);
  for (let i = 0; i <= nv; i++) k.box(sw, H, 0.2, MESH, -e.len / 2 + (i * e.len) / nv, y0, 0, { mat: MAT.metal });
  for (let j = 0; j <= nh; j++) k.box(e.len, sw, 0.2, MESH, 0, y0 + (H * j) / nh, 0, { mat: MAT.metal });
  if (deep) {
    k.push({ z: -0.55 });
    for (let i = 0; i <= nv; i++) k.box(sw * 0.8, H, 0.14, MESH, -e.len / 2 + (i * e.len) / nv + spacing / 2, y0, 0, { mat: MAT.metal });
    for (let j = 0; j <= nh; j++) k.box(e.len, sw * 0.8, 0.14, MESH, 0, y0 + (H * j) / nh + spacing / 2, 0, { mat: MAT.metal });
    k.pop();
  }
  // perimeter frame: heavier top, bottom and end mullions
  k.box(e.len, sw * 1.6, 0.3, MESH, 0, y1 - sw, 0.06, { mat: MAT.metal });
  k.box(e.len, sw * 1.4, 0.3, MESH, 0, y0 + sw * 0.2, 0.06, { mat: MAT.metal });
  for (const sx of [-1, 1]) k.box(sw * 1.6, H, 0.3, MESH, sx * (e.len / 2 - sw), y0, 0.06, { mat: MAT.metal });
  k.pop();
}

// A simple workshop bar on its OSM part.
function bar(k, pts, h) {
  k.prism(pts, -1.5, h + 1.5, DARK);
  k.prism(offset(pts, 0.12), -1.5, 1.2, G);
  k.prism(offset(pts, 0.25), h, 0.4, G);
  k.prism(offset(pts, 0.3), h - 1.4, 0.5, 'graniteLight', { mat: MAT.ashlar });
  ribbonWindows(k, pts, 2.2, { storeys: 1, h: 2.4, margin: 3, out: 0.06, trim: G, pane: 'glass', emit: 0.1, minLen: 8 });
  // a dark entrance canopy and glazed door on the longest face
  const b = bbox(pts);
  const fe = edges(pts).reduce((a, e) => (e.len > (a?.len ?? 0) ? e : a), null);
  if (fe) {
    k.push({ x: fe.mx + fe.nx * 0.1, z: fe.mz + fe.nz * 0.1, ry: fe.ry });
    k.box(4.2, 0.3, 1.6, DARK, 0, 3.0, 0.7, { mat: MAT.flat });
    k.box(3.4, 2.8, 0.14, 'glass', 0, 0.1, 0.16, { emit: 0.16, mat: MAT.flat });
    for (const s of [-1, 1]) k.box(0.22, 3.0, 0.22, MESH, s * 1.9, 0, 0.4, { mat: MAT.metal });
    k.box(4.6, 0.35, 1.4, G, 0, -0.1, 0.5, { mat: MAT.ashlar });
    k.pop();
  }
  // roof plant on the larger bars
  if (b.w > 30) k.box(Math.min(6, b.w * 0.2), 1.1, Math.min(4, b.d * 0.3), G, b.cx, h + 0.4, b.cz, { mat: MAT.ashlar });
}

function plataforma(k, { footprint, dims }) {
  const HM = dims?.height_m ?? {};
  const hMuseum = HM.total ?? 16;
  const hBar = HM.workshop_bars ?? 12;
  const O = footprint.outline;
  const square = footprint.part(/Plataforma das Artes/);
  const bars = footprint.partsOf('building').filter((p) => bbox(p.pts).w < 110);
  const sqB = square ? bbox(square.pts) : null;

  k.begin('mask');
  // ------------------------------------------------ the CIAJG museum bar
  // the old market bar at the base (granite, arcaded) and the black mesh
  // volume over it
  k.begin('main');
  // solid dark core of the museum, set back from the lattice shell
  k.prism(offset(O, -0.55), -1.5, hMuseum + 1.5, DARK);
  // the old market base: coursed granite with a battered plinth and a band
  k.prism(O, -1.5, 6.0 + 1.5, GD, { mat: MAT.ashlar });
  k.prism(offset(O, 0.35), -1.5, 2.2, G, { mat: MAT.ashlar });
  k.prism(offset(O, 0.18), 5.4, 0.6, 'graniteLight', { mat: MAT.ashlar });
  // deep round-arched market openings on the long faces, between piers with
  // impost blocks and a moulded arch band
  for (const e of edges(O)) {
    if (e.len < 40) continue;
    k.push({ x: e.mx + e.nx * 0.24, z: e.mz + e.nz * 0.24, ry: e.ry });
    const n = Math.max(3, Math.round(e.len / 12));
    const pitch = e.len / n;
    k.arcade(e.len - 2, 5.4, 0.55, n, pitch * 0.6, 4.2, G, 0, 0, 0, { mat: MAT.ashlar });
    k.box(e.len - 3, 4.2, 0.2, 'dark', 0, 0, -0.4);
    for (let i = 0; i <= n; i++) {
      const u = -e.len / 2 + (i * e.len) / n;
      k.box(0.9, 0.34, 0.9, 'graniteLight', u, 3.55, 0.12, { mat: MAT.ashlar });
      k.box(0.7, 0.55, 0.8, G, u, 0, 0.1, { mat: MAT.ashlar });
    }
    k.box(e.len - 1, 0.5, 0.9, 'graniteLight', 0, 3.4, 0.2, { mat: MAT.ashlar });
    k.pop();
  }
  // black metal-mesh shell over the market (the Pitágoras lattice)
  for (const e of edges(O)) {
    if (e.len < 8) continue;
    lattice(k, e, 6.0, hMuseum, e.len > 40 ? 1.35 : 1.25, e.len > 20);
  }
  // roof: dark deck, a run of skylights and a thin metal parapet
  k.prism(offset(O, 0.15), hMuseum, 0.35, G);
  for (let i = -1; i <= 1; i++) k.box(bBoxW(O) * 0.42, 0.18, 3.0, 'glass', 0, hMuseum + 0.22, i * 6, { emit: 0.18, mat: MAT.flat });
  for (const e of edges(O)) {
    if (e.len < 20) continue;
    k.push({ x: e.mx + e.nx * 0.1, z: e.mz + e.nz * 0.1, ry: e.ry });
    for (let i = 0; i < Math.floor(e.len / 3); i++) k.box(0.08, 0.9, 0.08, 'steel', -e.len / 2 + (i + 0.5) * 3, hMuseum + 0.35, 0, { mat: MAT.metal });
    k.box(e.len, 0.1, 0.1, 'steel', 0, hMuseum + 1.2, 0, { mat: MAT.metal });
    k.pop();
  }
  k.end('main');
  k.end('mask');

  // -------------------------------------------- the raised square platform
  if (square) {
    const ground = footprint.ground;
    k.prism(offset(square.pts, -0.4), -0.5, 3.6, G, { mat: MAT.ashlar });
    k.prism(offset(square.pts, -0.4), 3.1, 0.5, 'graniteLight', { mat: MAT.ashlar });
    // a granite paving border and a darker inset field
    k.prism(offset(square.pts, -1.6), 3.1, 0.06, GD, { mat: MAT.smooth });
    // steps and a ramp down to Avenida Conde de Margaride on the NW side
    const se = edges(square.pts).find((e) => e.len > 40 && e.nz > 0.3);
    if (se) {
      k.push({ x: se.mx + se.nx * 1.0, z: se.mz + se.nz * 1.0, ry: se.ry });
      k.stairs(se.len - 4, 4.5, 3.6, 12, G, 0, -0.5, 0, { below: 0.5 });
      for (const s of [-1, 1]) k.box(0.8, 1.1, 5.2, 'graniteLight', s * (se.len / 2 - 0.3), 3.1, 2.2, { mat: MAT.ashlar });
      k.pop();
    }
    // a few plane trees and benches on the platform, plus lamp posts
    const y = 3.7;
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const x = sqB.x0 + 8 + (sqB.w - 16) * t;
      const z = sqB.z0 + 9;
      lowTree(k, x, y, z, 8, { spread: 0.45, lobes: 1 });
      k.box(1.8, 0.5, 0.5, GD, x + 3, y - 0.1, z, { mat: MAT.flat });
      k.box(0.16, 4.0, 0.16, 'steel', x, y, z + 2.2, { mat: MAT.metal });
      k.sphere(0.3, 0xefdca0, x, y + 4.2, z + 2.2, { seg: 7, rings: 4, emit: 0.6 });
    }
    // a shallow reflecting basin in the middle of the platform
    k.prism([[sqB.cx - 7, sqB.z1 - 12], [sqB.cx + 7, sqB.z1 - 12], [sqB.cx + 7, sqB.z1 - 8], [sqB.cx - 7, sqB.z1 - 8]], 3.1, 0.35, 'graniteLight', { mat: MAT.ashlar, holes: [[[sqB.cx - 6.2, sqB.z1 - 11.3], [sqB.cx + 6.2, sqB.z1 - 11.3], [sqB.cx + 6.2, sqB.z1 - 8.7], [sqB.cx - 6.2, sqB.z1 - 8.7]]] });
    k.prism([[sqB.cx - 6.2, sqB.z1 - 11.3], [sqB.cx + 6.2, sqB.z1 - 11.3], [sqB.cx + 6.2, sqB.z1 - 8.7], [sqB.cx - 6.2, sqB.z1 - 8.7]], 3.28, 0.05, 'water', { emit: 0.3 });
    void ground;
  }

  // -------------------------------------------------- the workshop bars
  for (const b of bars) bar(k, b.pts, hBar);

  // a small outdoor stage edge / low wall on the far side of the square
  k.wallLine([sqB.x0 + 4, sqB.z1 - 2], [sqB.x1 - 4, sqB.z1 - 2], 1.0, 0.6, G, 3.4, { mat: MAT.ashlar });
}

function bBoxW(pts) {
  const b = bbox(pts);
  return b.w - 3;
}

plataforma.metric = true;
plataforma.rule = {
  extent: [/building/, /square/],
  view: 0.5,
  note: 'CIAJG museum bar on its OSM outline (main/mask, 16 m) as a black mesh volume over the granite market base; the raised square on its OSM part with steps; the two workshop bars on their OSM parts; mask = museum bar so it does not overlap neighbours',
};

export default { 'plataforma-artes': plataforma };
