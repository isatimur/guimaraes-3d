// Centro Cultural Vila Flor, metric builder (1:1 metres).
//
// Frame (fit.js): +z = the north front on Avenida D. Afonso Henriques
// (6.6 deg), origin at the centre of the OSM palace outline (w130533853,
// 66.5 x 18.1 m). The 18th-c. palace is the long block on its outline; the
// 2005 Grande Auditório (w130533849) and Pequeno Auditório (w130533855) lie
// below the terrace to the south-west (local -x / -z), the garden
// (w339820300) descends to the south (-z), with the water feature between
// the auditoria and the palace.
// From data/dimensions.json: palace 2 storeys, 15 m with the parapet
// statues, Grande Auditório 15 m, Pequeno Auditório 9 m; 800 and 200 seats.
// From the photos: granite palace with stone window surrounds, a central
// pedimented portal and a parapet of statues; the auditoria are crisp
// rendered/concrete volumes with glazed foyers and flat roofs.
import * as THREE from 'three';
import { corniceProfile, MAT } from '../kit.js';
import { win, pediment, cartouche, ribbonWindows } from '../parts.js';
import { bbox, offset } from '../geom.js';
import { polyCornice, polyWindows } from '../metric.js';
import { lowTree, drapePoly } from '../drape.js';

const G = 'granite';
const GL = 'graniteLight';
const GD = 'graniteDark';

// A crisp modern volume on its OSM part: rendered wall, glazed foyer bands,
// ribbon windows, a flat roof and a raised stage/fly block.
function modern(k, pts, h, o = {}) {
  const wall = o.wall ?? 'white';
  const y0 = o.y ?? -2;
  k.prism(pts, y0, h - y0, wall);
  k.prism(offset(pts, 0.12), y0, 1.0, o.trim ?? GD);
  k.prism(offset(pts, 0.3), h, 0.5, o.roof ?? 'lead');
  ribbonWindows(k, pts, 2.2, {
    storeys: h > 12 ? 2 : 1,
    storey: h > 12 ? 5.4 : 0,
    h: 2.4,
    margin: 3,
    out: 0.06,
    trim: GD,
    pane: 'glass',
    emit: 0.12,
    minLen: 10,
  });
  return k;
}

