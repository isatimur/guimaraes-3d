// Igreja de Nossa Senhora da Oliveira + Padrão do Salado, metric builder.
// data/dimensions.json: OSM way 167517737 is the church alone
// (46.5 x 22.6 m, east-west), three naves in three bays; west front with
// the Gothic portal and rose window; the Manueline tower (about 1513) at
// the south-west corner, total 30 m, nave ridge 17 m. The Padrão do Salado
// (w820481033, 5.2 x 4.6 m, part tag `monument`) stands 8 m west of the
// front on the Largo da Oliveira.
//
// Frame (fit.js): +z is the west front (bearing 265), +x is south. The
// church walls follow the OSM outline to the eaves; the nave carries a
// gable to the 17 m ridge, the aisles and apse lower hip roofs, the west
// gable the portal and rose window, and the Manueline tower rises to 30 m
// at the south-west corner. The Padrão is a four-pier Gothic canopy with a
// cross, modelled on its own OSM part (rule.extent includes it so the fit
// compares fairly). The Largo paving is NOT drawn (it would double the
// mask); the building stays on its outline.
import * as THREE from 'three';
import { corniceProfile, MAT, pointedPath, archPath, PROFILES } from '../kit.js';
import { win, cartouche, bell } from '../parts.js';
import { bbox, offset } from '../geom.js';
import { polyCornice } from '../metric.js';

const G = 'granite';
const T = 'graniteWarm';
const L = 'graniteLight';
const D = 'graniteDark';

// Pointed (Gothic) window: carved surround, glass pane, optional tracery.
function gothic(k, x, y, w, h, z, o = {}) {
  k.surround({ x, y, w, h, arch: 'pointed' }, o.bw ?? 0.28, o.depth ?? 0.32, o.trim ?? T, z);
  const s = new THREE.Shape();
  pointedPath(s, x, y, w, h, 6);
  k.plane(s, o.pane ?? 'glass', 0, 0, z + 0.05, { mat: MAT.flat, emit: o.emit ?? 0.15 });
  if (o.tracery) {
    k.box(0.12, h * 0.55, 0.1, o.trim ?? T, x, y + h * 0.22, z + 0.1);
    k.box(w * 0.55, 0.12, 0.1, o.trim ?? T, x, y + h * 0.55, z + 0.1);
  }
}

// Stepped buttress projecting from a wall face (local +z) of height h.
function buttress(k, h, depth = 0.75, width = 1.2, color = L) {
  for (let s = 0; s < 4; s++) {
    const d = depth - s * 0.14;
    k.box(width - s * 0.2, h * (1 - s * 0.18), d, color, 0, 0, d / 2 - 0.05, { jit: 0.04 });
  }
  k.box(width - 0.45, 0.3, depth * 0.62, color, 0, h * 0.82, depth * 0.24, { rx: -0.5 });
}

