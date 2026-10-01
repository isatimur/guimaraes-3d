// Generic metric massing builder for Guimarães (first launch).
// Extrudes the real OSM outline and parts to their real heights, so every
// landmark stands at true size, orientation and height until its detailed
// builder (see PLAN.md, round 3) replaces it. One builder serves all 18 ids.
// Plan points are [x, z] in the landmark frame, +z the front (fit.js).
import { bbox } from '../geom.js';

const WALL_TAGS = new Set(['building', 'church', 'tower', 'monument', 'stand', 'wall', 'on']);
const FLAT = { water: 'water', pitch: 'grass', garden: 'grass', park: 'grass', ruins: 'graniteDark', square: 'sand' };

function colourFor(id, tag) {
  if (id === 'estadio-afonso-henriques') return tag === 'stand' ? 'graniteGrey' : 'steel';
  if (tag === 'wall') return 'graniteDark';
  if (tag === 'tower' || tag === 'monument') return 'graniteLight';
  if (tag === 'church') return 'graniteWarm';
  return 'granite';
}

function closed(pts) {
  return Array.isArray(pts) && pts.length >= 3 && pts.every((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

function makeBlock(id) {
  function block(k, { footprint, dims }) {
    const H = dims?.height_m?.total ?? 12;
    const roofH = Math.min(H, 12);
    k.begin('main');
    // main body: the real outline at the real total height
    // the castle outline is the curtain-wall ring: wall height, the keep is a part
    const bodyH = id === 'castelo' ? Math.min(H, 12) : H;
    if (closed(footprint.outline)) k.prism(footprint.outline, 0, bodyH, colourFor(id, 'building'));
    // parts: walls, towers and stands extruded; water, pitches, gardens as slabs
    for (const p of footprint.parts || []) {
      if (!closed(p.pts)) continue;
      const tag = p.tag || 'building';
      if (FLAT[tag]) {
        k.prism(p.pts, 0, tag === 'water' ? 0.12 : 0.18, FLAT[tag]);
      } else if (WALL_TAGS.has(tag)) {
        const h = Math.max(1, Math.min(p.height_m ?? roofH, H));
        k.prism(p.pts, 0, h, colourFor(id, tag));
      }
    }
    k.end('main');
    // the tallest element carries the height guard in fit.js
    k.begin('height');
    const b = bbox(footprint.outline);
    k.box(0.4, 0.4, 0.4, 'dark', b.cx, H - 0.4, b.cz);
    k.end('height');
  }
  block.metric = true;
  block.rule = { note: 'generic massing from OSM outline and parts; replaced by a detailed builder' };
  return block;
}

export function blockBuilders(ids) {
  return Object.fromEntries(ids.map((id) => [id, makeBlock(id)]));
}
