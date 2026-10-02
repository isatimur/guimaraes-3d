// Igreja de São Miguel do Castelo, metric builder (consecrated 1239).
// data/dimensions.json: OSM way 104203858 is a single rectangular nave
// (extent 22.6 x 9.2 m) oriented east-west, entrance at the west end.
// eaves 5 m, bell gable and total 9 m, one nave.
//
// Frame (fit.js): +z is the west front (bearing 247, snapped to the 9.2 m
// west edge), so the apse is at -z. The outline itself carries the plan:
// a wide nave (x -4.64..4.64, z -5..11.3) with a narrower chancel
// (x -3.6..3.7, z -11.3..-5).
//
// Romanesque chapel (assets/img/sao-miguel-castelo*.jpg): grey weathered
// granite ashlar, a gabled west front with a round-arched portal of two
// orders, a tiny round window above it, long-and-short corner quoins,
// stepped buttresses at the west corners, a low chancel with its own
// gable and a small east window, and a bell gable (sineira) with one bell
// over the west gable. A corbel table runs just under the eaves.
import * as THREE from 'three';
import { corniceProfile, MAT } from '../kit.js';
import { win, bell } from '../parts.js';
import { bbox, offset } from '../geom.js';
import { polyCornice } from '../metric.js';

const G = 'granite';
const T = 'graniteWarm';
const L = 'graniteLight';

// Long-and-short dressed corner stones of a rectangular body.
function quoins(k, cx, cz, hw, hd, h, y0 = 0.4, step = 0.82, color = G) {
  for (let c = 0; y0 + c * step < h - 0.5; c++) {
    const y = y0 + c * step;
    const lng = c % 2 ? 1.05 : 0.58;
    const sht = c % 2 ? 0.58 : 1.05;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      k.box(lng, 0.74, sht, color, cx + sx * (hw - lng / 2 + 0.02), y, cz + sz * (hd - sht / 2 + 0.02), { jit: 0.05 });
    }
  }
}

// Stepped buttress on a wall face at z, centred on x (facing +z).
function buttress(k, x, z, h, depth = 0.7, width = 1.1, color = L) {
  for (let s = 0; s < 4; s++) {
    k.box(width - s * 0.18, h * (1 - s * 0.2), depth - s * 0.13, color, x, 0, z + (depth - s * 0.13) / 2 - 0.05, { jit: 0.04 });
  }
  // sloped coping
  k.box(width - 0.5, 0.28, depth * 0.7, color, x, h * 0.8, z + depth * 0.25, { rx: -0.5, jit: 0.03 });
}

