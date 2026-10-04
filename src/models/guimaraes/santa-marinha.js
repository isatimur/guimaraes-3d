// Mosteiro de Santa Marinha da Costa (pousada), metric builder (1:1 metres).
//
// data/dimensions.json: the OSM outline (way 230976313) is the monastery /
// pousada block, 113.1 x 65.5 m north-south; the Igreja de Santa Marinha
// (way 257159145, 774 m2) adjoins it on the south-west. Local frame: +z =
// west, the front of the church and the entrance court; the long north wing
// runs along the east side. The outline is already the C-shaped range plan
// round a cloister court (no holes needed): walls on it, tiled slopes to a
// flat tiled core, punched windows in two monastic storeys. The church is
// drawn on its own part with the twin baroque bell towers (22 m) and the
// carved frontispiece; a formal parterre and clipped hedges fill the court.
import * as THREE from 'three';
import { win, punchedWindows, bellTower, pediment, cartouche, scrollCrest } from '../parts.js';
import { bbox, offset, clean, centroid, rect } from '../geom.js';

const G = 'granite';
const D = 'graniteDark';
const L = 'graniteLight';
const W = 'plaster';
const TILE = 'terracotta';

// Sloped roof ring between two same-length polygons (tibaes' ringRoof).
function ringRoof(k, lo, hi, y0, y1, color) {
  const tri = [];
  const n = lo.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = [lo[i][0], y0, lo[i][1]];
    const b = [lo[j][0], y0, lo[j][1]];
    const c = [hi[j][0], y1, hi[j][1]];
    const d = [hi[i][0], y1, hi[i][1]];
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny >= 0) tri.push(a, b, c, a, c, d);
    else tri.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri.flat()), 3));
  k.add(g, color, { flat: true, mat: 2 });
}

// A Siza-Vieira pousada volume across the monastery court: a low white
// rendered bar with a deep shadowed loggia, full-height glazing on slender
// columns and a thin flat roof with a dark fascia. w along x, d along z.
function pousadaWing(k, cx, cz, w, d, h, ry = 0) {
  const poly = rect(0, 0, w, d);
  k.push({ x: cx, z: cz, ry });
  k.prism(poly, -0.6, h + 0.6, 'white', { mat: 3 });
  k.prism(offset(poly, 0.1), -0.6, 0.6, 'graniteLight', { mat: 1 });
  // recessed loggia on the court face (+z): dark reveal behind a colonnade
  k.box(w - 1.4, h - 1.4, 1.0, 'dark', 0, 0.45, d / 2 - 0.5, { mat: 0 });
  const bays = Math.max(2, Math.floor(w / 2.6));
  for (let i = 0; i < bays; i++) {
    const u = -w / 2 + ((i + 0.5) * w) / bays;
    k.box((w / bays) * 0.78, h - 1.9, 0.08, 'glass', u, h * 0.42, d / 2 - 0.05, { emit: 0.16, mat: 0 });
    k.box(0.16, h - 1.3, 0.22, 'white', -w / 2 + (i * w) / bays, h * 0.5, d / 2 + 0.06);
  }
  k.box(0.16, h - 1.3, 0.22, 'white', w / 2, h * 0.5, d / 2 + 0.06);
  // thin flat roof plate and its fascia
  k.prism(offset(poly, 0.65), h, 0.35, 'white', { mat: 3 });
  k.box(w + 1.5, 0.3, 0.5, 'dark', 0, h + 0.35, d / 2 + 0.75, { mat: 0 });
  k.box(0.4, 0.3, d + 1.5, 'dark', w / 2 + 0.75, h + 0.35, 0, { mat: 0 });
  k.pop();
}

