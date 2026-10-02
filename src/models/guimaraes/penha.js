// Santuário de Nossa Senhora do Carmo da Penha (Marques da Silva, 1930-47),
// metric builder (1:1 metres).
//
// data/dimensions.json: the OSM outline (way 342339768, 19.4 x 33.7 m, 605
// m2) is the sanctuary church alone, on the summit terrace at about 573 m;
// entrance tower 26 m, nave 16 m. Local frame (fit.js): +z = the west
// entrance front with the great stair, the tower and the cross; the apse is
// at -z (east). The 1947 granite Art-Deco church: straight lines, tall
// round-arched windows, square corner turrets, a wide frontal bay with its
// inverted-triangle glazed window, and the belfry tower with the open cross.
//
// The teleférico (the OSM cable line, its 14 pylons and both stations) and
// the whole Penha park are NOT drawn here: the cable is animated separately
// (life.js) and the park belongs to the city layer. The model stays on the
// church outline, so check-fit's site deviation is ~0.
import * as THREE from 'three';
import { win } from '../parts.js';
import { bbox, offset, clean, edges } from '../geom.js';

const G = 'granite';
const D = 'graniteDark';
const L = 'graniteLight';
const W = 'graniteWarm';

function penha(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const hTower = H.entrance_tower ?? 26;
  const hNave = H.nave ?? 16;
  const ol = clean(footprint.outline, 0.3);
  const b = bbox(ol); // x -9.7..9.7, z -16.8..16.8
  const eaves = hNave - 3; // 13 m eaves
  const y0 = 1.6; // church floor above the summit terrace

  k.begin('main');
  // --- summit terrace / crypt platform and the retaining edge
  k.prism(offset(ol, 0.8), -1.0, 1.0, D);
  k.prism(offset(ol, 0.6), y0 - 1.0, 1.0, G);
  k.prism(ol, -1.2, y0 + 0.01, D);

  // --- nave walls on the real outline, straight Art-Deco massing
  k.prism(ol, y0, eaves - y0, G);
  for (const p of ol) k.box(1.0, eaves, 1.0, L, p[0] * 0.95, y0, p[1] * 0.96);
  k.prism(offset(ol, 0.28), eaves, 0.32, L); // projecting string course
  k.prism(offset(ol, 0.12), eaves + 0.32, 0.5, G, { holes: [offset(ol, -0.6)] }); // parapet

  // --- side windows: tall round-arched openings on the two long walls
  for (const e of edges(ol)) {
    if (Math.abs(e.nx) < 0.85 || e.len < 12) continue;
    k.push({ x: e.mx, y: 0, z: e.mz, ry: e.ry });
    for (const u of [-11.5, -6.9, -2.3, 2.3, 6.9, 11.5]) {
      win(k, u, 4.4, 1.6, 5.0, 0, { arch: 'round', bw: 0.3, depth: 0.3, trim: L, pane: 'glass' });
    }
    for (const u of [-9.2, -4.6, 0, 4.6, 9.2]) {
      k.cyl(0.55, 0.55, 0.4, 10, L, u, eaves - 2.2, 0.15, { rx: Math.PI / 2 });
      k.cyl(0.4, 0.4, 0.2, 10, 'glass', u, eaves - 2.2, 0.32, { rx: Math.PI / 2, emit: 0.18 });
    }
    k.pop();
  }

  // --- rear body roof: shallow granite gable, ridge along the nave
  const rz0 = b.z0 + 1.0;
  const rz1 = 12.0;
  k.gableRoof(b.w - 1.4, rz1 - rz0, 2.4, 'slate', 0, eaves + 0.82, (rz0 + rz1) / 2, { over: 0.5 });
  // apse at -z: a lower rounded end carrying a shallow dome
  k.cyl(3.0, 3.0, 0.5, 8, D, 0, eaves + 0.4, b.z0 + 2.2, { ry: Math.PI / 8 });
  k.dome(2.6, 'lead', 0, eaves + 0.9, b.z0 + 2.2, { seg: 10, rings: 4, sy: 0.7 });

  // --- west front: wide frontal bay with the inverted-triangle glazed window
  const fz = b.z1; // 16.8
  k.push({ x: 0, z: fz - 0.6 });
  k.wall(b.w - 0.6, hNave - y0 + 1.2, 1.1, G, [
    { x: 0, y: 0.0, w: 3.0, h: 4.0, arch: 'round', pane: 'dark' },
  ], 0, y0, 0, { inset: 0.7 });
  k.surround({ x: 0, y: y0, w: 3.0, h: 4.0, arch: 'round' }, 0.35, 0.28, L, 0.55);
  // the inverted-triangle glazed field over the portal
  {
    const tri = new THREE.Shape();
    tri.moveTo(-2.9, y0 + 11.2);
    tri.lineTo(2.9, y0 + 11.2);
    tri.lineTo(0.0, y0 + 5.0);
    tri.closePath();
    k.extrude(tri, 0.45, G, 0, 0, 0.2);
    const inner = new THREE.Shape();
    inner.moveTo(-2.3, y0 + 10.7);
    inner.lineTo(2.3, y0 + 10.7);
    inner.lineTo(0.0, y0 + 5.9);
    inner.closePath();
    k.extrude(inner, 0.2, 'glass', 0, 0, 0.5, { emit: 0.22 });
    for (let i = -2; i <= 2; i++) k.segment([i * 0.95, y0 + 5.4, 0.62], [i * 0.4, y0 + 10.9, 0.62], 0.16, 0.16, L);
    k.box(6.2, 0.4, 0.6, L, 0, y0 + 4.75, 0.2);
    k.box(5.9, 0.35, 0.6, L, 0, y0 + 11.4, 0.2);
  }
  k.pop();
  k.prism(offset(ol, 0.35), hNave, 0.4, G); // stepped attic band across the front

  // --- two square corner turrets with pyramid caps (photo)
  for (const sx of [-1, 1]) {
    const tx = sx * 8.0;
    const tz = b.z1 - 2.0;
    k.box(2.6, 18.2 - y0, 2.6, W, tx, y0, tz);
    k.box(2.9, 0.5, 2.9, L, tx, 18.2, tz);
    k.cone(1.9, 2.2, 4, D, tx, 18.7, tz, { ry: Math.PI / 4 });
    for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      k.push({ x: tx, y: 15.0, z: tz, ry });
      k.wall(2.3, 2.4, 0.25, G, [{ x: 0, y: 0.3, w: 1.2, h: 1.5, arch: 'round', pane: 'dark' }], 0, 0, 1.25);
      k.pop();
    }
  }

  // --- belfry tower behind the front, carrying the open cross (to 26 m)
  const tw = 5.4;
  const tz = b.z1 - 6.4;
  k.box(tw + 0.6, 1.2, tw + 0.6, L, 0, eaves + 0.82, tz);
  k.box(tw, 22.4 - (eaves + 0.82), tw, W, 0, eaves + 0.82, tz);
  for (const ry of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    k.push({ x: 0, y: 17.2, z: tz, ry });
    k.wall(tw, 4.6, 0.55, G, [
      { x: -1.05, y: 0.7, w: 1.5, h: 3.0, arch: 'round', pane: 'dark' },
      { x: 1.05, y: 0.7, w: 1.5, h: 3.0, arch: 'round', pane: 'dark' },
    ], 0, 0, tw / 2 - 0.27);
    k.pop();
  }
  k.corniceRing(tw + 0.4, tw + 0.4, [[0, 0], [0.4, 0.2], [0.4, 0.7], [0.9, 1]], L, 0, 21.8, tz);
  k.box(tw * 0.7, 1.0, tw * 0.7, W, 0, 22.8, tz);
  // the open cross (thin needle with a cross bar), top exactly at hTower
  k.box(0.3, 2.3, 0.3, 'iron', 0, 23.5, tz);
  k.box(1.9, 0.18, 0.18, 'iron', 0, 25.1, tz);
  k.box(0.2, hTower - 25.4, 0.2, 'iron', 0, 25.4, tz);
  k.end('main');

  // --- the great stair down the west front: two short flights and a landing
  const stepW = 12.0;
  const zdrop = b.z1;
  k.stairs(stepW, 2.2, 0.9, 4, 'graniteLight', 0, -1.0, zdrop + 1.1, { below: 0.5 });
  k.box(stepW + 1.2, 0.4, 1.0, L, 0, -1.0, zdrop + 2.4);
  k.stairs(stepW - 1.0, 1.4, 0.6, 3, 'graniteLight', 0, -1.0, zdrop + 3.3, { below: 0.4 });
  k.prism([[-1.3, zdrop + 1.9], [1.3, zdrop + 1.9], [1.3, zdrop + 3.2], [-1.3, zdrop + 3.2]], -1.0, 0.45, D);
  k.prism([[-1.1, zdrop + 2.0], [1.1, zdrop + 2.0], [1.1, zdrop + 3.1], [-1.1, zdrop + 3.1]], -0.5, 0.18, 'water');
  for (const sx of [-1, 1]) k.box(0.5, 1.0, 0.5, L, sx * (stepW / 2 + 0.5), -1.0, zdrop + 2.4);
}

penha.metric = true;
penha.rule = {
  view: 0.3,
  note: 'sanctuary church alone on its OSM outline (entrance tower 26 m); the teleférico cable and park are left to the app (animated cable) and the city layer',
};

export default { penha };
