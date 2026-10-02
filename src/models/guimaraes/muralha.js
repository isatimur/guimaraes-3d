// Torre da Alfândega and a stub of the 13th-c. town wall, metric builder.
// data/dimensions.json: OSM maps the tower as a node on a 12.5 m
// barrier=city_wall stub, so footprints.json synthesizes a 20 x 8 m
// rectangle on that stub. Height: wall with merlons ~8 m, the two-floor
// tower ~15 m. The «Aqui nasceu Portugal» inscription is on the face
// looking to the Largo do Toural, the north-east side (+z, bearing 25).
//
// From the photos (assets/img/muralha*.jpg): rough coursed granite ashlar,
// a battered plinth, tall pointed merlons with sloped caps along the wall
// and the tower, and the three lines of white raised letters low on the
// tower face. The long 270 m wall stretch of the OSM relation is NOT drawn
// (it would flood the mask); only the tower and a short stub on the
// synthesized rectangle are modelled.
import { corniceProfile, MAT } from '../kit.js';
import { win } from '../parts.js';
import { bbox } from '../geom.js';

const G = 'granite';
const T = 'graniteWarm';
const L = 'graniteLight';
const D = 'graniteDark';

// A run of pointed merlons along x between x0 and x1 at base height y.
function merlonsX(k, x0, x1, z, y, h, t, color, mw = 1.05, gap = 0.72) {
  const pitch = mw + gap;
  const n = Math.max(1, Math.round((x1 - x0 - gap) / pitch));
  const span = n * pitch - gap;
  const start = (x0 + x1) / 2 - span / 2;
  for (let i = 0; i < n; i++) {
    const x = start + i * pitch + mw / 2;
    k.box(mw, h, t, color, x, y, z, { jit: 0.05 });
    k.frustum(mw * 1.02, t * 1.02, mw * 0.5, t * 0.5, h * 0.34, color, x, y + h, z);
  }
}

// Points the same way round a rectangular top (four runs).
function merlonsRect(k, cx, cz, w, d, y, h, t, color) {
  merlonsX(k, cx - w / 2, cx + w / 2, cz + d / 2 - t / 2, y, h, t, color);
  merlonsX(k, cx - w / 2, cx + w / 2, cz - d / 2 + t / 2, y, h, t, color);
  for (const sz of [-1, 1]) {
    const z0 = cz + sz * (d / 2 - t / 2);
    const nn = Math.max(1, Math.round((w - 2 * t) / 1.77));
    const pitch = (w - 2 * t) / nn;
    for (let i = 0; i < nn; i++) {
      const x = cx - (w - 2 * t) / 2 + (i + 0.5) * pitch;
      k.box(t, h, pitch * 0.6, color, x, y, z0, { jit: 0.05 });
      k.frustum(t * 1.02, pitch * 0.6, t * 0.5, pitch * 0.3, h * 0.34, color, x, y + h, z0);
    }
  }
}

// Long-and-short corner stones of a rectangular body.
function quoins(k, cx, cz, hw, hd, h, y0 = 0.5, step = 0.8, color = G) {
  for (let c = 0; y0 + c * step < h - 0.5; c++) {
    const y = y0 + c * step;
    const lng = c % 2 ? 1.05 : 0.62;
    const sht = c % 2 ? 0.62 : 1.05;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      k.box(lng, 0.72, sht, color, cx + sx * (hw - lng / 2 + 0.03), y, cz + sz * (hd - sht / 2 + 0.03), { jit: 0.05 });
    }
  }
}

// Three lines of raised white lettering on a face at z (facing +z).
function inscription(k, cx, y, z) {
  const words = [4, 6, 8];
  k.box(6.6, 3.9, 0.08, D, cx, y - 0.5, z - 0.02, { mat: MAT.ashlar });
  const pitch = 0.62;
  words.forEach((n, row) => {
    const rowW = (n - 1) * pitch + 0.46;
    for (let i = 0; i < n; i++) {
      const x = cx - rowW / 2 + 0.23 + i * pitch;
      const yy = y + (2 - row) * 1.28;
      k.box(0.46, 0.82, 0.16, 'white', x, yy, z + 0.08, { mat: MAT.smooth });
      // a short leg to give each block a letter-like silhouette
      if (i % 2 === 0) k.box(0.46, 0.3, 0.16, 'white', x, yy - 0.55, z + 0.08, { mat: MAT.smooth });
    }
  });
}

// Coursed ashlar blocks standing a little proud of a wall face at z.
// o.skip: { x0, x1, y0, y1 } rectangle left clear (an inscription).
function ashlar(k, x0, x1, y0, y1, z, pw, ph, color, o = {}) {
  const cols = Math.max(1, Math.round((x1 - x0) / pw));
  const bw = (x1 - x0) / cols;
  const s = o.skip;
  for (let r = 0; y0 + r * ph < y1; r++) {
    const yy = y0 + r * ph + ph / 2;
    const off = r % 2 ? bw / 2 : 0;
    for (let c = -1; c <= cols; c++) {
      const x = x0 + off + c * bw + bw / 2;
      if (x < x0 + 0.05 || x > x1 - 0.05) continue;
      if (s && x > s.x0 && x < s.x1 && yy > s.y0 && yy < s.y1) continue;
      k.box(bw - 0.07, ph - 0.07, 0.1, color, x, yy, z + o.dir * 0.03, { jit: 0.06 });
    }
  }
}

