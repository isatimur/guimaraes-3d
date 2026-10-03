// Citânia de Briteiros, metric builder (1:1 metres).
//
// data/dimensions.json: the OSM outline (way 184819483) is the protected
// site (16.3 ha) on Monte de São Romão; parts are four rampart lines
// (barrier=city_wall), five small buildings (two reconstructed round houses
// and three at the entrance) and the chapel of São Romão. Local frame: +z =
// south, the visitors' entrance and the road side; the acropolis is the
// summit near the centre. The Iron-Age hill fort is drawn as the four
// mapped ramparts (stone city walls, 2 m and 4 m for the reconstructed
// stretch) on their real polylines, clusters of circular stone house ruins,
// the two reconstructed round houses with conical thatch, the council house
// and the chapel (6 m) with the Pedra Formosa. Ramparts 2-4 m, houses 4 m.
import * as THREE from 'three';
import { bbox, clean, offset, inside, centroid } from '../geom.js';

const G = 'granite';
const D = 'graniteDark';
const L = 'graniteLight';
const THATCH = 'earth';

// A ruined round house: a low open stone ring on a beaten floor.
function ruinHouse(k, x, z, r) {
  k.cyl(r, r, 0.85, 12, G, x, 0, z, { open: true, mat: 1 });
  k.cyl(r * 0.92, r * 0.92, 0.06, 12, 'earth', x, 0.02, z);
  k.box(0.9, 0.8, 0.25, D, x, 0.05, z + r);
}

// A reconstructed round house: stone drum with a conical thatch roof.
function thatchHouse(k, x, z, r) {
  k.cyl(r, r, 2.1, 12, G, x, 0, z, { mat: 1 });
  k.cyl(r + 0.12, r + 0.12, 0.2, 12, D, x, 2.1, z);
  k.cone(r * 1.2, 2.0, 12, THATCH, x, 2.25, z, { mat: 5 });
  k.box(0.95, 1.5, 0.25, 'dark', x, 0, z + r);
}

// A small rectangular house / plot ruin.
function rectHouse(k, x, z, w, d) {
  const h = 0.8;
  const p = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [x + a, z + b]);
  k.prism(p, 0, h, G, { holes: [p.map(([a, b]) => [x + (a - x) * 0.8, z + (b - z) * 0.8]).reverse()] });
  k.prism(p.map(([a, b]) => [x + (a - x) * 0.8, z + (b - z) * 0.8]), 0.02, 0.06, 'earth');
}

