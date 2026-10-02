// Estádio D. Afonso Henriques (1965, rebuilt 2003), metric builder (1:1 m).
//
// data/dimensions.json: the OSM outline (way 211693383) is the whole stadium
// site (196.8 x 184.3 m); the pitch (way 189966626, 107 x 70 m) and twelve
// grandstand ways (Poente, Nascente, Norte, Sul and their Inferior /
// Superior tiers) are parts. Local frame: +z = west, the outer face of the
// Poente (main) stand; the pitch runs almost north-south. The model builds
// the green pitch with its lines and goals, the four two-tier stands
// (stepped terraces between the pitch and the real site outline) with a
// roof over the main and south stands, the floodlight masts and the
// advertising boards. Overall height 32 m (Poente).
import * as THREE from 'three';
import { bbox, clean, offset } from '../geom.js';

const CONC = 'graniteLight';
const SEAT = 'graniteGrey';
const MAST = 'steel';

// Stepped terrace of `n` steps between a pitch-side front (lo, low) and a
// back (hi, high) along one axis; spanLo..spanHi is the cross range.
function stand(k, axis, lo, hi, spanLo, spanHi, y0, y1, n, color) {
  const cross = spanLo + (spanHi - spanLo) / 2;
  const crossLen = Math.abs(spanHi - spanLo);
  const L = Math.abs(hi - lo);
  for (let i = 0; i < n; i++) {
    const c = lo + ((hi - lo) * i) / n;
    const len = Math.abs(hi - c);
    const y = y0 + ((y1 - y0) * (i + 1)) / n;
    const mid = (c + hi) / 2;
    if (axis === 'z') k.box(crossLen, y, len, color, cross, 0, mid);
    else k.box(len, y, crossLen, color, mid, 0, cross);
  }
  return { cross, crossLen, L };
}

