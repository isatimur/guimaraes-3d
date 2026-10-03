// Convento e Igreja de São Francisco, metric builder (1:1 metres).
//
// Frame (fit.js): +z = 328.9 deg, the north-west front on the Largo de São
// Francisco with its cruzeiro (dimensions.json). The OSM relation 2836771
// (125.5 x 59.1 m) is church plus convent, with two inner rings (the
// cloister, 330 m², and a light well, 190 m²). The relation outline is
// handed over as a single outer ring; the two inner rings are drawn from
// their transformed local coordinates below. The church is the north-west
// range (the western lobe of the outline), the convent the wings behind.
// From data/dimensions.json: single bell tower 24 m, Gothic nave ridge
// 16 m, two-storey convent wings 12 m; cloister begun 1591, Gothic apse
// about 1461.
// From the photos (interior): azulejo and gilded chapels inside;   the
// exterior is built here: granite Gothic church with a rose window and
// buttresses, a bell tower, and a two-storey round-arched cloister.
import * as THREE from 'three';
import { corniceProfile, MAT } from '../kit.js';
import { win, bellTower } from '../parts.js';
import { bbox, offset, edges } from '../geom.js';
import { polyCornice } from '../metric.js';

const G = 'granite';
const GL = 'graniteLight';
const GD = 'graniteDark';

// The two inner rings of relation 2836771, transformed to the local frame
// (cloister quad ~20 x 20 m, light well ~15 x 13 m).
const CLOISTER = [[7.24, 2.53], [-10.82, 4.04], [-12.67, -13.74], [5.49, -15.57]];
const LIGHTWELL = [[51.31, 18.64], [36.51, 18.63], [36.64, 5.8], [51.46, 5.95]];

