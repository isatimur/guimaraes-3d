// Igreja de Nossa Senhora da Consolação e Santos Passos, metric builder.
//
// Frame (fit.js): +z = 43.8 deg, the north-east front above the stair and
// the Largo da República do Brasil (dimensions.json). The OSM outline
// (w166138931, 44.4 x 23.8 m) is the church on its 134 deg axis; the Largo
// de São Gualter garden (w451046703) lies on the axis behind it.
// From data/dimensions.json: the twin slender towers 30 m, the broad
// pedimented front 18.4 m wide, 18 m; church completed 1785, towers 1875.
// From the photos: a granite/plaster baroque-neoclassical front with two
// towers, a wide granite stair down to the street, and the garden parterre
// of São Gualter behind.
import { corniceProfile, MAT } from '../kit.js';
import { win, pediment, bellTower } from '../parts.js';
import { bbox, offset, edges } from '../geom.js';
import { polyCornice, roofOver } from '../metric.js';
import { lowTree, drapePoly } from '../drape.js';

const G = 'granite';
const GL = 'graniteLight';
const GD = 'graniteDark';

function edgeFacing(pts, dir) {
  let best = null;
  for (const e of edges(pts)) {
    if (e.len < 5) continue;
    const d = e.nx * dir[0] + e.nz * dir[1];
    if (best === null || d > best.d) best = { e, d };
  }
  return best && best.d > 0.3 ? best.e : null;
}