function muralha(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const towerH = H.tower ?? 15;
  const wallH = H.wall ?? 8;
  const b = bbox(footprint.outline);
  const x0 = b.x0; // -9.98
  const x1 = b.x1; // 9.98
  const z0 = b.z0;
  const z1 = b.z1;
  const tT = 0.85;
  const towerW = 8.5;
  const towerD = b.d; // 7.92
  const tcx = x0 + towerW / 2; // tower at the west end
  const tcz = (z0 + z1) / 2;
  const wallZ = tcz;
  const wallT = 2.7;
  const wallTop = wallH - 1.5; // body, merlons above

  k.begin('main');
  // battered plinth along the whole rectangle
  k.prism(footprint.outline, -0.8, 1.0, D);
  // tower body: battered granite shaft with a battered footing
  k.frustum(towerW, towerD, towerW - 0.5, towerD - 0.5, towerH - 1.5, G, tcx, 0.2, tcz, { noBottom: true });
  k.box(towerW + 0.3, 0.5, towerD + 0.3, T, tcx, 0, tcz);
  // a string course at mid height and a corbel table under the crown
  k.box(towerW + 0.24, 0.26, towerD + 0.24, L, tcx, 7.6, tcz);
  for (let i = 0; i < 9; i++) {
    const u = -towerW / 2 + 0.7 + i * ((towerW - 1.4) / 8);
    for (const sz of [-1, 1]) k.box(0.42, 0.42, 0.4, T, tcx + u, towerH - 3.0, tcz + sz * (towerD / 2 + 0.02), { jit: 0.05 });
    const v = -towerD / 2 + 0.7 + i * ((towerD - 1.4) / 8);
    for (const sx of [-1, 1]) k.box(0.4, 0.42, 0.42, T, tcx + sx * (towerW / 2 + 0.02), towerH - 3.0, tcz + v, { jit: 0.05 });
  }
  // tower battlements to the real 15 m
  k.box(towerW - 0.5, 0.2, towerD - 0.5, D, tcx, towerH - 1.7, tcz); // walk
  merlonsRect(k, tcx, tcz, towerW - 0.5, towerD - 0.5, towerH - 1.5, 1.6, tT, G);

  // ---- curtain wall stub running east from the tower
  k.box(x1 - (x0 + towerW) + 0.4, wallTop + 0.8, wallT, G, (x0 + towerW + x1) / 2, 0, wallZ, { jit: 0.02 });
  k.box(x1 - (x0 + towerW), 0.2, wallT + 0.3, T, (x0 + towerW + x1) / 2, wallTop - 0.4, wallZ);
  merlonsX(k, x0 + towerW - 0.2, x1, wallZ, wallTop, 1.5, wallT * 0.9, G);
  // walk surface and a couple of wall buttresses
  k.box(x1 - (x0 + towerW), 0.16, wallT - 0.5, D, (x0 + towerW + x1) / 2, wallTop - 0.35, wallZ);
  for (const bx of [x0 + towerW + 3.2, x1 - 2.2]) {
    k.box(1.1, wallTop * 0.8, 0.5, L, bx, 0, wallZ + wallT / 2, { jit: 0.04 });
    k.box(1.1, wallTop * 0.8, 0.5, L, bx, 0, wallZ - wallT / 2, { jit: 0.04 });
  }

  // ---- tower face: round-arched door, arrow slits, the inscription
  win(k, tcx, 0.1, 1.15, 2.0, z1, { arch: 'round', bw: 0.26, depth: 0.3, pane: 'dark', trim: T });
  for (const y of [4.2, 6.4]) {
    k.box(0.24, 1.3, 0.2, 'dark', tcx - 2.6, y, z1 - 0.04, { mat: MAT.flat });
    k.box(0.24, 1.3, 0.2, 'dark', tcx + 2.6, y, z1 - 0.04, { mat: MAT.flat });
  }
  // the letters, low on the front, as in the photo
  inscription(k, tcx, 4.7, z1);
  // corner quoins on the tower
  quoins(k, tcx, tcz, towerW / 2 - 0.15, towerD / 2 - 0.1, towerH - 2.6, 0.6, 0.78);
  // coursed ashlar on the tower and wall faces (skip the inscription patch)
  ashlar(k, x0 + 0.2, x0 + towerW - 0.2, 1.1, towerH - 2.8, z1 + 0.02, 0.95, 1.0, G, { dir: 1, skip: { x0: tcx - 3.4, x1: tcx + 3.4, y0: 3.6, y1: 7.4 } });
  ashlar(k, x0 + 0.2, x0 + towerW - 0.2, 1.1, towerH - 2.8, z0 - 0.02, 0.95, 1.0, G, { dir: -1 });
  ashlar(k, x0 + towerW, x1 - 0.2, 1.1, wallTop - 0.6, wallZ + wallT / 2 + 0.02, 0.95, 1.0, G, { dir: 1 });
  ashlar(k, x0 + towerW, x1 - 0.2, 1.1, wallTop - 0.6, wallZ - wallT / 2 - 0.02, 0.95, 1.0, G, { dir: -1 });

  // height group reaches the tower top
  k.begin('height');
  k.box(0.3, 0.3, 0.3, 'dark', tcx, towerH - 0.3, tcz);
  k.end('height');
  k.end('main');
  void corniceProfile;
}

muralha.metric = true;
muralha.rule = {
  view: 0.35,
  note: 'Torre da Alfândega + short wall stub only, on the synthesized 20 x 8 m rectangle; the 270 m OSM wall line is left to the city wall layer so the mask stays on the tower. Inscription on the +z (Toural) face; tower 15 m, wall 8 m (dims estimates).',
};

export default { muralha };
