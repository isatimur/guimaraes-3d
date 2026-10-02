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

// A woven metal-mesh face on an edge of the box: vertical and horizontal
// members. y0..y1 is the band, `spacing` the pitch in metres.
function lattice(k, e, y0, y1, spacing = 2.2) {
  k.push({ x: e.mx + e.nx * 0.04, z: e.mz + e.nz * 0.04, ry: e.ry });
  const nv = Math.max(2, Math.round(e.len / spacing));
  for (let i = 0; i <= nv; i++) k.box(0.1, y1 - y0, 0.12, MESH, -e.len / 2 + (i * e.len) / nv, y0, 0, { mat: MAT.metal });
  const nh = Math.max(1, Math.round((y1 - y0) / spacing));
  for (let j = 0; j <= nh; j++) k.box(e.len, 0.1, 0.12, MESH, 0, y0 + ((y1 - y0) * j) / nh, 0, { mat: MAT.metal });
  k.pop();
}

// A simple workshop bar on its OSM part.
function bar(k, pts, h) {
  k.prism(pts, -1.5, h + 1.5, DARK);
  k.prism(offset(pts, 0.12), -1.5, 1.2, G);
  k.prism(offset(pts, 0.25), h, 0.4, G);
  ribbonWindows(k, pts, 2.2, { storeys: 1, h: 2.4, margin: 3, out: 0.06, trim: G, pane: 'glass', emit: 0.1, minLen: 8 });
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
  k.prism(O, -1.5, 7.0 + 1.5, GD, { mat: MAT.ashlar });
  k.prism(offset(O, 0.2), -1.5, 1.6, G);
  // the old market under the mesh: round-arched openings on the long faces
  for (const e of edges(O)) {
    if (e.len < 40) continue;
    k.push({ x: e.mx + e.nx * 0.24, z: e.mz + e.nz * 0.24, ry: e.ry });
    const n = Math.max(3, Math.round(e.len / 12));
    k.arcade(e.len - 2, 5.2, 0.5, n, (e.len / n) * 0.6, 3.9, G, 0, 0, 0, { mat: MAT.ashlar });
    k.box(e.len - 3, 3.9, 0.15, 'dark', 0, 0, -0.35);
    k.pop();
  }
  k.prism(O, 5.5, hMuseum - 5.5, DARK);
  // mesh lattice on the two long faces and the ends
  for (const e of edges(O)) {
    if (e.len < 8) continue;
    lattice(k, e, 6.0, hMuseum, e.len > 40 ? 1.5 : 1.35);
  }
  // a second inner mesh skin a little way in (reads as a deep lattice)
  for (const e of edges(O)) {
    if (e.len < 30) continue;
    k.push({ x: e.mx - e.nx * 0.5, z: e.mz - e.nz * 0.5, ry: e.ry });
    const nv = Math.round(e.len / 3.0);
    for (let i = 0; i <= nv; i++) k.box(0.08, hMuseum - 6, 0.1, MESH, -e.len / 2 + (i * e.len) / nv, 6, 0, { mat: MAT.metal });
    k.pop();
  }
  // top: a dark roof with a skylight grid and a white parapet line
  k.prism(offset(O, 0.15), hMuseum, 0.35, G);
  k.box(bBoxW(O), 0.15, 6, 'glass', 0, hMuseum + 0.2, 0, { emit: 0.15, mat: MAT.flat });
  k.end('main');
  k.end('mask');

  // -------------------------------------------- the raised square platform
  if (square) {
    const ground = footprint.ground;
    k.prism(offset(square.pts, -0.4), -0.5, 3.6, G, { mat: MAT.ashlar });
    k.prism(offset(square.pts, -0.4), 3.1, 0.5, 'graniteLight', { mat: MAT.ashlar });
    // steps down to Avenida Conde de Margaride on the long north-west side
    const se = edges(square.pts).find((e) => e.len > 40 && e.nz > 0.3);
    if (se) {
      k.push({ x: se.mx + se.nx * 1.0, z: se.mz + se.nz * 1.0, ry: se.ry });
      k.stairs(se.len - 4, 4.5, 3.6, 12, G, 0, -0.5, 0, { below: 0.5 });
      k.pop();
    }
    // a few plane trees and benches on the platform
    const y = 3.7;
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const x = sqB.x0 + 8 + (sqB.w - 16) * t;
      const z = sqB.z0 + 9;
      lowTree(k, x, y, z, 8, { spread: 0.45, lobes: 1 });
      k.box(1.8, 0.5, 0.5, GD, x + 3, y - 0.1, z, { mat: MAT.flat });
    }
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
