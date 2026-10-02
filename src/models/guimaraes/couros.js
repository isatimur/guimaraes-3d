// Zona de Couros, metric builder (1:1 metres).
//
// data/dimensions.json: OSM relation 19769884 is seven groups of granite
// tanning tanks (73-665 m2, 1619 m2 in all) along the Ribeira de Couros;
// the outline is their convex hull (140.9 x 81.2 m, matches_osm false) and
// the houses between them stay in buildings.json. The lavoir (way 820481034,
// 9 x 7 m) is a part. Height total 1.2 m: the tank rims stand about 1.2 m
// above the paving. Each OSM group is drawn as a grid of open rectangular
// granite vats with their water, plus the lavoir basin and the low stone
// channel of the stream. The zone is inscribed in the WH list (2023).
import { bbox, offset, clean, inside, rect } from '../geom.js';

const G = 'granite';
const D = 'graniteDark';
const L = 'graniteLight';

// A grid of open vats filling an OSM group polygon: granite rim, dark floor,
// standing water. The vats share walls, as the real tanning tanks do.
function vats(k, pts, rimH, cell = 3.6) {
  const poly = clean(pts, 0.5);
  if (poly.length < 3) return;
  const inner = offset(poly, -0.4);
  const b = bbox(poly);
  const w = cell * 0.9;
  for (let x = b.x0; x < b.x1 - cell * 0.5; x += cell) {
    for (let z = b.z0; z < b.z1 - cell * 0.5; z += cell) {
      const cx = x + cell / 2;
      const cz = z + cell / 2;
      if (!inside(inner, cx, cz)) continue;
      k.prism(rect(cx, cz, w, w), 0, rimH, G, { holes: [rect(cx, cz, w - 0.45, w - 0.45)] });
      k.prism(rect(cx, cz, w - 0.45, w - 0.45), 0.05, 0.16, D);
      k.prism(rect(cx, cz, w - 0.7, w - 0.7), rimH - 0.25, 0.06, 'water');
    }
  }
}

function couros(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const rimH = H.tank_rims ?? 1.2;
  const ol = footprint.outline; // convex hull of the tank zone

  k.begin('main');
  // --- cobbled ground on the hull, the streambed of the Ribeira de Couros
  k.prism(offset(ol, -0.2), -0.4, 0.35, 'graniteGrey', { mat: 8 });
  k.prism([[1, -70], [4, -70], [4, 70], [1, 70]], 0.0, 0.25, 'water', { mat: 7, emit: 0.2 });

  // --- the seven OSM tank groups as grids of open granite vats
  for (const p of footprint.partsOf('ruins')) vats(k, p.pts, rimH);

  // --- the lavoir: a rectangular basin with its washing ledge and water
  const lav = footprint.part(/Lavadouro/);
  if (lav) {
    const lb = bbox(lav.pts);
    k.prism(offset(clean(lav.pts, 0.4), 0.25), 0, H.lavoir ?? 1.0, L, { holes: [offset(clean(lav.pts, 0.4), -0.3)] });
    k.prism(lav.pts, 0.1, 0.2, D);
    k.prism(offset(clean(lav.pts, 0.4), -0.5), 0.7, 0.06, 'water');
    for (const sx of [-1, 1]) k.box(0.6, 0.5, lb.d * 0.35, D, lb.cx + sx * (lb.w / 2 - 0.2), 0.2, lb.cz);
  }

  // --- low granite retaining walls along the lanes between the tanks
  const walls = [
    [[-41, -12], [-14, -16]],
    [[16, -18], [40, -6]],
    [[-40, 24], [-10, 30]],
    [[12, 38], [40, 52]],
    [[-30, 44], [-6, 52]],
  ];
  for (const [a, b] of walls) k.wallLine(a, b, 0.85, 0.5, D, 0, { ext: 0.2 });
  // a couple of low tannery yard walls (roofless, houses stay in buildings.json)
  for (const pts of [[[-38, -58], [-18, -58], [-18, -44]], [[26, 46], [40, 46], [40, 62]]]) {
    for (let i = 0; i < pts.length; i++) k.wallLine(pts[i], pts[(i + 1) % pts.length], 1.1, 0.45, G, 0, { ext: 0.2 });
  }
  k.end('main');
}

couros.metric = true;
couros.rule = {
  view: 0.4,
  note: 'the seven OSM tank groups as grids of open granite vats; the lavoir and the low stone lane walls; houses between the tanks stay in buildings.json (height total 1.2 m)',
};

export default { couros };
