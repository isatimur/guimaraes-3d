// Museu de Alberto Sampaio (the Romanesque cloister and chapter-house of
// the Colegiada) metric builder.
// data/dimensions.json: OSM way 255483376 (1361 m²), 63.3 x 49.1 m, two
// storeys, about 10 m to the ridge; the cloister garth is not mapped as a
// hole. Frame (fit.js): +z is the east front (bearing 78) on Rua Alfredo
// Guimarães, where the museum door is; the church closes the south side.
//
// Plan: the ranges follow the real OSM outline; a Romanesque cloister garth
// is cut into the large west block (a rectangle inside the outline) with a
// round-arched gallery on columns all round it and an upper gallery over
// the arcade. The east front carries the museum's white render, granite
// base, quoins and two rows of framed windows (assets/img/alberto-sampaio*).
// Tiled ranges, a small tower, and the garth parterre with a statue.
// The Oliveira church and the Largo are NOT drawn: the model stays on the
// museum outline so the mask does not overlap its neighbours.
import * as THREE from 'three';
import { corniceProfile, MAT } from '../kit.js';
import { win, punchedWindows } from '../parts.js';
import { bbox, offset, edges } from '../geom.js';
import { polyCornice, polyWindows, onEdge } from '../metric.js';

const G = 'granite';
const T = 'graniteWarm';
const L = 'graniteLight';
const D = 'graniteDark';
let GARTH_C = [-20.5, -5];

// Lean-to tiled roof strip along one edge of the garth, low at the garth
// (yIn) and high at the range (yOut), `depth` deep, facing the garth.
function leanTo(k, a, b, yIn, yOut, depth, color = 'terracotta') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  const cx = (a[0] + b[0]) / 2;
  const cz = (a[1] + b[1]) / 2;
  // the high (range) side must fall away from the garth: pick the sign
  const outx = -Math.sin(ry);
  const outz = -Math.cos(ry);
  const dirx = a[0] - GARTH_C[0];
  const dirz = a[1] - GARTH_C[1];
  const s = outx * dirx + outz * dirz >= 0 ? 1 : -1;
  const d = depth * s;
  const tri = [
    [-len / 2, yIn, 0], [len / 2, yIn, 0], [len / 2, yOut, -d],
    [-len / 2, yIn, 0], [len / 2, yOut, -d], [-len / 2, yOut, -d],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri.flat()), 3));
  k.push({ x: cx, z: cz, ry });
  k.add(g, color, { flat: true, mat: MAT.tile });
  k.pop();
}