function santosPassos(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const hTop = H.towers ?? 30;
  const hPed = H.facade_pediment ?? 18;
  const O = footprint.outline;
  const ob = bbox(O);
  const eave = 13.5;

  k.begin('mask');
  // ------------------------------------------------------------ church body
  k.begin('main');
  k.prism(O, -2, eave + 2, 'plaster');
  k.prism(offset(O, 0.2), -2, 2.0, GD);
  polyCornice(k, O, eave - 0.6, corniceProfile('eave', 0.6), GL, { minLen: 2 });
  roofOver(k, O, eave, 4.2, 'terracotta', 'gable', { over: 0.5 });
  // ridge tiles and two roof dormers along the nave
  {
    const ob2 = bbox(O);
    const alongX = ob2.w >= ob2.d;
    const rl = alongX ? ob2.w - 1.4 : ob2.d - 1.4;
    for (let u = -rl / 2 + 0.7; u < rl / 2 - 0.5; u += 1.3) {
      if (alongX) k.box(1.05, 0.16, 0.5, 'terracotta', ob2.cx + u, eave + 4.15, ob2.cz);
      else k.box(0.5, 0.16, 1.05, 'terracotta', ob2.cx, eave + 4.15, ob2.cz + u);
    }
  }
  // tall round-arched nave windows between pilasters on the long sides
  for (const e of edges(O)) {
    if (e.len < 10 || Math.abs(e.nx) < 0.7) continue;
    k.push({ x: e.mx + e.nx * 0.05, z: e.mz + e.nz * 0.05, ry: e.ry });
    const n = Math.max(2, Math.floor(e.len / 6));
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * (e.len / n)) / 2 + i * (e.len / n);
      win(k, u, 6.0, 1.4, 3.6, 0, { arch: 'round', bw: 0.3, depth: 0.28, trim: GL, pane: 'glass', emit: 0.1, sill: true });
      k.box(0.8, eave - 0.6, 0.35, GL, u + (e.len / n) / 2, 0, 0.1);
    }
    k.pop();
  }
  k.end('main');
  k.end('mask');

  // --------------------------------------------------- twin-tower front (+z)
  const fe = edgeFacing(O, [0, 1]);
  if (fe) {
    const zF = fe.mz + 0.3;
    const x0 = Math.min(fe.a[0], fe.b[0]);
    const x1 = Math.max(fe.a[0], fe.b[0]);
    const fw = fe.len; // 18.4 m
    const tw = 5.0;
    const tx0 = x0 + tw / 2 + 0.3;
    const tx1 = x1 - tw / 2 - 0.3;
    // central front wall with the portal and the great window
    k.wall(fw, eave, 1.1, G, [
      { x: 0, y: 0.2, w: 2.7, h: 4.2, arch: 'round', pane: 'wood', inset: 0.6 },
      { x: 0, y: 7.0, w: 1.9, h: 3.4, arch: 'round', pane: 'glass', emit: 0.2, inset: 0.5 },
    ], (x0 + x1) / 2, 0, zF - 0.55, { inset: 0.7 });
    k.push({ x: (x0 + x1) / 2, z: zF, ry: 0 });
    k.surround({ x: 0, y: 0.2, w: 2.7, h: 4.2, arch: 'round' }, 0.4, 0.35, GL, 0);
    k.surround({ x: 0, y: 7.0, w: 1.9, h: 3.4, arch: 'round' }, 0.32, 0.3, GL, 0);
    // twin niches with statues flanking the portal, a tablet over the door
    for (const s of [-1, 1]) {
      k.wall(1.4, 2.7, 0.35, G, [{ x: 0, y: 0.35, w: 0.85, h: 1.9, arch: 'round', pane: 'dark', inset: 0.2 }], s * 3.5, 2.7, 0.3);
      k.statue(1.6, GL, s * 3.5, 3.4, 0.5, { seg: 5, pose: 'hold' });
    }
    k.box(2.2, 0.7, 0.16, GL, 0, 5.1, 0.42, { mat: MAT.smooth });
    k.box(fw + 0.4, 0.5, 0.7, GL, 0, eave - 0.5, 0.2);
    k.cornice(fw + 0.8, corniceProfile('classic', 0.7), GL, 0, eave, 0.1);
    // broad segmental pediment between the towers, to the real 18 m
    pediment(k, fw - 1.2, hPed - (eave + 0.7), 0.8, GL, 0, eave + 0.7, 0.15, { frame: 0.35, tympanum: 'plaster' });
    k.box(0.2, 1.3, 0.2, 'iron', 0, hPed, 0.2);
    k.box(0.75, 0.15, 0.15, 'iron', 0, hPed + 0.95, 0.2);
    k.pop();
    // the two slender towers, tops at the real 30 m
    const capH = Math.max(3.6, hTop - 26.5);
    k.begin('height');
    for (const tx of [tx0, tx1]) {
      bellTower(k, {
        x: tx,
        z: zF - tw / 2,
        w: tw,
        hBody: 15.5,
        hBelfry: 4.4,
        body: 'plaster',
        trim: GL,
        cap: 'pyramid',
        capH,
        openings: 2,
        windows: 1,
        sideWindows: false,
        urns: 'pinnacle',
        cross: true,
        clock: true,
        balustrade: true,
        belfryBody: 'plaster',
      });
    }
    k.end('height');
    // wide granite stair down from the front, centred on the axis
    const sx = (x0 + x1) / 2;
    k.stairs(fw + 3, 6.0, 2.4, 10, G, sx, -2.2, zF + 3.2, { below: 2.2 });
    for (const s of [-1, 1]) {
      k.wallLine([sx + s * (fw / 2 + 1.5), zF], [sx + s * (fw / 2 + 1.5), zF + 6], 0.9, 0.8, GL, -2.2);
      k.box(1.0, 1.4, 1.0, GL, sx + s * (fw / 2 + 1.5), -0.9, zF + 6.6);
      k.sphere(0.5, GL, sx + s * (fw / 2 + 1.5), 0.7, zF + 6.6, { seg: 8, rings: 5 });
    }
  }

  // -------------------------------------------------- the São Gualter garden
  const garden = footprint.part(/Gualter/);
  if (garden) {
    const ground = footprint.ground;
    drapePoly(k, garden.pts, ground, 0.14, 'grass', { cell: 8, mat: MAT.leaf });
    const gb = bbox(garden.pts);
    // box parterre: a hedge square, two walks, plane trees and benches
    const cx = gb.cx;
    const cz = (gb.z0 + gb.z1) / 2;
    const y = ground(cx, cz);
    k.prism([[cx - 9, cz - 7], [cx + 9, cz - 7], [cx + 9, cz + 7], [cx - 9, cz + 7]], y + 0.05, 0.6, 'hedge', { holes: [[[cx - 6.5, cz - 4.5], [cx + 6.5, cz - 4.5], [cx + 6.5, cz + 4.5], [cx - 6.5, cz + 4.5]]] });
    k.box(4, 0.2, 22, GL, cx, y + 0.12, cz, { mat: MAT.smooth });
    k.box(20, 0.2, 4, GL, cx, y + 0.13, cz, { mat: MAT.smooth });
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const tx = cx + sx * 12;
      const tz = cz + sz * 9;
      lowTree(k, tx, ground(tx, tz) + 0.2, tz, 9, { spread: 0.5, lobes: 2 });
      k.box(1.8, 0.5, 0.5, GD, tx, ground(tx, tz) + 0.5, tz + 2.2, { mat: MAT.flat });
    }
    // a low stone kerb and four lamps along the garden frontage
    for (let i = -2; i <= 2; i++) {
      k.box(0.22, 4.0, 0.22, 'steel', cx + i * 7, ground(cx + i * 7, gb.z1) + 0.1, gb.z1 - 0.5, { mat: MAT.metal });
      k.sphere(0.32, 0xefdca0, cx + i * 7, ground(cx + i * 7, gb.z1) + 4.3, gb.z1 - 0.5, { seg: 7, rings: 4, emit: 0.65 });
    }
  }
  void ob;
}

santosPassos.metric = true;
santosPassos.rule = {
  extent: [/garden/],
  view: 0.4,
  note: 'church on its OSM outline (main/mask, 30 m twin towers, 18 m pediment, wide stair); the Largo de São Gualter garden draped on its OSM part behind; mask = church so it does not overlap neighbours',
};

export default { 'santos-passos': santosPassos };
