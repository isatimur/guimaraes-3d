// Castelo de Guimarães (10th c., rebuilt under Count Henry, gothic walls
// under D. Dinis), metric builder. data/dimensions.json: the OSM way
// 346365692 is the crenellated curtain-wall ring (207 m perimeter, a
// faceted shield plan); curtain wall 12 m, seven mapped quadrangular wall
// towers 14 m, the keep (w346365691) 12.3 x 11.8 m and 27 m. The gate faces
// south-west down the Colina Sagrada towards São Miguel and the Paço.
//
// The keep is drawn on the largest mapped tower footprint (its OSM way
// includes the forebuilding), the other tower footprints as they are
// mapped; the curtain wall follows the real outline edge by edge. The
// wall-walk (ad arce) runs inside the parapet from edge to edge, the keep
// door opens high on its wall reached from that walk, and a granite
// earthwork ledge and a stepped approach carry the gate down the hill.
import { win } from '../parts.js';
import { bbox, edges, offset } from '../geom.js';

const G = 'granite';
const T = 'graniteWarm';
const L = 'graniteLight';
const D = 'graniteDark';

// Crenellated parapet along a closed polygon: a coping course with slim
// merlons every `step` metres, each capped. Pointed tops when o.pointed.
function merlons(k, pts, y, h, t, color, step = 2.0, o = {}) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.7) continue;
    const n = Math.max(1, Math.round(len / step));
    const ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    k.box(len, 0.22, t + 0.1, L, (a[0] + b[0]) / 2, y - 0.22, (a[1] + b[1]) / 2, { ry, jit: 0.03 });
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) / n;
      const x = a[0] + (b[0] - a[0]) * u;
      const z = a[1] + (b[1] - a[1]) * u;
      k.box((len / n) * 0.58, h, t * 0.92, color, x, y, z, { ry, jit: 0.05 });
      k.box((len / n) * 0.7, 0.16, t, L, x, y + h, z, { ry, jit: 0.03 });
      if (o.pointed) k.cone((len / n) * 0.34, h * 0.5, 4, color, x, y + h + 0.16, z, { ry: Math.PI / 4 });
    }
  }
}

// Row of small half-buried ashlar stones along a wall face for weathering.
function stoneCourses(k, pts, y0, y1, t, step = 1.7, o = {}) {
  const rows = Math.max(1, Math.round((y1 - y0) / (o.rowH ?? 2.6)));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1.6) continue;
    const n = Math.max(1, Math.floor(len / step));
    const ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    const nx = Math.sin(ry);
    const nz = Math.cos(ry);
    for (let r = 0; r < rows; r++) {
      const y = y0 + ((r + 0.5) * (y1 - y0)) / rows;
      for (let j = 0; j < n; j++) {
        let f = (j + 0.5) / n + (r % 2 ? step * 0.5 / len : 0);
        if (f > 1 - 0.1 / len) continue;
        const c = k.rnd() > 0.55 ? L : k.rnd() > 0.4 ? T : G;
        k.box(0.7 + k.rnd() * 0.5, 0.34 + k.rnd() * 0.2, 0.22, c, a[0] + (b[0] - a[0]) * f + nx * (t * 0.5 + 0.05), y, a[1] + (b[1] - a[1]) * f + nz * (t * 0.5 + 0.05), { ry, jit: 0.06 });
      }
    }
  }
}

// A narrow vertical arrow loop recessed into a wall face at local z.
function loop(k, x, y, z, w, h, o = {}) {
  win(k, x, y, w, h, z, { arch: o.arch ?? 'round', bw: w * 0.5, depth: 0.2, pane: 'dark', trim: T });
}