function alberto(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const total = H.total ?? 10;
  const b = bbox(footprint.outline); // x -31.5..31.5, z -24.57..24.57
  const eave = total - 2.5; // 7.5, ridge at the real 10 m

  // cloister garth cut into the west block
  const gx0 = -28.0;
  const gx1 = -13.0;
  const gz0 = -14.0;
  const gz1 = 4.0;
  const garth = [[gx0, gz0], [gx1, gz0], [gx1, gz1], [gx0, gz1]];
  const gcx = (gx0 + gx1) / 2;
  const gcz = (gz0 + gz1) / 2;
  GARTH_C = [gcx, gcz];

  k.begin('main');
  // ranges on the real outline, with the garth open
  k.prism(footprint.outline, -0.9, eave + 0.9, 'plaster', { holes: [garth], mat: MAT.render });
  k.prism(offset(footprint.outline, 0.16), -0.9, 1.5, G, { holes: [offset(garth, -0.16)] });
  k.prism(offset(footprint.outline, 0.05), eave - 0.35, 0.35, L, { holes: [offset(garth, -0.05)] });
  polyCornice(k, footprint.outline, eave - 0.5, corniceProfile('eave', 0.45), L);
  polyCornice(k, [...garth].reverse(), eave - 0.5, corniceProfile('band', 0.35), L);

  // ---- roofs: hip ranges over the main blocks, lean-to around the garth
  k.hipRoof(41.5, 21.0, 2.5, 'terracotta', 10.6, eave, 14.0, { over: 0.5, mat: MAT.tile });
  k.hipRoof(21.5, 10.6, 2.5, 'terracotta', -20.7, eave, -19.3, { over: 0.5, mat: MAT.tile });
  k.hipRoof(21.5, 6.2, 2.5, 'terracotta', -20.7, eave, 7.0, { over: 0.5, mat: MAT.tile });
  k.hipRoof(3.6, 18.0, 2.5, 'terracotta', -29.6, eave, gcz, { over: 0.4, mat: MAT.tile });
  k.hipRoof(3.2, 18.0, 2.5, 'terracotta', -11.5, eave, gcz, { over: 0.4, mat: MAT.tile });
  for (const [a, bb] of [
    [[gx0, gz0], [gx1, gz0]], [[gx1, gz0], [gx1, gz1]],
    [[gx1, gz1], [gx0, gz1]], [[gx0, gz1], [gx0, gz0]],
  ]) leanTo(k, a, bb, eave - 2.6, eave - 0.2, 2.2);

  // ---- cloister garth: gravel, cross parterre, statue
  k.box(gx1 - gx0 + 0.2, 0.16, gz1 - gz0 + 0.2, 'sand', gcx, 0, gcz, { mat: MAT.smooth });
  k.box(gx1 - gx0 - 2.4, 0.45, 2.4, 'hedge', gcx, 0.1, gcz, { mat: MAT.leaf });
  k.box(2.4, 0.45, gz1 - gz0 - 2.4, 'hedge', gcx, 0.1, gcz, { mat: MAT.leaf });
  k.box(4.0, 0.5, 4.0, 'grass', gcx, 0.12, gcz, { mat: MAT.leaf });
  k.box(1.0, 1.1, 1.0, G, gcx, 0.2, gcz);
  k.statue(1.6, L, gcx, 1.3, gcz, { pose: 'hold' });

  // ---- round-arched Romanesque gallery on columns round the garth
  const sides = [
    { a: [gx0, gz0], bb: [gx1, gz0], ry: 0 }, // north edge, faces +z
    { a: [gx1, gz1], bb: [gx0, gz1], ry: Math.PI },
    { a: [gx1, gz0], bb: [gx1, gz1], ry: Math.PI / 2 }, // east edge, faces -x
    { a: [gx0, gz1], bb: [gx0, gz0], ry: -Math.PI / 2 },
  ];
  for (const s of sides) {
    const len = Math.hypot(s.bb[0] - s.a[0], s.bb[1] - s.a[1]);
    const cx = (s.a[0] + s.bb[0]) / 2;
    const cz = (s.a[1] + s.bb[1]) / 2;
    const n = Math.max(2, Math.round(len / 2.6));
    k.push({ x: cx, z: cz, ry: s.ry });
    k.arcade(len, 3.9, 0.5, n, (len / n) * 0.66, 2.9, L, 0, 0, 0, { mat: MAT.ashlar });
    // piers between the arches
    for (let i = 0; i <= n; i++) k.box(0.55, 3.9, 0.7, D, -len / 2 + (i * len) / n, 0, 0.05);
    // upper gallery: a framed window over each bay
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + ((i + 0.5) * len) / n;
      k.box(1.9, 2.5, 0.14, G, u, 4.6, -0.02);
      k.box(1.3, 2.0, 0.08, 'glass', u, 4.9, 0.06, { emit: 0.12 });
    }
    k.pop();
  }

  // ---- outer facades
  // east front (+z): white render, granite base, quoins, two rows of windows
  const F = edges(footprint.outline).filter((e) => e.nz > 0.7);
  for (const e of F) {
    onEdge(k, e, 0, 0.02);
    k.box(e.len, 1.2, 0.3, D, 0, 0, 0.15);
    const n = Math.max(2, Math.floor((e.len - 2) / 3.7));
    const pitch = (e.len - 2) / n;
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * pitch) / 2 + i * pitch;
      win(k, u, 1.25, 1.25, 2.05, 0.25, { bw: 0.28, depth: 0.24, trim: G, pane: 'glass', emit: 0.12, head: 'flat' });
      win(k, u, 4.55, 1.35, 2.2, 0.25, { bw: 0.3, depth: 0.24, trim: G, pane: 'glass', emit: 0.2, head: 'flat', balcony: i % 2 === 0 ? 'iron' : false });
    }
    k.pop();
  }
  // corner quoins on the front
  for (const e of F) {
    for (const x of [e.a[0], e.b[0]]) for (let c = 0; c < 9; c++) k.box(c % 2 ? 1.0 : 0.55, 0.72, 0.5, G, x, 0.5 + c * 0.78, e.mz + 0.25, { jit: 0.05 });
  }
  // simpler windows on the other outer walls
  polyWindows(k, footprint.outline, {
    only: (e) => e.nz <= 0.7,
    storeys: [1.6, 4.7],
    bay: 4.2,
    w: 1.2,
    h: 1.9,
    minLen: 5,
    win: { trim: G, pane: 'glass', emit: 0.1 },
  });
  // a small tower at the north-west corner, capped at the real height
  const tw = 3.4;
  k.box(tw, total - 1.4, tw, 'plaster', -29.4, 0, -22.0, { mat: MAT.render });
  k.box(tw + 0.5, 0.4, tw + 0.5, L, -29.4, total - 1.4, -22.0);
  k.cone(tw * 0.78, 1.4, 4, 'terracotta', -29.4, total - 1.0, -22.0);
  k.box(0.4, total - 1.6, 0.4, G, -29.4, 0, -22.0);
  k.end('main');

  // height group: the ridge reaches exactly the real 10 m
  k.begin('height');
  k.box(0.3, 0.3, 0.3, 'dark', 10.6, total - 0.3, 14.0);
  k.end('height');
  void punchedWindows;
}

alberto.metric = true;
alberto.rule = {
  view: 0.35,
  note: 'ranges on the OSM outline, two storeys to the 10 m ridge; a Romanesque cloister garth is synthesized inside the west block (OSM does not map it) with an arcade on columns; the east front (bearing 78) is the museum facade. Oliveira church and Largo not drawn.',
};

export default { 'alberto-sampaio': alberto };
