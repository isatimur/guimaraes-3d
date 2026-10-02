// Castelo de Guimarães (10th c., rebuilt under Count Henry, gothic walls
// under D. Dinis), metric builder. data/dimensions.json: the OSM way
// 346365692 is the crenellated curtain-wall ring (207 m perimeter, a
// faceted shield plan); curtain wall 12 m, seven mapped quadrangular wall
// towers 14 m, the keep (w346365691) 12.3 x 11.8 m and 27 m. The gate faces
// south-west down the Colina Sagrada towards São Miguel and the Paço.
//
// The keep is drawn on the largest mapped tower footprint (its OSM way
// includes the forebuilding), the other tower footprints as they are
// mapped; the curtain wall follows the real outline edge by edge.
import { win } from '../parts.js';
import { bbox } from '../geom.js';

const G = 'granite';
const T = 'graniteWarm';
const D = 'graniteDark';

// A crenellated parapet along a closed polygon: merlons every `step` metres.
function merlons(k, pts, y, h, t, color, step = 2.0) {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.6) continue;
    const n = Math.max(1, Math.round(len / step));
    const ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    for (let j = 0; j < n; j++) {
      const u = (j + 0.5) / n;
      k.box((len / n) * 0.6, h, t, color, a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u, { ry });
    }
  }
}

function castelo(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const wallH = H.curtain_wall ?? 12;
  const towerH = H.wall_towers ?? 14;
  const keepH = H.keep ?? 27;
  const cw = dims?.elements?.keep_side_m ?? 12.3;
  const cd = 11.8;
  const ol = footprint.outline;
  const t = 2.4; // curtain-wall thickness

  k.begin('main');
  // footing course on the bedrock
  k.prism(ol, -0.8, 1.0, D);

  // curtain wall: one slab per real outline edge, then a crenellated parapet
  for (let i = 0; i < ol.length; i++) {
    k.wallLine(ol[i], ol[(i + 1) % ol.length], wallH, t, G, 0.2, { ext: 0.45 });
  }
  // string course under the parapet, then the merlons
  for (let i = 0; i < ol.length; i++) {
    k.wallLine(ol[i], ol[(i + 1) % ol.length], 0.22, t + 0.24, T, wallH - 0.22, { ext: 0.2 });
  }
  merlons(k, ol, wallH, 1.3, t * 0.98, G, 2.0);

  // the mapped wall towers (quadrangular, crenellated); the largest is the keep
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
    k.prism(p.pts, 0, towerH, G);
    merlons(k, p.pts, towerH, 1.2, t * 0.7, G, 1.7);
    const b = bbox(p.pts);
    // a small round-arched opening on each tower face
    k.push({ x: b.cx, z: b.cz });
    win(k, 0, towerH - 4.2, 0.5, 1.1, b.d / 2, { arch: 'round', bw: 0.14, depth: 0.2, pane: 'dark', trim: T });
    k.pop();
  }

  // the keep: 12.3 x 11.8 m, 27 m, on the largest tower footprint
  if (keep) {
    const b = bbox(keep.pts);
    k.box(cw, keepH, cd, G, b.cx, 0, b.cz);
    // corner quoins
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      for (let c = 0; c * 1.05 < keepH - 1.6; c++) {
        const y = 0.6 + c * 1.05;
        const long = c % 2 ? 1.1 : 0.6;
        const short = c % 2 ? 0.6 : 1.1;
        k.box(long, 0.95, short, G, b.cx + sx * (cw / 2 - long / 2 + 0.02), y, b.cz + sz * (cd / 2 - short / 2 + 0.02), { jit: 0.04 });
      }
    }
    merlons(k, [[b.cx - cw / 2, b.cz - cd / 2], [b.cx + cw / 2, b.cz - cd / 2], [b.cx + cw / 2, b.cz + cd / 2], [b.cx - cw / 2, b.cz + cd / 2]], keepH, 1.5, 0.95, G, 1.9);
    // the high round-arched door reached from the wall-walk, arms above
    k.push({ x: b.cx, z: b.cz });
    win(k, 0, keepH - 4.6, 1.15, 2.2, cd / 2, { arch: 'round', bw: 0.26, depth: 0.32, pane: 'dark', trim: T });
    k.box(1.9, 0.24, 0.5, T, 0, keepH - 2.2, cd / 2 + 0.16);
    // twin window higher up
    for (const sx of [-1, 1]) win(k, sx * 0.45, keepH - 8.4, 0.6, 1.35, cd / 2, { arch: 'round', bw: 0.14, depth: 0.22, pane: 'glass', trim: T });
    k.box(0.16, 1.35, 0.16, T, 0, keepH - 8.4, cd / 2 + 0.08);
    k.pop();
  }
  k.end('main');
}

castelo.metric = true;
castelo.rule = {
  view: 0.35,
  note: 'curtain wall on the real outline; the keep is drawn on the largest mapped tower footprint (OSM way includes its forebuilding), the other tower footprints as mapped',
};

export default { castelo };
