// Praça de São Tiago, metric builder (1:1 metres).
//
// Frame (fit.js): +z = 127 deg, from the square centre toward the Largo da
// Oliveira and the church (dimensions.json). The OSM outline (w32501267,
// 80.7 x 42.0 m) is the paved trapezium; the enclosure is the ring of 14
// three- and four-storey houses with arcades fronting the square (OSM
// building ways, all `building` parts), the Largo da Oliveira opening at
// the south-east corner.
// From data/dimensions.json: four-storey houses 12.8 m, three-storey 9.6 m,
// square 1579 m². From the photos: granite arcaded ground floors, plaster
// upper storeys, granite window surrounds with shutters and iron balconies,
// terracotta roofs; a small granite fountain against the west side.
import { corniceProfile, MAT, PROFILES } from '../kit.js';
import { punchedWindows } from '../parts.js';
import { bbox, offset, edges } from '../geom.js';
import { polyCornice } from '../metric.js';

const G = 'granite';
const GL = 'graniteLight';
const GD = 'graniteDark';
const PAVE = 'sand';

// The facade edge of a house part: the longest edge whose outward normal
// points toward the square (the direction from the part to the square
// centroid). Returns null when the part has no clear front.
function facadeEdge(pts, toSquare) {
  let best = null;
  for (const e of edges(pts)) {
    if (e.len < 4) continue;
    const d = e.nx * toSquare[0] + e.nz * toSquare[1];
    const score = d * Math.min(e.len, 20);
    if (!best || score > best.score) best = { e, score, d };
  }
  return best && best.d > 0.2 ? best.e : null;
}

// A cheap framed window: granite frame block, glass pane, splayed sill,
// optional open shutters and an iron balcony. About 40 triangles.
function shuttered(k, x, y, w, h, z, o = {}) {
  k.box(w + 0.5, h + 0.5, 0.16, o.trim ?? GL, x, y - 0.25, z + 0.04);
  k.box(w, h, 0.1, o.pane ?? 'glass', x, y, z + 0.1, { emit: o.emit ?? 0.08, mat: MAT.flat });
  k.box(w + 0.9, 0.16, 0.3, o.trim ?? GL, x, y - 0.34, z + 0.12);
  if (o.shutters !== false) for (const s of [-1, 1]) k.box(w * 0.42, h * 0.94, 0.08, 'wood', x + s * (w / 2 + w * 0.24), y + h * 0.03, z + 0.28);
  if (o.balcony) {
    k.box(w + 0.9, 0.14, 1.1, GL, x, y - 0.36, z + 0.6);
    k.box(w + 0.9, 0.05, 0.05, 'iron', x, y + 0.5, z + 1.1);
    for (let i = -2; i <= 2; i++) k.box(0.04, 0.85, 0.04, 'iron', x + (i * (w + 0.6)) / 4, y - 0.3, z + 1.1);
  }
}