function estadio(k, { footprint, dims }) {
  const E = dims?.elements ?? {};
  const H = dims?.height_m ?? {};
  const hTotal = H.total ?? 32;
  const O = clean(footprint.outline, 0.3); // site boundary
  const ob = bbox(O); // 196.8 x 184.3
  const pitchP = footprint.part('pitch');
  const pb = pitchP ? bbox(pitchP.pts) : { x0: -50, x1: 57, z0: -40, z1: 30, cx: 3.5, cz: -5, w: 107, d: 70 };
  const PL = E.pitch_length_m ?? 105;
  const PW = E.pitch_width_m ?? 68;

  k.begin('main');
  // --- site edge: low granite boundary wall on the real outline (fence/kerb)
  for (let i = 0; i < O.length; i++) k.wallLine(O[i], O[(i + 1) % O.length], 0.8, 0.5, 'graniteDark', 0, { ext: 0.2 });
  // apron / concourse
  k.prism(offset(O, -0.6), -0.4, 0.45, 'graniteGrey', { mat: 8 });

  // --- the pitch: grass, mowing stripes, white lines, goals
  k.prism(pitchP ? clean(pitchP.pts, 0.5) : [[pb.x0, pb.z0], [pb.x1, pb.z0], [pb.x1, pb.z1], [pb.x0, pb.z1]], -0.3, 0.5, 'grass', { mat: 5 });
  const PC = { x: pb.cx, z: pb.cz };
  for (let i = 0; i < 14; i++) k.box(PL / 14, 0.03, PW, i % 2 ? 'grass' : 'hedge', PC.x - PL / 2 + (i + 0.5) * (PL / 14), 0.2, PC.z, { mat: 0 });
  const line = (w, d, x, z) => k.box(w, 0.04, d, 'white', PC.x + x, 0.21, PC.z + z, { mat: 0 });
  line(PL, 0.14, 0, PW / 2);
  line(PL, 0.14, 0, -PW / 2);
  line(0.14, PW, PL / 2, 0);
  line(0.14, PW, -PL / 2, 0);
  line(0.14, PW, 0, 0);
  k.add(new THREE.TorusGeometry(9.15, 0.08, 3, 36), 'white', { x: PC.x, y: 0.22, z: PC.z, rx: Math.PI / 2, mat: 0 });
  for (const sx of [-1, 1]) {
    line(0.14, 40.3, sx * (PL / 2 - 16.5), 0);
    for (const sz of [-1, 1]) line(16.5, 0.14, sx * (PL / 2 - 8.25), sz * 20.15);
    const gx = PC.x + sx * (PL / 2 + 0.1);
    for (const sz of [-1, 1]) k.box(0.12, 2.44, 0.12, 'white', gx, 0.2, PC.z + sz * 3.66);
    k.box(0.12, 0.12, 7.32, 'white', gx, 2.6, PC.z);
    k.box(2, 2.4, 7.3, 'white', gx + sx * 1, 0.2, PC.z, { glass: true });
  }
  // advertising boards round the pitch
  for (const sz of [-1, 1]) k.box(PL + 22, 0.9, 0.2, 'dark', PC.x, 0.2, PC.z + sz * (PW / 2 + 6.5));
  for (const sx of [-1, 1]) k.box(0.2, 0.9, PW + 12, 'dark', PC.x + sx * (PL / 2 + 7.5), 0.2, PC.z);

  // --- four two-tier stands: stepped terraces between pitch and outline
  const NS = 11;
  // Poente (+z, main, roofed): front z=32, back z=89; lower to 12, upper to 26
  stand(k, 'z', PC.z + PW / 2 + 2, 89, -88, 74, 0.5, 12, 6, SEAT);
  stand(k, 'z', PC.z + PW / 2 + 2, 89, -88, 74, 11.8, 26, 7, SEAT);
  // Nascente (-z): front z=-42, back z=-89
  stand(k, 'z', PC.z - PW / 2 - 2, -89, -88, 48, 0.5, 12, 6, SEAT);
  stand(k, 'z', PC.z - PW / 2 - 2, -89, -88, 48, 11.8, 26, 7, SEAT);
  // Norte (-x): front x=-52, back x=-95
  stand(k, 'x', PC.x - PL / 2 - 2, -95, -50, 87, 0.5, 12, 6, SEAT);
  stand(k, 'x', PC.x - PL / 2 - 2, -95, -50, 87, 11.8, 26, 7, SEAT);
  // Sul (+x, roofed): front x=59, back x=95
  stand(k, 'x', PC.x + PL / 2 + 2, 95, -48, 42, 0.5, 12, 6, SEAT);
  stand(k, 'x', PC.x + PL / 2 + 2, 95, -48, 42, 11.8, 26, 7, SEAT);

  // --- yellow aisle stairs on the terraces and the glazed box row
  for (let i = 0; i < 9; i++) {
    const x = -84 + i * 20;
    k.segment([x, 1.2, PC.z + PW / 2 + 2], [x, 26, 87], 0.9, 0.12, 'flowerYellow', { mat: 0 });
  }
  for (let i = 0; i < 7; i++) k.segment([-84 + i * 28, 1.2, PC.z - PW / 2 - 2], [-84 + i * 28, 26, -87], 0.9, 0.12, 'flowerYellow', { mat: 0 });
  for (const sz of [-1, 1]) k.box(166, 3.4, 0.3, 'glass', -7, 12.2, PC.z + sz * 56, { emit: 0.16 });

  // --- aisle stairs on the north and south terraces
  for (let i = 0; i < 8; i++) k.segment([-95, 1.2, -44 + i * 16], [-52, 26, -44 + i * 16], 0.9, 0.12, 'flowerYellow', { mat: 0 });
  for (let i = 0; i < 8; i++) k.segment([59, 1.2, -44 + i * 11], [95, 26, -44 + i * 11], 0.9, 0.12, 'flowerYellow', { mat: 0 });
  // --- pitch railing and its posts
  for (let i = 0; i <= 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    if (i === 60) break;
    k.box(0.1, 1.0, 0.1, 'iron', PC.x + Math.sin(a) * (PL / 2 + 9), 0.2, PC.z + Math.cos(a) * (PW / 2 + 9));
  }
  // --- roof ribs and the light rig under each roof slab
  for (const [cx, cz, w, d] of [[-7, 70, 172, 34], [78, -4, 34, 118]]) {
    const along = w > d;
    const n = along ? Math.round(w / 8) : Math.round(d / 8);
    const span = along ? w : d;
    for (let i = 1; i < n; i++) {
      const u = -span / 2 + (i * span) / n;
      if (along) k.box(0.2, 0.4, d - 2, 'steel', cx + u, hTotal - 1.0, cz, { mat: 9 });
      else k.box(w - 2, 0.4, 0.2, 'steel', cx, hTotal - 1.0, cz + u, { mat: 9 });
    }
    const nL = along ? 30 : 18;
    for (let i = 0; i < nL; i++) {
      const u = -span / 2 + ((i + 0.5) * span) / nL;
      if (along) k.box(0.8, 0.3, 0.4, 'window', cx + u, hTotal - 1.6, cz + (d / 2 - 1), { emit: 0.8 });
      else k.box(0.4, 0.3, 0.8, 'window', cx + (w / 2 - 1), hTotal - 1.6, cz + u, { emit: 0.8 });
    }
  }
  // --- corner turnstile blocks
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    k.box(12, 5, 8, CONC, sx * 88, 0, sz * 86, { mat: 8 });
    k.box(12.4, 0.5, 8.4, 'graniteGrey', sx * 88, 5, sz * 86);
  }

  // --- roof over the main (Poente) and south stands: cantilevered slab
  const roof = (cx, cz, w, d, ry) => {
    k.box(w, 0.5, d, 'white', cx, hTotal - 0.5, cz, { ry, mat: 8 });
    k.box(w, 0.9, d + 0.4, 'steel', cx, hTotal - 1.4, cz, { ry, mat: 9 });
    // slim columns from the terrace top to the slab
    const n = Math.max(3, Math.round(w / 20));
    for (let i = 0; i <= n; i++) {
      const u = -w / 2 + (i * w) / n;
      const px = cx + u * Math.cos(ry || 0);
      const pz = cz - u * Math.sin(ry || 0);
      k.box(0.7, hTotal - 0.5 - 26, 0.7, CONC, px, 26, pz, { mat: 8 });
    }
  };
  roof(-7, 70, 172, 34, 0); // Poente, over the site's north edge
  roof(78, -4, 34, 118, 0); // Sul
  // back walls of the main and south stands up to the roof
  k.box(172, hTotal, 1.2, CONC, -7, 0, 88, { mat: 8 });
  k.box(1.2, hTotal, 118, CONC, 94, 0, -3, { mat: 8 });

  // --- four floodlight masts at the corners
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = sx * 82;
    const z = sz * 80;
    k.frustum(1.6, 1.6, 0.5, 0.5, hTotal - 3.0, MAST, x, 0, z, { mat: 9 });
    k.box(4.6, 3, 0.6, 'iron', x, hTotal - 3.0, z, { ry: Math.atan2(sx, sz) });
    k.box(4.2, 2.6, 0.2, 'window', x - sx * 0.35, hTotal - 2.8, z - sz * 0.35, { ry: Math.atan2(sx, sz), emit: 0.7 });
  }
  k.end('main');
}

estadio.metric = true;
estadio.rule = {
  view: 0.9,
  note: 'four steep two-tier stands built between the 107 x 70 m pitch and the real site outline; roof over the Poente (32 m) and Sul stands; floodlight masts to 32 m',
};

export default { 'estadio-afonso-henriques': estadio };