// The Padrão do Salado: four octagonal piers under a pointed canopy with a
// cross, drawn about (cx, cz); o.h is the overall height (9 m).
function padrao(k, cx, cz, h) {
  const hw = 2.1;
  const hd = 1.9;
  const base = 0.5;
  const ph = 4.8; // pier shaft
  const capBase = base + ph + 0.3; // 5.6
  const archTop = capBase + 1.0; // 6.6
  const capTop = 8.1;
  k.begin('padrao');
  // stepped base and altar
  k.box(2 * hw + 1.2, 0.5, 2 * hd + 1.2, D, cx, 0, cz);
  k.box(2 * hw - 0.4, 0.9, 2 * hd - 0.4, L, cx, 0.5, cz);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const px = cx + sx * hw;
    const pz = cz + sz * hd;
    k.box(0.78, 0.4, 0.78, T, px, base, pz);
    k.cyl(0.3, 0.34, ph, 8, L, px, base + 0.4, pz, { smooth: false });
    k.box(0.68, 0.3, 0.68, T, px, capBase - 0.3, pz);
  }
  // pointed arches on the four sides (extruded ribs with an opening)
  const aw = 2 * hw - 0.5;
  const ad = 2 * hd - 0.5;
  for (const [ry, len, ox, oz] of [[0, aw, 0, hd], [Math.PI, aw, 0, -hd], [Math.PI / 2, ad, hw, 0], [-Math.PI / 2, ad, -hw, 0]]) {
    k.push({ x: cx + ox, y: capBase, z: cz + oz, ry });
    const s = new THREE.Shape();
    pointedPath(s, 0, 0, len, 1.0, 5);
    const hole = new THREE.Path();
    pointedPath(hole, 0, 0.22, len - 0.9, 0.62, 5);
    s.holes.push(hole);
    k.extrude(s, 0.5, L, 0, 0, 0);
    k.pop();
  }
  // ribbed canopy over the crossing, pinnacles at the corners
  k.frustum(2 * hw + 0.4, 2 * hd + 0.4, 1.0, 0.9, capTop - archTop, L, cx, archTop, cz);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const px = cx + Math.cos(a) * (hw + 0.05);
    const pz = cz + Math.sin(a) * (hd + 0.05);
    k.box(0.45, 0.5, 0.45, L, px, archTop, pz);
    k.cone(0.3, 0.6, 4, L, px, capTop - 0.1, pz);
  }
  // little altar and cross finial to the real 9 m
  k.box(1.5, 1.0, 0.5, T, cx, base, cz + hd * 0.4);
  k.statue(0.95, L, cx, base, cz + hd * 0.45, { seg: 6 });
  k.cyl(0.09, 0.13, 0.7, 5, 'iron', cx, capTop, cz);
  k.box(0.14, h - capTop - 0.7, 0.14, 'iron', cx, capTop + 0.7, cz);
  k.box(h * 0.06, 0.12, 0.12, 'iron', cx, h - 0.55, cz);
  k.end('padrao');
}