function briteiros(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const hChapel = H.chapel ?? 6;
  const O = clean(footprint.outline, 0.5);
  const ob = bbox(O);

  // --- the hilltop ground of the protected site (covers the outline)
  k.begin('main');
  k.prism(offset(O, -0.3), -0.5, 0.35, 'grass', { mat: 5 });
  for (let i = 0; i < O.length; i++) k.wallLine(O[i], O[(i + 1) % O.length], 0.4, 0.6, D, 0, { ext: 0.2 });
  k.end('main');

  // --- four rampart lines on their real polylines (stone city walls)
  const walls = footprint.partsOf('wall');
  walls.forEach((w, wi) => {
    const pts = clean(w.pts, 0.6);
    const h = wi === 0 ? 4.0 : 2.0; // the first mapped wall is the reconstructed stretch
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      k.wallLine(a, b, h, 2.5, i % 3 === 1 ? L : G, 0.05, { ext: 0.3 });
      // broken rubble on the coping
      if (i % 2 === 0) k.box(1.2, 0.4, 2.0, D, a[0], h, a[1], { jit: 0.15 });
    }
    // tumbled stones at the foot of the wall
    for (let i = 0; i < pts.length; i += 2) {
      const a = pts[i];
      k.box(0.8 + k.rnd() * 0.6, 0.5 + k.rnd() * 0.4, 0.8 + k.rnd() * 0.5, k.rnd() > 0.5 ? D : L, a[0] + (k.rnd() - 0.5) * 4, 0.1, a[1] + (k.rnd() - 0.5) * 4, { jit: 0.2, ry: k.rnd() * 3 });
    }
  });

  // --- the mapped buildings
  const bparts = footprint.partsOf('building');
  const round = [];
  const rects = [];
  for (const p of bparts) {
    const bb = bbox(p.pts);
    if (bb.w < 9 && bb.d < 9) round.push(p);
    else rects.push(p);
  }
  // the two reconstructed round houses (thatch)
  for (const p of round) {
    const c = centroid(p.pts);
    const bb = bbox(p.pts);
    thatchHouse(k, c[0], c[1], Math.min(bb.w, bb.d) / 2);
  }
  // the three entrance buildings
  for (const p of rects) {
    const bb = bbox(p.pts);
    rectHouse(k, bb.cx, bb.cz, bb.w, bb.d);
  }

  // --- the chapel of São Romão (height group, to 6 m)
  const ch = footprint.part('church');
  k.begin('height');
  if (ch) {
    const c = centroid(ch.pts);
    const bb = bbox(ch.pts);
    const w = Math.min(bb.w, 9);
    const d = Math.max(bb.d, 10);
    k.prism(ch.pts, 0, 3.6, G);
    k.prism(offset(clean(ch.pts, 0.4), 0.25), 3.4, 0.4, D);
    k.gableRoof(w, d - 0.6, 1.6, 'terracotta', c[0], 3.8, c[1], { over: 0.5 });
    k.box(1.6, 2.4, 0.3, 'dark', c[0], 0, c[1] + d / 2 - 0.1);
    // bell-gable on the facade wall, top exactly at hChapel
    k.box(1.8, 1.6, 1.6, G, c[0], 3.8, c[1] - d / 2 + 0.4);
    k.box(0.9, 1.1, 0.2, 'dark', c[0], 4.1, c[1] - d / 2 - 0.4);
    k.cone(1.4, hChapel - 5.4, 4, D, c[0], 5.4, c[1] - d / 2 + 0.4, { ry: Math.PI / 4 });
  }
  k.end('height');

  // --- the acropolis: clusters of circular house ruins (invented, OSM has
  // only the reconstructed pair) and the council house
  const place = [
    [-60, -40], [-30, -55], [5, -70], [40, -50], [70, -30],
    [-90, -10], [-55, 10], [-20, 5], [18, -12], [55, 15],
    [-70, 55], [-35, 60], [0, 48], [35, 62], [72, 50],
    [-20, 110], [25, 120], [60, 95], [-95, 90], [95, 85],
    [-60, 160], [10, 170], [65, 155], [-25, 200], [40, 205],
    [-105, -35], [88, 40], [-45, 130], [30, 155], [-8, 88],
    [52, 100], [-80, 120], [80, 140], [-100, 45], [15, -40],
  ];
  let n = 0;
  for (const [x, z] of place) {
    if (!inside(offset(O, -7), x, z)) continue;
    ruinHouse(k, x + (k.rnd() - 0.5) * 4, z + (k.rnd() - 0.5) * 4, 2.4 + k.rnd() * 0.7);
    n++;
  }
  // the council house (casa do conselho, ~11 m) on the summit
  {
    const c = [8, 52];
    k.cyl(5.5, 5.5, 1.4, 16, G, c[0], 0, c[1], { open: true, mat: 1 });
    k.box(1.4, 1.4, 0.4, D, c[0], 0, c[1] + 5.4, { ry: 0.3 });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      k.box(1.0, 1.2 + (i % 3) * 0.3, 0.6, L, c[0] + Math.cos(a) * 5.5, 0, c[1] + Math.sin(a) * 5.5, { ry: -a });
    }
  }
  // the Pedra Formosa: the carved bath monolith, on its low base
  k.box(3.0, 0.3, 2.0, D, 20, 0, 40);
  k.box(2.4, 1.5, 1.0, 'graniteWarm', 20, 0.3, 40, { mat: 8 });
  k.cyl(0.6, 0.6, 1.6, 8, 'graniteWarm', 20, 0.3, 40.8, { rx: Math.PI / 2, mat: 8 });
  k.box(0.15, 1.1, 0.15, D, 19.2, 0.4, 40.6);
  k.box(0.15, 1.1, 0.15, D, 20.8, 0.4, 40.6);
  void ob;
  void n;
}

briteiros.metric = true;
briteiros.rule = {
  extent: ['wall'],
  view: 0.6,
  frame: { x0: -170, x1: 170, z0: -180, z1: 210 },
  note: 'four mapped rampart lines drawn on their real polylines (the extent includes them), clusters of circular house ruins and the two reconstructed thatched houses, the council house, the chapel (6 m) and the Pedra Formosa; camera frames the acropolis',
};

export default { briteiros };