// The Gothic church on the north-central range of the outline.
function church(k, poly, dims) {
  const hRidge = dims?.height_m?.nave_ridge ?? 16;
  const b = bbox(poly);
  const eave = 14.0;
  k.prism(poly, -1.5, eave + 1.5, G, { mat: MAT.ashlar });
  k.prism(offset(poly, 0.2), -1.5, 1.8, GD);
  polyCornice(k, poly, eave - 0.6, corniceProfile('eave', 0.55), GL, { minLen: 3 });
  // gabled nave roof, ridge along the long (z) axis of the church lobe
  k.gableRoof(b.w - 0.5, b.d - 0.5, Math.max(1.8, hRidge - eave), 'terracotta', b.cx, eave, b.cz, { over: 0.5, mat: MAT.tile });
  // buttresses and tall pointed windows between them along the flanks
  for (const e of edges(poly)) {
    if (e.len < 12 || Math.abs(e.nx) < 0.7) continue;
    k.push({ x: e.mx + e.nx * 0.05, z: e.mz + e.nz * 0.05, ry: e.ry });
    const n = Math.max(2, Math.floor(e.len / 7));
    for (let i = 0; i <= n; i++) {
      const u = -e.len / 2 + (i * e.len) / n;
      k.box(1.1, eave, 1.0, GL, u, 0, 0.4);
      k.cone(0.8, 1.1, 4, GL, u, eave, 0.4);
    }
    for (let i = 0; i < n; i++) {
      const u = -e.len / 2 + (i + 0.5) * (e.len / n);
      win(k, u, 4.6, 1.6, 5.4, 0, { arch: 'pointed', bw: 0.34, depth: 0.3, trim: GL, pane: 'glass', emit: 0.08, sill: true });
    }
    k.pop();
  }
  // the north-west front: pointed portal, rose window, gable. Pick the
  // longest outward (+z) edge of realistic facade length (skip the long
  // diagonal that closes the lobe).
  let fe = null;
  for (const e of edges(poly)) {
    if (e.len < 8 || e.len > 46 || e.nz < 0.35) continue;
    if (!fe || e.len > fe.len) fe = e;
  }
  if (fe) {
    const cx = fe.mx;
    const zf = fe.mz + 0.05;
    k.push({ x: cx, z: zf, ry: 0 });
    k.wall(fe.len, eave, 1.3, G, [
      { x: 0, y: 0.2, w: 2.8, h: 5.6, arch: 'pointed', pane: 'dark', inset: 0.9 },
    ], 0, 0, -0.65, { inset: 0.9 });
    k.surround({ x: 0, y: 0.2, w: 2.8, h: 5.6, arch: 'pointed' }, 0.5, 0.4, GL, 0);
    for (let i = 0; i < 4; i++) k.box(0.9, 5.0 - i * 0.9, 0.5, GL, (i < 2 ? -1 : 1) * (2.2 + (i % 2) * 0.7), 0, 0.15);
    // rose window: a granite wheel with glass and tracery
    k.cyl(1.9, 1.9, 0.5, 16, GL, 0, 9.3, 0.3, { rx: Math.PI / 2, smooth: true });
    k.cyl(1.55, 1.55, 0.2, 16, 'glass', 0, 9.3, 0.45, { rx: Math.PI / 2, emit: 0.2 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI;
      k.box(3.0, 0.12, 0.14, GL, 0, 9.3, 0.5, { rz: a });
    }
    // gable with a cross to the ridge
    const gs = new THREE.Shape();
    gs.moveTo(-fe.len / 2, 0);
    gs.lineTo(fe.len / 2, 0);
    gs.lineTo(0, Math.max(1.2, hRidge - eave));
    gs.closePath();
    k.extrude(gs, 1.2, G, 0, eave, -0.6, { curve: 3 });
    k.box(0.5, 1.4, 0.5, GL, 0, hRidge, 0);
    k.box(0.16, 1.7, 0.16, 'iron', 0, hRidge + 1.3, 0);
    k.box(0.6, 0.14, 0.14, 'iron', 0, hRidge + 1.9, 0);
    k.pop();
  }
  // the single bell tower beside the front, within the lobe
  const tx = fe ? Math.min(Math.max(fe.mx + fe.len * 0.3, b.x0 + 3.5), b.x1 - 3.5) : b.x0 + 4;
  const tz = fe ? fe.mz - 3.2 : b.z1 - 4;
  k.begin('height');
  bellTower(k, { x: tx, z: tz, w: 5.0, hBody: 11.4, hBelfry: 3.9, body: G, trim: GL, cap: 'pyramid', capH: 2.3, openings: 1, windows: 1, sideWindows: false, urns: false, cross: true });
  k.end('height');
}

function saoFrancisco(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const wingEave = Math.max(8, (H.convent_wings ?? 12) - 2.0);
  const wingTop = H.convent_wings ?? 12;
  const O = footprint.outline;

  // The church is the north-central range of the relation, immediately
  // north of the cloister, with its front on the north-west line (z = 28).
  // The relation's outer ring does not give it a clean closed edge, so the
  // nave is modelled on this rectangle inside the block (within the OSM
  // outline, the cloister just to its south).
  const churchPoly = [[-22, 10.5], [9, 10.5], [9, 28], [-22, 28]];
  const cb = bbox(churchPoly);

  k.begin('convent');
  // the convent: one rendered mass on the whole outline, cut by the
  // cloister and the light well
  k.prism(O, -1.5, wingEave + 1.5, 'plaster', { holes: [CLOISTER, LIGHTWELL], mat: MAT.render });
  k.prism(offset(O, 0.2), -1.5, 1.7, G, { holes: [CLOISTER, LIGHTWELL] });
  polyCornice(k, O, wingEave - 0.5, corniceProfile('eave', 0.5), GL, { minLen: 4 });
  polyCornice(k, [...CLOISTER].reverse(), wingEave - 0.4, corniceProfile('band', 0.35), GL);
  polyCornice(k, [...LIGHTWELL].reverse(), wingEave - 0.4, corniceProfile('band', 0.35), GL);
  // tiled cap over the ranges, leaving the courtyards open
  k.prism(offset(O, -4), wingEave, wingTop - wingEave, 'terracotta', { holes: [offset(CLOISTER, 3), offset(LIGHTWELL, 3)], mat: MAT.tile });
  // windows on the long outer fronts (two storeys) and oculi
  for (const e of edges(O)) {
    if (e.len < 8) continue;
    k.push({ x: e.mx + e.nx * 0.06, z: e.mz + e.nz * 0.06, ry: e.ry });
    const n = Math.max(2, Math.floor(e.len / 4.6));
    // granite pilaster strips between the bays
    for (let i = 0; i <= n; i++) k.box(0.55, wingEave, 0.3, GL, -e.len / 2 + (i * e.len) / n, 0, 0.08);
    for (let i = 0; i < n; i++) {
      const u = -e.len / 2 + (i + 0.5) * (e.len / n);
      win(k, u, 1.6, 1.2, 2.0, 0, { bw: 0.26, depth: 0.24, trim: GL, pane: 'glass', emit: k.rnd() > 0.7 ? 0.25 : 0.07, bars: true, sill: true });
      win(k, u, 5.4, 1.25, 2.2, 0, { bw: 0.26, depth: 0.22, trim: GL, pane: 'glass', emit: 0.08, head: 'flat', balcony: 'iron' });
      k.add(new THREE.TorusGeometry(0.45, 0.12, 3, 8), GL, { x: u, y: 9.0, z: 0.06, sy: 0.8 });
    }
    k.pop();
  }
  k.end('convent');

  // --------------------------------------------------------- the cloister
  // A two-storey round-arched gallery facing the courtyard on all four sides.
  const ccx = bbox(CLOISTER).cx;
  const ccz = bbox(CLOISTER).cz;
  for (const e of edges(CLOISTER)) {
    if (e.len < 4) continue;
    // face the courtyard centre
    const inward = (ccx - e.mx) * e.nx + (ccz - e.mz) * e.nz < 0 ? Math.PI : 0;
    k.push({ x: e.mx, z: e.mz, ry: e.ry + inward });
    const n = Math.max(3, Math.round(e.len / 4.0));
    k.arcade(e.len, 5.6, 0.6, n, (e.len / n) * 0.72, 4.4, GL, 0, 0, 0.25, { mat: MAT.ashlar, curve: 6 });
    k.box(e.len, 0.5, 3.0, GL, 0, 5.6, -1.2);
    for (let i = 0; i <= n; i++) k.box(0.85, 5.6, 0.85, GL, -e.len / 2 + (i * e.len) / n, 0, 0.3);
    for (let i = 0; i < n; i++) {
      const u = -e.len / 2 + (i + 0.5) * (e.len / n);
      win(k, u, 6.6, 1.3, 2.2, 0.3, { bw: 0.24, depth: 0.2, trim: GL, pane: 'glass', emit: 0.1, head: 'round' });
    }
    k.cornice(e.len + 0.6, corniceProfile('eave', 0.4), GL, 0, 9.6, 0.3);
    k.pop();
  }
  // a parterre in the courtyard (hedge ring and a small well)
  k.prism(CLOISTER, 0, 0.18, 'grass', { mat: MAT.leaf });
  k.prism(offset(CLOISTER, -1.3), 0.18, 0.55, 'hedge', { holes: [offset(CLOISTER, -2.1)] });
  k.cyl(1.0, 1.1, 0.9, 10, GL, ccx, 0.1, ccz);
  k.marker('fountain', ccx, 0.7, ccz, { kind: 'basin', r: 1.0 });

  // the light well: a plain open court with a low kerb
  k.prism(LIGHTWELL, 0, 0.15, 'sand', { mat: MAT.smooth });

  // ------------------------------------------------------------- the church
  k.begin('mask');
  church(k, churchPoly, dims);
  k.end('mask');
  void cb;
}

saoFrancisco.metric = true;
saoFrancisco.rule = {
  view: 0.55,
  note: 'relation outline built as the convent mass to 12 m with the cloister and light well cut out; the western lobe as the Gothic granite church (rose window, buttresses, 24 m bell tower); the cloister lined with a two-storey round-arched gallery; mask = whole outline',
};

export default { 'sao-francisco': saoFrancisco };