function saoMiguel(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const eaves = H.eaves ?? 5;
  const total = H.total ?? 9;
  const b = bbox(footprint.outline);
  const x1 = b.x1; // 4.64
  const zW = b.z1; // 11.3, west front
  const zE = b.z0; // -11.3
  const zStep = -5; // nave/chancel join
  // gable ridge of the nave and rise of the roofs
  const nRise = 2.2;
  const ridge = eaves + nRise; // 7.2
  const cRise = 1.75;

  k.begin('main');
  // nave + chancel walls on the real outline, with a footing course
  k.prism(footprint.outline, -0.6, eaves + 0.6, G);
  k.prism(offset(footprint.outline, 0.12), -0.6, 1.15, 'graniteDark');
  // eave cornice, string course and corbel table
  polyCornice(k, footprint.outline, eaves - 0.5, corniceProfile('eave', 0.35), L);
  k.prism(offset(footprint.outline, 0.05), eaves - 1.35, 0.2, L);
  for (const side of [-1, 1]) {
    for (let z = zE + 0.6; z < zW - 0.4; z += 0.68) {
      k.box(0.32, 0.32, 0.3, L, side * (x1 + 0.05), eaves - 0.62, z, { jit: 0.05 });
    }
  }
  // corner quoins: nave west corners, nave east corners, chancel rear corners
  quoins(k, 0, (zW + zStep) / 2, x1, (zW - zStep) / 2, eaves, 0.4, 0.72);
  quoins(k, 0, (zStep + zE) / 2, 3.62, (zStep - zE) / 2, eaves, 0.4, 0.72);

  // ---- roofs: gabled nave and chancel (ridge along z)
  k.gableRoof(2 * x1 + 0.15, zW - zStep - 0.2, nRise, 'terracotta', 0, eaves, (zW + zStep) / 2, { over: 0.2, mat: MAT.tile });
  k.gableRoof(7.3, zStep - zE - 0.2, cRise, 'terracotta', 0.05, eaves, (zStep + zE) / 2, { over: 0.2, mat: MAT.tile });
  // masonry west gable (covers the roof end)
  const gs = new THREE.Shape();
  gs.moveTo(-x1, 0);
  gs.lineTo(x1, 0);
  gs.lineTo(0, nRise);
  gs.closePath();
  k.extrude(gs, 0.35, G, 0, eaves, zW - 0.18);
  // small east window of the chancel
  win(k, 0.05, 3.1, 0.5, 1.0, zE + 0.02, { arch: 'round', bw: 0.2, depth: 0.35, pane: 'glass', trim: T });

  // ---- buttresses: at the west corners, pairs along the nave, chancel sides
  for (const sx of [-1, 1]) buttress(k, sx * (x1 - 0.2), zW - 0.9, eaves, 0.62, 0.92);
  for (const sx of [-1, 1]) {
    for (const z of [zStep + 3.4, zStep + 8.2]) {
      k.push({ x: sx * (x1 - 0.05), z, ry: sx > 0 ? 0 : Math.PI });
      buttress(k, 0, 0, eaves - 0.4, 0.6, 0.98);
      k.pop();
    }
    k.push({ x: sx * 3.62, z: zE + 3.2, ry: sx > 0 ? 0 : Math.PI });
    buttress(k, 0, 0, eaves - 1.2, 0.55, 0.9);
    k.pop();
  }

  // ---- west portal: two carved orders, a tympanum and a dark door
  win(k, 0, 0, 1.9, 2.85, zW, { arch: 'round', bw: 0.3, depth: 0.5, pane: 'dark', trim: T, sill: false });
  k.surround({ x: 0, y: 0, w: 1.9, h: 2.85, arch: 'round' }, 0.62, 0.24, L, zW);
  // voussoir blocks on the outer order
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (i / 8);
    const r = 1.35;
    k.box(0.42, 0.24, 0.28, L, Math.cos(a) * r, 2.85 - 0.95 + Math.sin(a) * r, zW + 0.06, { rz: a - Math.PI / 2, jit: 0.05 });
  }
  // the small round window above the portal, in a squared frame
  k.box(1.15, 1.15, 0.22, T, 0, 4.15, zW + 0.11);
  k.cyl(0.42, 0.42, 0.3, 10, L, 0, 4.15, zW + 0.06, { rx: Math.PI / 2 });
  k.cyl(0.3, 0.3, 0.1, 10, 'dark', 0, 4.15, zW + 0.2, { rx: Math.PI / 2 });
  // narrow slit window higher on the gable
  k.box(0.22, 0.95, 0.16, 'graniteDark', 0, 5.6, zW + 0.02);

  // ---- bell gable (sineira) over the west gable, one bell
  k.wall(1.9, 1.55, 0.42, T, [{ x: 0, y: 0.06, w: 0.86, h: 1.15, arch: 'round', pane: null }], 0, ridge - 0.05, zW - 0.06);
  k.surround({ x: 0, y: 0.06, w: 0.86, h: 1.15, arch: 'round' }, 0.14, 0.14, L, zW + 0.12);
  bell(k, 0.52, 0, ridge + 0.32, zW + 0.08);
  k.box(2.25, 0.22, 0.6, L, 0, ridge + 1.5, zW - 0.06);
  k.cone(1.15, 0.5, 4, L, 0, ridge + 1.72, zW - 0.06);
  k.box(0.1, 0.42, 0.1, 'iron', 0, ridge + 2.22, zW - 0.06);
  k.box(0.34, 0.09, 0.09, 'iron', 0, ridge + 2.4, zW - 0.06);

  // ---- small round-arched windows on the nave and chancel flanks
  for (const sx of [-1, 1]) {
    for (const z of [zStep + 2.0, zStep + 6.0, zStep + 10.4]) {
      k.push({ x: sx * (x1 + 0.02), z, ry: sx > 0 ? 0 : Math.PI });
      win(k, 0, 3.4, 0.44, 0.8, 0, { arch: 'round', bw: 0.16, depth: 0.3, pane: 'glass', trim: T });
      k.pop();
    }
    for (const z of [zE + 2.0, zE + 4.4]) {
      k.push({ x: sx * 3.62, z, ry: sx > 0 ? 0 : Math.PI });
      win(k, 0, 3.2, 0.4, 0.72, 0, { arch: 'round', bw: 0.15, depth: 0.28, pane: 'dark', trim: T });
      k.pop();
    }
  }
  // carved tympanum relief over the portal and two corbels beside it
  const tym = new THREE.Shape();
  tym.moveTo(-0.95, 0);
  tym.lineTo(0.95, 0);
  tym.absarc(0, 0, 0.95, 0, Math.PI, false);
  tym.closePath();
  k.extrude(tym, 0.16, L, 0, 1.95, zW + 0.18);
  k.cyl(0.34, 0.34, 0.18, 10, T, 0, 2.4, zW + 0.24, { rx: Math.PI / 2 });
  for (const sx of [-1, 1]) {
    k.box(0.3, 0.5, 0.36, L, sx * 1.55, 2.55, zW + 0.12, { jit: 0.05 });
    k.box(0.26, 0.4, 0.3, T, sx * 1.5, 2.0, zW + 0.1, { jit: 0.05 });
  }
  k.end('main');

  // context apron chips along the foot of the walls (a thin granite kerb),
  // kept inside the outline so the mask does not spill over the churchyard
  void total;
  void corniceProfile;
}

saoMiguel.metric = true;
saoMiguel.rule = {
  view: 0.3,
  note: 'single nave on the OSM outline with its narrower chancel; eaves 5 m from OSM height, gable ridge ~7.2 m and a bell gable with one bell to 9 m (dims estimate). The west front (+z, bearing 247) carries the round-arched portal.',
};

export default { 'sao-miguel-castelo': saoMiguel };