function castelo(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const wallH = H.curtain_wall ?? 12;
  const towerH = H.wall_towers ?? 14;
  const keepH = H.keep ?? 27;
  const ol = footprint.outline;
  const t = 2.4; // curtain-wall thickness
  const target = footprint.frontDeg ?? 234;
  const deckY = wallH - 1.1;
  const keepBody = keepH - 1.7;

  // the gate: the longest outline edge whose outward normal faces the front
  const E = edges(ol);
  let gate = null;
  let gateD = 1e9;
  for (const e of E) {
    if (e.len < 2) continue;
    const b = ((Math.atan2(e.nx, -e.nz) * 180) / Math.PI % 360 + 360) % 360;
    const d = Math.abs(((b - target + 540) % 360) - 180);
    if (d < gateD) {
      gateD = d;
      gate = e;
    }
  }

  k.begin('main');
  // footing course on the bedrock and a granite earthwork ledge edge by edge
  k.prism(ol, -0.9, 1.1, D);
  for (const e of E) {
    if (e.len < 0.8) continue;
    k.box(e.len + 0.8, 1.2, 1.0, 'earth', e.mx + e.nx * (t * 0.5 + 0.5), -1.0, e.mz + e.nz * (t * 0.5 + 0.5), { ry: e.ry, jit: 0.06, mat: 8 });
    k.box(e.len + 0.8, 0.5, 0.7, D, e.mx + e.nx * (t * 0.5 + 0.35), 0.1, e.mz + e.nz * (t * 0.5 + 0.35), { ry: e.ry, jit: 0.05, mat: 1 });
  }

  // curtain wall: one slab per real outline edge (the gate edge is opened
  // below), then bands, parapet and the inside wall-walk
  for (let i = 0; i < ol.length; i++) {
    const e = E[i];
    if (e === gate) continue;
    const c = i % 3 === 1 ? T : i % 5 === 3 ? D : G;
    k.wallLine(e.a, e.b, wallH, t, c, 0.2, { ext: 0.45, jit: 0.035 });
  }
  // string courses every ~3.8 m of height
  for (const y of [3.6, 7.4]) {
    for (const e of E) {
      if (e.len < 1) continue;
      k.wallLine(e.a, e.b, 0.22, t + 0.28, L, y, { ext: 0.2, jit: 0.03 });
    }
  }
  // projecting coping under the parapet
  for (const e of E) if (e.len >= 1) k.wallLine(e.a, e.b, 0.24, t + 0.34, L, wallH - 0.24, { ext: 0.2 });
  merlons(k, ol, wallH, 1.3, t, G, 1.9);
  stoneCourses(k, ol, 1.0, wallH - 1.2, t, 1.75);

  // --- the ad arce: a stone walkway on the inside of the curtain wall,
  // with a low inner parapet and a pair of stairs up from the ward
  for (const e of E) {
    if (e.len < 1) continue;
    const w = t + 1.4;
    const mx = e.mx - e.nx * (t * 0.5 + 0.7);
    const mz = e.mz - e.nz * (t * 0.5 + 0.7);
    k.box(e.len + 0.4, 0.34, 1.4, L, mx, deckY, mz, { ry: e.ry });
    const a = [e.a[0] - e.nx * w, e.a[1] - e.nz * w];
    const b = [e.b[0] - e.nx * w, e.b[1] - e.nz * w];
    k.wallLine(a, b, 0.8, 0.42, D, deckY, { ext: 0.1 });
  }
  // stairs from the ward to the wall-walk beside the gate
  if (gate) {
    k.push({ x: gate.mx - gate.nx * (t * 0.5 + 1.6), z: gate.mz - gate.nz * (t * 0.5 + 1.6), ry: gate.ry });
    k.stairs(1.6, 3.0, deckY - 0.35, 12, G, 0, 0, 1.5, { below: 0 });
    k.pop();
  }

  // --- the mapped wall towers (quadrangular, crenellated); the largest is
  // the keep
  const towers = footprint.partsOf(/^tower$/);
  let keep = null;
  let keepA = 0;
  for (const p of towers) {
    if (!p.pts || p.pts.length < 3) continue;
    const b = bbox(p.pts);
    const a = b.w * b.d;
    if (a > keepA) {
      keepA = a;
      keep = p;
    }
  }
  for (const p of towers) {
    if (p === keep) continue;
    k.prism(offset(p.pts, -0.15), -0.5, towerH + 0.5, G);
    k.prism(offset(p.pts, 0.5), -0.5, 1.7, D); // battered base
    k.prism(offset(p.pts, 0.18), towerH - 0.5, 0.3, L); // crown string course
    merlons(k, p.pts, towerH, 1.2, t * 0.72, G, 1.6);
    const pe = edges(p.pts);
    for (const e of pe) {
      if (e.len < 1.6) continue;
      k.push({ x: e.mx + e.nx * 0.05, z: e.mz + e.nz * 0.05, ry: e.ry });
      loop(k, 0, towerH * 0.52, 0, 0.26, 1.0);
      loop(k, 0, towerH * 0.74, 0, 0.24, 0.9);
      k.pop();
    }
  }

  // --- the keep: 12.3 x 11.8 m on the largest mapped tower footprint
  if (keep) {
    const b = bbox(keep.pts);
    const cw = Math.min(12.3, b.w);
    const cd = Math.min(11.8, b.d);
    // battered base and main body
    k.prism(bboxRect(b, cw + 1.0, cd + 1.0), -0.6, 1.8, D);
    k.box(cw, keepBody, cd, G, b.cx, 0, b.cz, { jit: 0.02 });
    // corner quoins, alternating long/short youton stones
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      for (let c = 0; c * 0.95 < keepBody - 1.4; c++) {
        const y = 0.5 + c * 0.95;
        const long = c % 2 ? 1.05 : 0.6;
        const short = c % 2 ? 0.6 : 1.05;
        k.box(long, 0.86, short, L, b.cx + sx * (cw / 2 - long / 2 + 0.02), y, b.cz + sz * (cd / 2 - short / 2 + 0.02), { jit: 0.05 });
      }
    }
    // internal floor levels hinted: string courses + putlog holes
    for (const fy of [7.5, 13.5, 19.5]) {
      k.box(cw + 0.24, 0.2, cd + 0.24, L, b.cx, fy, b.cz, { jit: 0.02 });
      for (const [sx, sz, ry] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
        k.push({ x: b.cx + sx * (cw / 2 + 0.13), z: b.cz + sz * (cd / 2 + 0.13), ry });
        for (let i = -2; i <= 2; i++) k.box(0.34, 0.34, 0.22, D, i * 1.7, fy + 0.9, 0, { jit: 0.1 });
        k.pop();
      }
    }
    // the high round-arched door, reached from the ad arce; corbelled
    // forebuilding and a timber gallery below it
    k.push({ x: b.cx, z: b.cz });
    win(k, 0, deckY + 0.5, 1.2, 2.3, cd / 2, { arch: 'round', bw: 0.3, depth: 0.36, pane: 'dark', trim: T });
    k.box(2.3, 0.26, 0.7, T, 0, deckY + 0.4, cd / 2 + 0.28);
    for (let i = -2; i <= 2; i++) k.box(0.22, 0.5, 0.5, D, i * 0.55, deckY - 0.9, cd / 2 + 0.2, { jit: 0.05 });
    k.box(2.6, 0.18, 0.9, 'wood', 0, deckY - 1.35, cd / 2 + 0.45);
    // a mullioned window and loops on the upper face
    win(k, 0, keepBody - 4.0, 0.7, 1.4, cd / 2, { arch: 'round', bw: 0.16, depth: 0.22, pane: 'glass', emit: 0.2, trim: T });
    loop(k, -0.6, keepBody - 8.5, cd / 2, 0.24, 1.0);
    loop(k, 0.6, keepBody - 8.5, cd / 2, 0.24, 1.0);
    loop(k, 0, keepBody - 12.5, cd / 2, 0.3, 1.2);
    k.pop();
    // crown: crenellated parapet with a shallow slate cap
    merlons(k, bboxRect(b, cw, cd), keepBody, 1.7, 0.9, G, 1.7, { pointed: false });
    k.hipRoof(cw - 1.0, cd - 1.0, 1.0, 'slate', b.cx, keepBody - 0.2, b.cz, { over: 0.2, mat: 6 });
    k.box(0.3, 0.7, 0.3, L, b.cx, keepH - 0.6, b.cz);
    k.box(0.9, 0.1, 0.1, 'iron', b.cx, keepH - 0.15, b.cz);
  }

  // --- the gatehouse: an opened wall on the front edge with a round arch,
  // flanking pilasters, a portcullis and a stepped approach outward
  if (gate) {
    const gw = Math.min(6.0, gate.len);
    k.push({ x: gate.mx, y: 0, z: gate.mz, ry: gate.ry });
    k.wall(gw, wallH, t + 0.3, G, [{ x: 0, y: 0.9, w: 3.0, h: 4.6, arch: 'round', pane: 'dark', inset: 1.5 }], 0, 0, -((t + 0.3) / 2), { jit: 0.02 });
    k.surround({ x: 0, y: 0.9, w: 3.0, h: 4.6, arch: 'round' }, 0.45, 0.4, T, (t + 0.3) / 2);
    for (let i = 0; i < 4; i++) k.box(0.12, 4.0, 0.14, 'iron', -0.95 + i * 0.63, 1.2, (t + 0.3) / 2 + 0.05);
    k.box(3.2, 0.5, 0.5, L, 0, 6.0, (t + 0.3) / 2);
    merlons(k, [[-gw / 2, -0.5], [gw / 2, -0.5], [gw / 2, 0.5], [-gw / 2, 0.5]], wallH, 1.3, t, G, 1.5);
    // short stepped approach descending to the earthwork
    for (let i = 0; i < 2; i++) k.box(gw - 0.4, 0.4, 0.7, L, 0, 0.4 - i * 0.4, (t + 0.3) / 2 + 0.45 + i * 0.6, { jit: 0.04 });
    k.box(gw - 0.2, 0.3, 0.8, 'earth', 0, -0.4, (t + 0.3) / 2 + 1.6, { jit: 0.05 });
    k.pop();
  }
  k.end('main');
}

// Axis-aligned rectangle polygon around a bbox with the given over-size.
function bboxRect(b, w, d) {
  return [
    [b.cx - w / 2, b.cz - d / 2],
    [b.cx + w / 2, b.cz - d / 2],
    [b.cx + w / 2, b.cz + d / 2],
    [b.cx - w / 2, b.cz + d / 2],
  ];
}

castelo.metric = true;
castelo.rule = {
  view: 0.35,
  note: 'curtain wall on the real outline; the keep is drawn on the largest mapped tower footprint (OSM way includes its forebuilding), the other tower footprints as mapped',
};

export default { castelo };