function vilaFlor(k, { footprint, dims }) {
  const H = dims?.height_m ?? {};
  const hPal = H.palace ?? 15;
  const hGrand = H.grande_auditorio ?? 15;
  const hPetit = H.pequeno_auditorio ?? 9;
  const O = footprint.outline;
  const ob = bbox(O);
  const eave = hPal - 2.2;

  k.begin('mask');
  // ---------------------------------------------------------- the palace
  k.begin('main');
  k.prism(O, -2, eave + 2, G);
  k.prism(offset(O, 0.18), -2, 2.0, GD);
  polyCornice(k, O, 4.6, corniceProfile('band', 0.3), GL, { minLen: 2 });
  polyCornice(k, O, eave - 0.55, corniceProfile('classic', 0.9), GL, { minLen: 2 });
  polyWindows(k, O, {
    only: (e) => e.nz > 0.5 || e.nz < -0.5,
    storeys: [1.5, 6.4],
    bay: 3.6,
    w: 1.35,
    h: 2.5,
    storey: (s) => (s === 1 ? { h: 2.9, head: 'seg', sill: true } : { sill: true, bars: true }),
    win: { trim: GL, pane: 'glass', bw: 0.3, depth: 0.32, emit: 0.1 },
  });
  // central portal with a pediment and the arms
  k.push({ x: 0, z: ob.z1, ry: 0 });
  k.box(5.0, eave, 0.5, GL, 0, 0, 0.2);
  win(k, 0, 0.2, 2.6, 4.4, 0, { arch: 'round', bw: 0.45, depth: 0.45, trim: GL, pane: 'wood', sill: false });
  for (const s of [-1, 1]) k.box(0.7, eave, 0.5, GL, s * 3.4, 0, 0.25);
  pediment(k, 5.6, 1.5, 0.5, GL, 0, 5.4, 0.3, { frame: 0.28 });
  cartouche(k, 1.5, 1.7, 0.3, GL, 0, 7.3, 0.5);
  k.pop();
  // hipped tile roof and the parapet of statues along both long fronts
  k.hipRoof(ob.w - 0.6, ob.d - 1.0, 2.4, 'terracotta', 0, eave, 0, { over: 0.7, mat: MAT.tile });
  for (let i = 0; i <= 8; i++) {
    const x = -ob.w / 2 + (ob.w * i) / 8;
    k.statue(1.1, GL, x, eave + 0.2, ob.z1 - 0.25, { seg: 4 });
    k.statue(1.1, GL, x, eave + 0.2, ob.z0 + 0.25, { seg: 4, ry: Math.PI });
  }
  k.end('main');
  k.end('mask');

  // --------------------------------------------- Grande / Pequeno Auditório
  const grand = footprint.part(/Grande/);
  const petit = footprint.part(/Pequeno/);
  if (grand) {
    const b = bbox(grand.pts);
    modern(k, grand.pts, hGrand, { wall: 'white', trim: GD, roof: 'lead' });
    // tall glazed foyer facing the palace, on the NE end
    k.add(new THREE.PlaneGeometry(b.w - 6, hGrand - 5), 'glass', { x: b.cx, y: 2.4 + (hGrand - 5) / 2, z: b.z1 + 0.08, emit: 0.15, mat: MAT.flat });
    for (let i = 0; i <= 5; i++) k.box(0.16, hGrand - 4, 0.22, 'steel', b.x0 + 3 + ((b.w - 6) * i) / 5, -1.8, b.z1 + 0.12, { mat: MAT.metal });
    k.box(b.w - 5, 0.6, 1.0, 'white', b.cx, hGrand - 2.2, b.z1 + 0.3);
    // steel fly tower over the stage (reaches the 15 m ridge)
    k.box(b.w * 0.55, hGrand, b.d * 0.45, 'steel', b.cx, -1, b.cz, { mat: MAT.metal });
    k.box(b.w * 0.55 + 0.5, 0.4, b.d * 0.45 + 0.5, GD, b.cx, hGrand, b.cz);
  }
  if (petit) {
    modern(k, petit.pts, hPetit, { wall: 'cream', trim: GD, roof: 'lead' });
  }

  // ------------------------------------------------------------ the pond
  const water = footprint.partsOf('water')[0];
  if (water) {
    const wb = bbox(water.pts);
    k.prism(water.pts, -0.4, 0.55, GL, { holes: [offset(water.pts, -0.6)] });
    k.prism(offset(water.pts, -0.6), 0.02, 0.12, 'water', { emit: 0.25 });
    k.marker('fountain', wb.cx, 0.2, wb.cz, { kind: 'basin', r: 4 });
  }

  // ------------------------------------------------------------ the garden
  const garden = footprint.part(/Jardim/);
  if (garden) {
    const ground = footprint.ground;
    drapePoly(k, garden.pts, ground, 0.14, 'grass', { cell: 9, mat: MAT.leaf });
    const gb = bbox(garden.pts);
    // gravel terrace walk along the palace side, parterre hedges and trees
    const walkX = gb.x0 + 8;
    k.box(4, 0.2, 90, 'graniteLight', walkX, ground(walkX, gb.z0 + 40) + 0.12, gb.z0 + 40, { mat: MAT.smooth });
    for (let n = 0; n * 16 < gb.z1 - gb.z0 - 14; n++) {
      const z = gb.z0 + 12 + n * 16;
      const x0 = gb.x0 + 14 + (n % 3) * 5;
      const y = ground(x0, z) + 0.2;
      k.box(9, 0.8, 3, 'hedge', x0, y, z);
      for (let i = 0; i < 3; i++) {
        const tx = gb.x0 + 20 + i * 12 + (n % 2) * 6;
        const tz = z + 6;
        lowTree(k, tx, ground(tx, tz) + 0.2, tz, 8 + (i % 3), { spread: 0.42, lobes: 1 });
      }
    }
  }
}

vilaFlor.metric = true;
vilaFlor.rule = {
  extent: [/^(building|garden|water)$/],
  view: 0.5,
  note: 'palace on its outline (main, 15 m with parapet statues); the 2005 auditoria on their OSM parts; the garden draped on its OSM part; mask = palace only so it does not overlap neighbours',
};

export default { 'vila-flor': vilaFlor };