function saoTiago(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const hTall = H.houses_four_storey ?? 12.8;
  const hLow = H.houses_three_storey ?? 9.6;
  const O = footprint.outline;
  const ob = bbox(O);
  const centre = [0, 0];
  const houses = footprint.partsOf('building');

  // -------------------------------------------------------- the paved square
  k.begin('mask');
  k.prism(O, -0.7, 0.75, PAVE, { mat: MAT.ashlar });
  k.prism(offset(O, 0.3), -0.7, 0.82, GD, { holes: [O] });
  k.end('mask');

  // ---------------------------------------------------- the enclosing houses
  for (const p of houses) {
    const b = bbox(p.pts);
    const a = b.w * b.d;
    const tall = a > 120 || Math.max(b.w, b.d) > 20;
    const total = tall ? hTall : hLow;
    const rise = total * 0.16;
    const eave = total - rise;
    const dir = [centre[0] - b.cx, centre[1] - b.cz];
    const dl = Math.hypot(dir[0], dir[1]) || 1;
    dir[0] /= dl;
    dir[1] /= dl;
    // walls: granite arcaded ground floor, plaster above
    k.prism(p.pts, -1.2, eave + 1.2, 'plaster');
    k.prism(offset(p.pts, 0.18), -1.2, 3.4, G);
    polyCornice(k, p.pts, eave - 0.5, corniceProfile('eave', 0.5), GL, { minLen: 2 });
    k.hipRoof(b.w - 0.4, b.d - 0.4, rise, 'terracotta', b.cx, eave, b.cz, { over: 0.6, mat: MAT.tile });
    const fe = facadeEdge(p.pts, dir);
    if (!fe) continue;
    k.push({ x: fe.mx, y: 0, z: fe.mz, ry: fe.ry });
    // arcade on the ground floor for the wider fronts (the houses with
    // arcades): round arches on granite piers, dark shop recesses behind
    if (fe.len >= 10) {
      const n = Math.max(2, Math.round(fe.len / 4.2));
      k.arcade(fe.len, 3.4, 0.5, n, (fe.len / n) * 0.68, 2.9, G, 0, 0, 0.14, { mat: MAT.ashlar });
      k.box(fe.len - 0.6, 2.9, 0.2, 'dark', 0, 0, -0.22);
      k.box(fe.len, 0.4, 0.7, GL, 0, 3.4, 0.16);
    } else {
      // a plain shop/portal door
      k.box(1.1, 2.9, 0.16, GL, 0, 0.1, 0.16);
      k.box(1.6, 2.6, 0.12, GL, 0, 0, 0.02);
      k.box(1.2, 2.4, 0.1, 'wood', 0, 0, 0.12);
    }
    // upper windows: storeys spaced to the eave, some with balconies
    const n = Math.max(1, Math.floor(fe.len / 3.6));
    const pitch = fe.len / n;
    const floors = tall ? 3 : 2;
    const y0 = 1.5;
    const gap = (eave - 2.2 - y0) / Math.max(1, floors - 1);
    for (let i = 0; i < n; i++) {
      const u = -((n - 1) * pitch) / 2 + i * pitch;
      for (let s = 0; s < floors; s++) {
        const y = y0 + s * gap;
        const bal = s === 1 && i % 2 === 0;
        shuttered(k, u, y, 1.15, 1.65, 0.14, { balcony: bal, emit: k.rnd() > 0.7 ? 0.22 : 0.08, shutters: !bal });
      }
    }
    k.pop();
    // the side and back walls get cheap punched windows, unlit
    punchedWindows(k, p.pts, 0, {
      storeys: tall ? 3 : 2,
      first: 3.9,
      storey: 3.2,
      w: 0.9,
      h: 1.4,
      bay: 4,
      margin: 1.6,
      trim: G,
      pane: 'glass',
      emit: 0.06,
      only: (e) => !(Math.abs(e.mx - fe.mx) < 0.6 && Math.abs(e.mz - fe.mz) < 0.6),
    });
  }

  // ------------------------------------------------------- the small fountain
  const w = footprint.partsOf('water')[0];
  if (w) {
    const [fx, fz] = w.pts[0];
    k.cyl(1.9, 2.05, 0.75, 8, GL, fx, -0.2, fz);
    k.cyl(1.65, 1.65, 0.12, 8, 'water', fx, 0.5, fz, { emit: 0.25 });
    k.cyl(0.32, 0.42, 1.5, 8, G, fx, 0.55, fz);
    k.lathe(PROFILES.basin, 10, GL, fx, 1.9, fz, { sr: 0.85, sh: 0.7, smooth: true });
    k.cyl(0.1, 0.16, 0.9, 6, 'water', fx, 2.5, fz, { emit: 0.5 });
    k.marker('fountain', fx, 0.5, fz, { kind: 'jet', r: 1.65, jet: 2.2 });
  }
}

saoTiago.metric = true;
saoTiago.rule = {
  extent: [/^building$/],
  view: 0.35,
  note: 'paved square on the OSM outline (main/mask); the 14 enclosing houses extruded on their OSM parts with arcaded granite ground floors and shuttered upper storeys; fountain on the OSM water point',
};

export default { 'sao-tiago': saoTiago };