function oliveira(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const hTower = H.tower ?? 30;
  const hRidge = H.nave_ridge ?? 17;
  const b = bbox(footprint.outline); // x -11.32..11.32, z -23.28..23.28
  const x0 = b.x0;
  const x1 = b.x1;
  const zW = b.z1; // 23.28 west front
  const zE = b.z0; // -23.28 apse
  const zApse = -17.9; // nave/apse join
  const eave = 11;
  const naveCx = -6.2; // centre of the west gable (the projecting front part)
  const naveW = 7.4;

  k.begin('main');
  // walls on the real outline: main body and the lower apse/chancel
  k.prism(footprint.outline, -0.9, eave + 0.9, G);
  k.prism(offset(footprint.outline, 0.22), -0.9, 1.5, D);
  polyCornice(k, footprint.outline, eave - 0.5, corniceProfile('eave', 0.5), L);

  // ---- roofs: nave gable to the 17 m ridge, south block and apse lower
  k.gableRoof(naveW + 0.2, zW - zApse - 0.2, hRidge - eave, 'terracotta', naveCx, eave, (zW + zApse) / 2, { over: 0.4, mat: MAT.tile });
  k.hipRoof(13.5, 19.6 - zApse, 3.2, 'terracotta', 4.4, eave, (19.6 + zApse) / 2, { over: 0.4, mat: MAT.tile });
  k.hipRoof(1.6, zW - zApse, 1.2, 'terracotta', x0 + 0.8, eave, (zW + zApse) / 2, { over: 0.3, mat: MAT.tile });
  k.hipRoof(12.64, zApse - zE + 0.2, 2.8, 'terracotta', -0.36, eave, (zApse + zE) / 2, { over: 0.4, mat: MAT.tile });
  k.box(12.9, 0.5, 0.6, L, -0.36, eave - 0.1, zApse + 0.1);

  // ---- west gable of the nave with the portal and the rose window
  const gs = new THREE.Shape();
  gs.moveTo(naveCx - naveW / 2, 0);
  gs.lineTo(naveCx + naveW / 2, 0);
  gs.lineTo(naveCx, hRidge - eave);
  gs.closePath();
  k.extrude(gs, 0.5, G, 0, eave, zW - 0.22);
  // raking cornices on the gable
  for (const sx of [-1, 1]) {
    const len = Math.hypot(naveW / 2, hRidge - eave);
    const a = Math.atan2(hRidge - eave, naveW / 2);
    k.box(len + 0.4, 0.4, 0.8, L, naveCx + (sx * naveW) / 4, eave + (hRidge - eave) / 2 - 0.1, zW - 0.15, { rz: -sx * a });
  }
  // pointed west portal with jamb shafts
  gothic(k, naveCx, 0, 2.5, 4.4, zW, { bw: 0.42, depth: 0.45, trim: T, pane: 'wood' });
  gothic(k, naveCx, 0, 1.7, 3.6, zW, { bw: 0.22, depth: 0.6, trim: L, pane: 'wood' });
  for (const sx of [-1, 1]) {
    k.box(2.9, 0.5, 0.9, D, naveCx + sx * 2.3, 0, zW + 0.3);
    k.cyl(0.22, 0.24, 3.2, 8, L, naveCx + sx * 2.3, 0.5, zW + 0.3);
  }
  // rose window: ring, tracery spokes, dark glass
  const ry = eave + 1.6;
  const rot = new THREE.TorusGeometry(1.7, 0.28, 4, 18);
  k.add(rot, T, { x: naveCx, y: ry, z: zW + 0.02 });
  k.cyl(1.5, 1.5, 0.1, 18, 'glass', naveCx, ry, zW + 0.04, { rx: Math.PI / 2, emit: 0.2 });
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    k.box(0.16, 2.9, 0.14, T, naveCx, ry, zW + 0.1, { rz: a });
  }
  k.cyl(0.34, 0.34, 0.16, 10, T, naveCx, ry, zW + 0.12, { rx: Math.PI / 2 });
  k.box(naveW - 1.5, 0.55, 0.7, L, naveCx, eave - 0.7, zW - 0.05);

  // ---- low south-west entrance on the recessed front (x -2.4..5.8, z 19.6)
  k.push({ x: 1.7, z: 19.6, ry: 0 });
  gothic(k, 0, 0, 1.6, 2.8, 0, { bw: 0.3, depth: 0.35, trim: T, pane: 'wood' });
  k.pop();

  // ---- buttresses and tall Gothic windows along the flanks
  const north = [];
  for (let z = zApse + 1.5; z < 15.5; z += 6.4) north.push(z);
  for (const z of north) {
    k.push({ x: x0 - 0.02, z, ry: -Math.PI / 2 });
    buttress(k, eave - 0.5, 0.85, 1.3);
    k.pop();
  }
  for (let i = 0; i < north.length - 1; i++) {
    const z = (north[i] + north[i + 1]) / 2;
    k.push({ x: x0 - 0.02, z, ry: -Math.PI / 2 });
    gothic(k, 0, 4.2, 1.7, 5.0, 0, { tracery: true });
    k.pop();
  }
  const south = [];
  for (let z = zApse + 1.5; z < -1; z += 6.4) south.push(z);
  for (const z of south) {
    k.push({ x: x1 + 0.02, z, ry: Math.PI / 2 });
    buttress(k, eave - 0.5, 0.85, 1.3);
    k.pop();
  }
  for (let i = 0; i < south.length - 1; i++) {
    const z = (south[i] + south[i + 1]) / 2;
    k.push({ x: x1 + 0.02, z, ry: Math.PI / 2 });
    gothic(k, 0, 4.2, 1.7, 5.0, 0, { tracery: true });
    k.pop();
  }
  // apse windows
  for (const sx of [-1, 1]) {
    k.push({ x: -0.36 + sx * 6.4, z: zE + 0.02, ry: Math.PI });
    gothic(k, 0, 3.4, 1.1, 3.2, 0, { bw: 0.24, depth: 0.3 });
    k.pop();
  }

  // ---- Manueline tower at the south-west corner, 30 m
  const tcx = 6.6;
  const tcz = 18.0;
  const tw = 5.2;
  const body = 23.5;
  k.box(tw + 0.8, 1.4, tw + 0.8, D, tcx, 0, tcz);
  k.frustum(tw, tw, tw - 0.4, tw - 0.4, body, G, tcx, 0, tcz, { noBottom: true });
  for (const y of [7.5, 15.5, 21.5]) k.box(tw + 0.3, 0.35, tw + 0.3, L, tcx, y, tcz);
  // corner quoin strips and the iron-grille window with the arms (photo)
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) k.box(0.7, body - 1, 0.7, D, tcx + sx * (tw / 2 - 0.35), 1, tcz + sz * (tw / 2 - 0.35));
  win(k, tcx, 4.0, 2.4, 3.2, tcz + tw / 2, { bw: 0.4, depth: 0.3, pane: 'dark', trim: L, sill: false });
  for (let i = 0; i < 6; i++) k.box(0.09, 3.0, 0.09, 'iron', tcx - 1.1 + i * 0.44, 4.2, tcz + tw / 2 + 0.16);
  for (let i = 0; i < 5; i++) k.box(2.3, 0.09, 0.09, 'iron', tcx, 3.2 + i * 0.6, tcz + tw / 2 + 0.16);
  cartouche(k, 1.1, 1.4, 0.3, L, tcx, 8.6, tcz + tw / 2 + 0.08);
  // belfry: pointed openings on the four faces, corner pinnacles
  const by = body;
  for (const [ry, ox, oz] of [[0, 0, tw / 2], [Math.PI, 0, -tw / 2], [Math.PI / 2, tw / 2, 0], [-Math.PI / 2, -tw / 2, 0]]) {
    k.push({ x: tcx + ox, y: by, z: tcz + oz, ry });
    const s = new THREE.Shape();
    pointedPath(s, 0, 0, 2.0, 3.4, 5);
    const hole = new THREE.Path();
    pointedPath(hole, 0, 0.3, 1.35, 2.6, 5);
    s.holes.push(hole);
    k.extrude(s, 0.5, L, 0, 0, 0);
    k.surround({ x: 0, y: 0.3, w: 1.35, h: 2.6, arch: 'pointed' }, 0.18, 0.2, T, 0.25);
    k.pop();
  }
  k.box(tw - 1, 3.4, tw - 1, 'dark', tcx, by, tcz);
  bell(k, 1.0, tcx, by + 0.9, tcz + tw / 2 - 0.9);
  bell(k, 0.85, tcx + tw / 2 - 0.9, by + 1.0, tcz);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    k.box(0.8, 4.4, 0.8, L, tcx + sx * (tw / 2 - 0.3), by, tcz + sz * (tw / 2 - 0.3));
    k.cone(0.55, 1.0, 4, L, tcx + sx * (tw / 2 - 0.3), by + 4.4, tcz + sz * (tw / 2 - 0.3));
  }
  // balustrade and pyramid spire to the real 30 m
  const cy = by + 4.4;
  k.corniceRing(tw, tw, corniceProfile('classic', 0.5), L, tcx, cy - 0.3, tcz);
  k.box(tw - 0.5, 0.4, tw - 0.5, D, tcx, cy, tcz);
  k.cone(tw * 0.62, hTower - cy - 0.4, 8, 'slate', tcx, cy + 0.4, tcz, { smooth: false });
  k.cyl(0.1, 0.14, 1.0, 5, 'iron', tcx, hTower - 0.5, tcz);
  k.box(0.7, 0.1, 0.1, 'iron', tcx, hTower - 0.75, tcz);
  k.end('main');

  // ---- Padrão do Salado on its own OSM part (west of the front)
  const mon = footprint.part(/monument/);
  const mb = mon ? bbox(mon.pts) : { cx: 7.06, cz: 27.86 };
  padrao(k, mb.cx, mb.cz, dims?.height_m?.padrao ?? 9);
  void archPath;
  void PROFILES;
}

oliveira.metric = true;
oliveira.rule = {
  extent: [/monument/],
  view: 0.3,
  note: 'church on its OSM outline to the eaves, nave gable to the 17 m ridge, Manueline tower to 30 m at the south-west corner; the Padrão do Salado modelled on its OSM monument part (extent includes it). Largo da Oliveira paving and cloister are NOT drawn so the mask stays on the church.',
};

export default { oliveira };