function santaMarinha(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const hChurch = H.church_tower ?? 22;
  const hBlock = H.monastery ?? 12;
  const ol = clean(footprint.outline, 0.4);
  const b = bbox(ol); // 112.7 x 66.4
  const ch = footprint.part(/Igreja/);
  const cb = ch ? bbox(ch.pts) : { x0: -74, x1: -56, z0: -39, z1: 10, cx: -65, cz: -14, w: 18, d: 49 };
  const eaves = hBlock - 3.4; // 8.6
  const rise = 3.4; // ridge -> 12 m

  // ------------------------------------------------------------ monastery
  k.begin('main');
  k.prism(offset(ol, 0.2), -1.0, 1.6, G); // plinth
  k.prism(ol, -1.0, eaves + 1.0, W, { mat: 3 });
  // granite quoin corners
  for (const p of ol) k.box(0.7, eaves, 0.7, G, p[0] * 0.995, 0, p[1] * 0.995);
  // projecting eave band, then tiled slopes to a flat tiled core
  k.prism(offset(ol, 0.45), eaves, 0.5, G);
  ringRoof(k, offset(ol, 0.85), offset(ol, -3.0), eaves + 0.5, eaves + 0.5 + rise, TILE);
  k.prism(offset(ol, -3.0), eaves + 0.5 + rise - 0.1, 0.5, TILE, { mat: 2 });
  // two storeys of windows on every wall (courtyards included)
  k.end('main');
  punchedWindows(k, ol, 0, {
    storeys: 2, storey: 3.6, first: 1.2, w: 1.1, h: 1.8, bay: 4.6, margin: 1.5, minLen: 5,
    trim: G, pane: 'glass', emit: 0.12, out: 0.06,
  });

  // ------------------------------------------------------------ church
  k.begin('height');
  k.prism(cb_rect(ch), -1.0, 11.0, G); // granite church body (walls)
  k.prism(offset(ch ? clean(ch.pts, 0.3) : cb_rect(ch), -0.15), 10.4, 0.4, D);
  {
    const cpts = ch ? clean(ch.pts, 0.3) : cb_rect(ch);
    const cbc = bbox(cpts);
    k.gableRoof(cbc.w - 0.4, cbc.d - 0.6, 3.0, TILE, cbc.cx, 10.8, cbc.cz, { over: 0.6 });
  }
  // twin baroque bell towers on the west front (+z), to 22 m
  const fz = cb.z1 - 1.0;
  for (const tx of [cb.x0 + 3.6, cb.x1 - 3.6]) {
    bellTower(k, {
      x: tx, z: fz - 1.5, w: 3.6,
      hBody: 13, hBelfry: 4.0, body: W, trim: G,
      cap: 'onion', capH: 2.2, urns: 'pinnacle',
      windows: 1, sideWindows: false, openings: 1,
      balustrade: false, lantern: false, cross: false, clock: true,
    });
  }
  // carved granite frontispiece between the towers: portal, niches, statues
  const fx = (cb.x0 + cb.x1) / 2;
  k.push({ x: fx, z: fz });
  k.wall(cb.w - 8.0, 16.2, 0.9, G, [
    { x: 0, y: 0, w: 2.6, h: 4.6, arch: 'round', pane: 'dark' },
    { x: -2.3, y: 7.0, w: 1.0, h: 1.7, pane: 'glass' },
    { x: 2.3, y: 7.0, w: 1.0, h: 1.7, pane: 'glass' },
    { x: 0, y: 9.2, w: 1.1, h: 2.0, arch: 'round', pane: 'glass' },
  ], 0, 0, 0, { inset: 0.7 });
  for (const hh of [
    { x: 0, y: 0, w: 2.6, h: 4.6, arch: 'round' },
    { x: -2.3, y: 7.0, w: 1.0, h: 1.7 },
    { x: 2.3, y: 7.0, w: 1.0, h: 1.7 },
    { x: 0, y: 9.2, w: 1.1, h: 2.0, arch: 'round' },
  ]) k.surround(hh, 0.22, 0.22, D, 0.5);
  for (const sx of [-1, 1]) {
    k.wall(1.6, 2.6, 0.4, G, [{ x: 0, y: 0.3, w: 0.9, h: 1.8, arch: 'round', pane: 'dark' }], sx * 3.6, 7.0, 0.3);
    k.statue(1.5, L, sx * 3.6, 7.3, 0.5, { seg: 5 });
  }
  k.box(cb.w - 7.0, 0.6, 1.0, D, 0, 11.8, 0.2);
  pediment(k, cb.w - 7.4, 3.0, 0.9, G, 0, 12.4, 0.1, { tympanum: W, frame: 0.4 });
  cartouche(k, 1.5, 1.7, 0.3, D, 0, 14.0, 0.5, { inlay: 'gold' });
  scrollCrest(k, 3.4, 1.8, 0.4, G, 0, 15.4, 0.15);
  k.box(0.16, 1.6, 0.16, 'iron', 0, 17.0, 0.1);
  k.box(0.9, 0.14, 0.14, 'iron', 0, 17.9, 0.1);
  k.pop();
  // granite stair and its balustraded terrace in front of the church
  k.box(cb.w + 4, 2.4, 6.0, 'graniteLight', fx, -1.0, fz + 3.4, { mat: 8 });
  k.box(cb.w + 4.6, 0.4, 6.4, D, fx, 1.4, fz + 3.4);
  k.stairs(cb.w - 2, 2.4, 1.0, 5, 'graniteLight', fx, -1.0, fz + 7.6, { below: 0.5 });
  for (const sx of [-1, 1]) {
    k.box(0.7, 1.6, 0.7, D, fx + sx * (cb.w / 2 + 1.8), 1.4, fz + 6.2);
    k.urn(1.2, D, fx + sx * (cb.w / 2 + 1.8), 3.0, fz + 6.2, { seg: 5 });
  }
  k.end('height');

  // -------------------------------------------------- the pousada volumes
  // Siza-Vieira's low white wing and its glazed linking pavilion, set into
  // the court between the monastery range and the church terrace
  pousadaWing(k, -30, 6, 32, 5, 5.5);
  pousadaWing(k, -49, 6, 7, 6, 5.0, Math.PI / 2);
  // pool terrace with a granite kerb on the garden's south-west side
  k.prism(rect(-18, 20, 13, 7), 0.08, 0.3, 'graniteLight', { mat: 8, holes: [rect(-18, 20, 10, 4)] });
  k.prism(rect(-18, 20, 10, 4), 0.1, 0.3, 'water', { emit: 0.28 });
  for (let i = 0; i < 4; i++) k.box(0.5, 0.35, 1.4, 'white', -22 + i * 2.4, 0.12, 24.2, { mat: 0 });
  // a slender pergola over the loungers
  for (let i = -3; i <= 3; i++) k.box(0.14, 2.6, 0.14, 'white', -18 + i * 2.2, 0.1, 25.6);
  k.box(14.5, 0.12, 0.12, 'white', -18, 2.7, 25.6);

  // ------------------------------------------------------------ garden
  // formal parterre in the court west of the monastery, clipped hedges and
  // gravel walks; trees in the wider garden (within the model extent)
  const gf = rect(-30, 16, 40, 24);
  k.prism(gf, -0.05, 0.1, 'grass', { mat: 5 });
  k.prism(offset(gf, -1.2), -0.02, 0.12, 'graniteGrey', { mat: 8, holes: [offset(gf, -2.2)] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.prism(rect(-30 + sx * 9, 16 + sz * 6, 8, 5), 0.1, 0.9, 'hedge', { mat: 5 });
  }
  k.prism(rect(-30, 16, 26, 1.4), 0.1, 0.3, 'sand');
  k.prism(rect(-30, 16, 1.4, 16), 0.1, 0.3, 'sand');
  // clipped box parterre and a small water basin in the parterre centre
  k.prism(rect(-30, 16, 6, 4), 0.1, 0.7, 'hedge', { mat: 5, holes: [rect(-30, 16, 3, 1.6)] });
  k.prism(rect(-30, 16, 3.4, 1.9), 0.1, 0.35, 'graniteLight', { holes: [rect(-30, 16, 2.8, 1.3)] });
  k.prism(rect(-30, 16, 2.6, 1.1), 0.36, 0.05, 'water', { emit: 0.3 });
  for (const [x, z] of [[-52, 24], [-46, 28], [10, 22], [20, 26], [30, 20], [-30, -22], [-18, -25]]) {
    k.tree(x, 0, z, 6.5, { kind: 'round', spread: 0.24 });
  }
  for (const [x, z] of [[-58, 18], [-58, 6], [46, 4], [46, -12]]) k.tree(x, 0, z, 4.5, { kind: 'topiary' });
}

// The church block as a rectangle if the OSM part is missing.
function cb_rect(ch) {
  if (ch) return clean(ch.pts, 0.3);
  return [[-74, -39], [-56, -39], [-56, 10], [-74, 10]];
}

santaMarinha.metric = true;
santaMarinha.rule = {
  extent: [/Igreja/],
  view: -0.7,
  note: 'monastery on its OSM outline (a C-shaped range plan), church on its OSM part with the twin bell towers to 22 m; garden on the west court',
};

export default { 'santa-marinha': santaMarinha };
