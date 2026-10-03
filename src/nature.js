// Nature from OpenStreetMap (data/nature.json, fetched by
// scripts/fetch-nature.mjs): land cover painted into a mask texture the
// ground shader reads, instanced trees in the woods and parks, and water.
//
// Trees: every instance is a small clump (two or three crowns), so a few
// thousand instances read as woodland. Near the camera they are low-poly
// meshes that sway in the wind and cast shadows; farther out they switch to
// camera-facing billboards. The split is recomputed on the CPU when the
// camera moves, so the far set costs two triangles per clump.
//
// Trees never stand on a street, a building, a landmark or water: those
// are rasterised into an occupancy mask first and every candidate point is
// tested against it.
import * as THREE from 'three';
import { S } from './geo.js';
import { FOG_UNIFORMS, WEATHER_UNIFORMS, CLOUD_GLSL, SEASON_GLSL } from './scene.js';
import { createWater } from './water.js';
import { CITY } from './city.js';

// ------------------------------------------------------------ tuning
const LAND_PX = 0.5; // land-cover mask: pixels per world unit (8 m per pixel)
const NEAR = 360; // world units (1.4 km): nearer clumps are meshes, farther billboards
const REPART_MOVE = 18; // re-split after the camera moved this far
// relative tree density per square metre, by land-cover kind
const DENSITY = { forest: 1, scrub: 0.45, park: 0.8, garden: 0.4, orchard: 0.8, grass: 0.03, farmland: 0.008 };
// the wooded sanctuary hills get more of the budget: they are the views
// (cities/<id>.json nature.hills: Braga's Bom Jesus do Monte and Sameiro)
const HILLS = () => CITY.nature?.hills || [];
const HILL_BOOST = 6;

// species: 0 maritime pine, 1 eucalyptus, 2 broadleaf (oak, plane),
// 3 shrub, 4 a patch of closed woodland canopy (seven crowns)
const SPECIES = [
  { h: [14, 22], w: 0.55, tint: 0x334221, trunk: 0x5a4030 },
  { h: [20, 32], w: 0.7, tint: 0x4d5a3a, trunk: 0x8c806c },
  { h: [10, 18], w: 1.05, tint: 0x42592a, trunk: 0x54443a },
  { h: [2.5, 4.5], w: 1.7, tint: 0x4d5a2c, trunk: 0x4a3e30 },
  { h: [15, 24], w: 1.9, tint: 0x384d24, trunk: 0x4f3d30 },
];
// Seasons (src/seasons.js, WEATHER_UNIFORMS.seasonW), per species:
//   pal:   crown colours, sRGB: spring, summer, autumn A, autumn B, winter
//          (for the deciduous crowns: the bare twig mass);
//   pal:   share of crowns that follow the palette (the rest stay evergreen);
//   bare:  share of crowns that drop their leaves: in winter they shrink to
//          half size and turn twig-grey, so the trunks show;
//   bloom: share of trees that blossom in spring (lime and fruit trees in
//          the avenues, gardens and orchards).
// Eucalyptus and the maritime pine stay green all year.
const SEASON_CROWNS = [
  { pal: [0x3c4d25, 0x334221, 0x34411f, 0x34411f, 0x2d3721], share: 1, bare: 0, bloom: 0 },
  { pal: [0x56653f, 0x4d5a3a, 0x4d5a3a, 0x4b5839, 0x48533b], share: 1, bare: 0, bloom: 0 },
  { pal: [0x587e38, 0x3c5625, 0xa87530, 0x874626, 0x5e5249], share: 1, bare: 1, bloom: 0.6 },
  { pal: [0x607e33, 0x4a5829, 0x7e6a2e, 0x6a4a24, 0x524c36], share: 0.5, bare: 0.5, bloom: 0.4 },
  { pal: [0x52722c, 0x33491f, 0x86682e, 0x684824, 0x4f473b], share: 0.4, bare: 0.4, bloom: 0.12 },
];
const MIX = {
  forest: [0.14, 0.12, 0.04, 0.08, 0.62],
  scrub: [0.04, 0.04, 0.12, 0.8, 0],
  park: [0.18, 0.03, 0.55, 0.05, 0.19],
  garden: [0.15, 0, 0.7, 0.15, 0],
  orchard: [0, 0, 0.3, 0.7, 0],
  grass: [0.2, 0.1, 0.7, 0, 0],
  farmland: [0.1, 0.1, 0.8, 0, 0],
};
// On the upper Penha slopes the maritime pine takes over from the
// broadleaves; PINE_Y is the world height (0 at the city centre) where the
// switch starts. Rock outcrops sit higher still.
const PINE_Y = 38;
const ROCK_Y = 55;
const CELLS = SPECIES.length; // billboard atlas cells

function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function pickSpecies(mix, r) {
  let acc = 0;
  for (let i = 0; i < mix.length; i++) {
    acc += mix[i];
    if (r < acc) return i;
  }
  return 2;
}

// Ray-cast point in polygon with holes; rings = [[{x,z}]].
function inRings(x, z, rings) {
  let inside = false;
  for (const poly of rings) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
  }
  return inside;
}

function ringArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j].x + poly[i].x) * (poly[j].z - poly[i].z);
  return Math.abs(a) / 2;
}

// ------------------------------------------------------------ geometry
// A crown: an icosahedron squashed to an ellipsoid, normals pointing out
// from its centre (soft, rounded shading), jittered so no two look alike.
function crown(geos, cx, cy, cz, rx, ry, seed, color) {
  const g = new THREE.IcosahedronGeometry(1, 0); // already non-indexed
  const r = lcg(seed);
  const p = g.attributes.position;
  const n = new Float32Array(p.count * 3);
  const c = new Float32Array(p.count * 3);
  const k = new Float32Array(p.count);
  // crown centre (unit clump space) and a per-crown random: the winter
  // shrink and the per-crown autumn colour read them
  const ctr = new Float32Array(p.count * 4);
  const cr = r();
  for (let i = 0; i < p.count; i++) ctr.set([cx, cy, cz, cr], i * 4);
  // jitter the shared corners consistently: key by rounded position
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.82 + r() * 0.36);
    const j = jit.get(key);
    p.setXYZ(i, cx + x * rx * j, cy + y * ry * j, cz + z * rx * j);
    const l = Math.hypot(x, y * 0.8, z) || 1;
    n[i * 3] = x / l;
    n[i * 3 + 1] = (y * 0.8) / l + 0.25;
    n[i * 3 + 2] = z / l;
    const shade = 0.62 + 0.48 * (y * 0.5 + 0.5); // darker underneath
    c[i * 3] = color.r * shade;
    c[i * 3 + 1] = color.g * shade;
    c[i * 3 + 2] = color.b * shade;
    k[i] = 1;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aCrown', new THREE.BufferAttribute(k, 1));
  g.setAttribute('aCenter', new THREE.BufferAttribute(ctr, 4));
  geos.push(g);
}

// A conifer tier: an open cone, normals biased outward and up so the rings
// shade like needles rather than a smooth lampshade. Same attribute set as a
// crown so the season palette, the wind sway and the merge all apply.
function cone(geos, cx, cy, cz, r, h, color, seed, seg = 8) {
  const cg = new THREE.ConeGeometry(r, h, seg, 1, true);
  const g = (cg.index ? cg.toNonIndexed() : cg);
  g.translate(cx, cy, cz);
  const rnd = lcg(seed);
  const p = g.attributes.position;
  const n = new Float32Array(p.count * 3);
  const c = new Float32Array(p.count * 3);
  const k = new Float32Array(p.count);
  const ctr = new Float32Array(p.count * 4);
  const cr = rnd();
  const y0 = cy - h / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) - cx;
    const y = p.getY(i);
    const z = p.getZ(i) - cz;
    const up = (y - y0) / h; // 0 base .. 1 tip
    const l = Math.hypot(x, z) || 1;
    n[i * 3] = (x / l) * 0.75;
    n[i * 3 + 1] = 0.55 + 0.25 * up;
    n[i * 3 + 2] = (z / l) * 0.75;
    const shade = 0.6 + 0.5 * up; // darker at the skirt, lighter at the tip
    c[i * 3] = color.r * shade;
    c[i * 3 + 1] = color.g * shade;
    c[i * 3 + 2] = color.b * shade;
    k[i] = 1;
    ctr.set([cx, cy, cz, cr], i * 4);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aCrown', new THREE.BufferAttribute(k, 1));
  g.setAttribute('aCenter', new THREE.BufferAttribute(ctr, 4));
  geos.push(g);
}

// Trunks reach 0.25 (a quarter of the clump height) below the base, so on a
// hillside the downhill trunks of a clump still meet the ground.
const TRUNK_FOOT = 0.25;
function trunk(geos, x, z, h, r, color) {
  const g = new THREE.CylinderGeometry(r * 0.7, r, h + TRUNK_FOOT, 4, 1, true).toNonIndexed();
  g.translate(x, (h - TRUNK_FOOT) / 2, z);
  const count = g.attributes.position.count;
  const c = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    c[i * 3] = color.r;
    c[i * 3 + 1] = color.g;
    c[i * 3 + 2] = color.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.setAttribute('aCrown', new THREE.BufferAttribute(new Float32Array(count), 1));
  // w < 0: a trunk, never shrinks
  const ctr = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) ctr.set([x, 0, z, -1], i * 4);
  g.setAttribute('aCenter', new THREE.BufferAttribute(ctr, 4));
  geos.push(g);
}

function merge(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3], ['aCrown', 1], ['aCenter', 4]]) {
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const g of geos) {
      arr.set(g.attributes[name].array, o);
      o += g.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const g of geos) g.dispose();
  out.computeBoundingSphere();
  return out;
}

// Unit clumps: height 1 (the tallest crown top), footprint about the
// species width ratio. White crown colour; the instance tint colours it.
function clumpGeometry(species) {
  const geos = [];
  const white = new THREE.Color(1, 1, 1);
  const bark = new THREE.Color(SPECIES[species].trunk);
  const r = lcg(101 + species * 17);
  if (species === 0) {
    // maritime pine: a bare trunk carrying conical, stacked crown tiers
    trunk(geos, 0, 0, 0.62, 0.026, bark);
    cone(geos, 0, 0.48, 0, 0.31, 0.42, white, r() * 1e6, 8);
    cone(geos, 0, 0.70, 0, 0.25, 0.36, white, r() * 1e6, 8);
    cone(geos, 0, 0.90, 0, 0.16, 0.30, white, r() * 1e6, 7);
  } else if (species === 1) {
    // eucalyptus: slender trunks, tall loose layered crowns
    const spots = [[0, 0, 1], [0.2, 0.12, 0.82], [-0.14, -0.18, 0.9]];
    for (const [x, z, h] of spots) {
      trunk(geos, x, z, h * 0.52, 0.016, bark);
      crown(geos, x, h * 0.72, z, 0.13, 0.27, r() * 1e6, white);
    }
    crown(geos, 0.06, 0.88, -0.04, 0.09, 0.17, r() * 1e6, white);
  } else if (species === 2) {
    // deciduous oak: a broad rounded crown built of stacked lobes
    trunk(geos, 0, 0, 0.44, 0.036, bark);
    crown(geos, 0, 0.54, 0, 0.44, 0.34, r() * 1e6, white);
    crown(geos, 0.16, 0.70, 0.1, 0.30, 0.24, r() * 1e6, white);
    crown(geos, -0.26, 0.52, -0.16, 0.26, 0.22, r() * 1e6, white);
    crown(geos, 0.02, 0.84, -0.04, 0.18, 0.15, r() * 1e6, white);
  } else if (species === 3) {
    // understory bush: low, layered rounded lobes
    crown(geos, 0, 0.40, 0, 0.48, 0.42, r() * 1e6, white);
    crown(geos, 0.42, 0.30, 0.16, 0.34, 0.30, r() * 1e6, white);
    crown(geos, -0.3, 0.28, -0.36, 0.32, 0.28, r() * 1e6, white);
    crown(geos, 0.12, 0.20, -0.16, 0.24, 0.22, r() * 1e6, white);
  } else {
    // closed woodland: a varied, layered canopy patch on a disc; the trunks
    // are hidden under it, two short ones show at the edge
    const spots = [[0, 0, 1, 0.34, 0.28], [0.5, 0.18, 0.88, 0.30, 0.24], [-0.44, 0.3, 0.94, 0.28, 0.26], [0.12, 0.58, 0.8, 0.26, 0.24], [-0.24, -0.5, 0.9, 0.30, 0.26]];
    spots.forEach(([x, z, h, rx, ry], i) => {
      if (i === 1 || i === 4) trunk(geos, x, z, h * 0.6, 0.024, bark);
      crown(geos, x, h * 0.72, z, rx, ry, r() * 1e6, white);
      if (i === 0) crown(geos, x, h * 0.92, z, rx * 0.6, ry * 0.7, r() * 1e6, white);
    });
  }
  return merge(geos);
}

// Granite outcrop: a small cluster of angular boulders, flat-shaded, vertex
// colours only (no season tint). Placed on the upper Penha slopes.
function rockCluster(seed) {
  const geos = [];
  const rnd = lcg(seed);
  const count = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    const ig = new THREE.IcosahedronGeometry(0.36 + rnd() * 0.34, 0);
    const g = (ig.index ? ig.toNonIndexed() : ig);
    g.scale(0.8 + rnd() * 0.5, 0.5 + rnd() * 0.4, 0.8 + rnd() * 0.5);
    g.rotateY(rnd() * 6.283);
    g.translate((rnd() - 0.5) * 0.9, rnd() * 0.2, (rnd() - 0.5) * 0.9);
    const shade = 0.30 + rnd() * 0.16;
    const p = g.attributes.position;
    const c = new Float32Array(p.count * 3);
    for (let v = 0; v < p.count; v++) {
      const t = 0.82 + 0.28 * (p.getY(v) + 0.8);
      c[v * 3] = shade * t;
      c[v * 3 + 1] = shade * t * 0.99;
      c[v * 3 + 2] = shade * t * 0.94;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geos.push(g);
  }
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o);
    col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3;
  }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  for (const g of geos) g.dispose();
  return out;
}

// Merge boxes / coloured parts into one geometry (position, normal, color).
function mergeColored(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o);
    if (g.attributes.color) col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  for (const g of geos) g.dispose();
  return out;
}

function paint(g, color) {
  const p = g.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) color.toArray(c, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// World height at (x, z) in world units; the gradient is unit rise over run.
function slopeAt(x, z, heightAt, step = 2) {
  const gx = heightAt(x + step, z) - heightAt(x - step, z);
  const gz = heightAt(x, z + step) - heightAt(x, z - step);
  return { gx, gz, slope: Math.hypot(gx, gz) / (2 * step) };
}

// Socalcos: the dry-stone terrace walls of the Minho hillside. A scatter of
// small cultivated plots (lavradas) on the lower slopes below the sanctuary;
// each plot is a fan of contour-following granite walls with a row of vines
// between them. The plots are stamped into the occupancy mask so the wood
// keeps off them and the terraces read.
function buildTerraces({ hills, heightAt, blocked, oc, OCC }) {
  if (!hills.length) return null;
  const rnd = lcg(31337);
  const Y0 = 16;
  const Y1 = 58;
  const MIN_SEP = 18;
  const NPLOTS = 28;
  const walls = [];
  const rows = [];
  const polys = [];
  const seeds = [];
  const gk = (i, j) => (i * 73856093) ^ (j * 19349663);
  let tries = NPLOTS * 60;
  while (seeds.length < NPLOTS && tries-- > 0) {
    const h = hills[Math.floor(rnd() * hills.length)];
    const a = rnd() * 6.283;
    const rad = (0.22 + Math.sqrt(rnd()) * 0.62) * h.r;
    const x = h.x + Math.cos(a) * rad;
    const z = h.z + Math.sin(a) * rad;
    const y = heightAt(x, z);
    if (y < Y0 || y > Y1) continue;
    const { gx, gz, slope } = slopeAt(x, z, heightAt);
    if (slope < 0.12 || slope > 0.6) continue;
    if (blocked(x, z)) continue;
    let close = false;
    for (const s of seeds) if (Math.hypot(s.x - x, s.z - z) < MIN_SEP) close = true;
    if (close) continue;
    seeds.push({ x, z, gx, gz });
  }
  // split a line along the contour (ux, uz), centred at (x, z), into short
  // segments, each set on its own ground so the wall follows the contour
  const line = (list, x, z, ux, uz, W, yOff, color) => {
    const n = Math.max(1, Math.round(W / 4));
    const step = W / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5 - n / 2) * step;
      const px = x + ux * t;
      const pz = z + uz * t;
      const py = heightAt(px, pz);
      list.push({ x: px, y: py + yOff, z: pz, ang: Math.atan2(-uz, ux), len: step * 0.98, color });
    }
  };
  for (const s of seeds) {
    const gl = Math.hypot(s.gx, s.gz) || 1;
    const dx = -s.gx / gl; // downhill
    const dz = -s.gz / gl;
    const ux = -dz; // along the contour
    const uz = dx;
    const W = 10 + rnd() * 14;
    const D = 7 + rnd() * 7;
    const spacing = 1.7 + rnd() * 1.1;
    const nW = Math.max(2, Math.round(D / spacing));
    // the plot footprint, stamped out of the occupancy mask
    const poly = [];
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const uo = (a * W) / 2;
      const doff = (c * D) / 2;
      poly.push({ x: s.x + ux * uo + dx * doff, z: s.z + uz * uo + dz * doff });
    }
    polys.push(poly);
    for (let k = 0; k <= nW; k++) {
      const off = (k - nW / 2) * spacing;
      line(walls, s.x + dx * off, s.z + dz * off, ux, uz, W, 0.25, 0xc4bba6);
      if (k < nW) line(rows, s.x + dx * (off + spacing / 2), s.z + dz * (off + spacing / 2), ux, uz, W * 0.94, 0.28, 0x6f9f45);
    }
  }
  // clear the plots (and a margin) of trees
  if (oc) {
    oc.fillStyle = '#fff';
    for (const p of polys) {
      oc.beginPath();
      p.forEach((q, i) => (i ? oc.lineTo(q.x, q.z) : oc.moveTo(q.x, q.z)));
      oc.closePath();
      oc.fill();
    }
  }
  return { walls, rows };
}

// The terrace walls and vine rows of every plot, one merged mesh.
function buildTerraceGeometry(terraces) {
  if (!terraces) return null;
  const geos = [];
  const color = new THREE.Color();
  for (const w of terraces.walls) {
    const g = new THREE.BoxGeometry(w.len, 0.55, 0.34).toNonIndexed();
    g.rotateY(w.ang);
    g.translate(w.x, w.y, w.z);
    geos.push(paint(g, color.setHex(w.color)));
  }
  for (const r of terraces.rows) {
    const g = new THREE.BoxGeometry(r.len, 0.5, 0.42).toNonIndexed();
    g.rotateY(r.ang);
    g.translate(r.x, r.y, r.z);
    geos.push(paint(g, color.setHex(r.color)));
  }
  if (!geos.length) return null;
  const geometry = mergeColored(geos);
  return { geometry, stats: { walls: terraces.walls.length, rows: terraces.rows.length, tris: Math.round(geometry.attributes.position.count / 3) } };
}

// The sanctuary boulder field: a dense ring of the big granite blocks the
// Penha summit is known for, around the church box the app passes in avoid.
function buildSanctuaryBoulders({ hills, heightAt, blocked, avoid }) {
  if (!hills.length) return null;
  const boxes = avoid?.boxes || [];
  if (!boxes.length) return null;
  let centre = null;
  let best = Infinity;
  for (const bx of boxes) {
    const c = new THREE.Vector3();
    bx.getCenter(c);
    const d = Math.hypot(c.x - hills[0].x, c.z - hills[0].z);
    if (d < best) {
      best = d;
      centre = c;
    }
  }
  if (!centre || best > hills[0].r) return null;
  const rnd = lcg(8080);
  const spots = [];
  const N = 44;
  const minD = 2.6;
  const grid = new Map();
  const gk = (i, j) => (i * 73856093) ^ (j * 19349663);
  let tries = N * 40;
  while (spots.length < N && tries-- > 0) {
    const a = rnd() * 6.283;
    const rad = 7 + Math.sqrt(rnd()) * 26; // world units: 28..132 m from the church
    const x = centre.x + Math.cos(a) * rad;
    const z = centre.z + Math.sin(a) * rad;
    if (blocked(x, z)) continue;
    const gi = Math.floor(x / minD);
    const gj = Math.floor(z / minD);
    let close = false;
    for (let di = -2; di <= 2 && !close; di++) {
      for (let dj = -2; dj <= 2 && !close; dj++) {
        const q = grid.get(gk(gi + di, gj + dj));
        if (q && Math.hypot(q.x - x, q.z - z) < minD) close = true;
      }
    }
    if (close) continue;
    grid.set(gk(gi, gj), { x, z });
    spots.push({ x, y: heightAt(x, z) - 0.2, z, rot: rnd() * 6.283, s: 1.5 + rnd() * 2.0, sy: 0.7 + rnd() * 0.4 });
  }
  if (!spots.length) return null;
  const rockGeo = rockCluster(21);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
  mat.name = 'sanctuary-boulders';
  const mesh = new THREE.InstancedMesh(rockGeo, mat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  spots.forEach((o, i) => {
    p.set(o.x, o.y, o.z);
    q.setFromAxisAngle(up, o.rot);
    sc.set(o.s, o.s * o.sy, o.s);
    mesh.setMatrixAt(i, m.compose(p, q, sc));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'sanctuary-boulders';
  const tris = Math.round((rockGeo.attributes.position.count / 3) * spots.length);
  return { mesh, stats: { count: spots.length, tris } };
}

// Billboard atlas: four cells (one per species), grey shading with alpha;
// the instance tint colours it in the shader.
function billboardAtlas() {
  const W = 128;
  const H = 128;
  const cv = document.createElement('canvas');
  cv.width = W * CELLS;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const r = lcg(9);
  const blob = (x, y, rx, ry) => {
    const g = ctx.createRadialGradient(x - rx * 0.35, y - ry * 0.45, rx * 0.1, x, y, Math.max(rx, ry));
    g.addColorStop(0, 'rgb(255,255,255)');
    g.addColorStop(0.7, 'rgb(170,170,170)');
    g.addColorStop(1, 'rgb(105,105,105)');
    ctx.fillStyle = g;
    ctx.beginPath();
    // lumpy outline
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 0.86 + r() * 0.2;
      const px = x + Math.cos(a) * rx * k;
      const py = y + Math.sin(a) * ry * k;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.fill();
  };
  const stem = (x, y0, y1, w, shade) => {
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(x - w / 2, y1, w, y0 - y1);
  };
  // a conifer tier: a shaded triangle from baseY up to baseY - h
  const tri = (cx, baseY, w, h, shade) => {
    const g = ctx.createLinearGradient(cx, baseY - h, cx, baseY);
    g.addColorStop(0, `rgb(${Math.min(255, shade + 70)},${Math.min(255, shade + 70)},${Math.min(255, shade + 70)})`);
    g.addColorStop(1, `rgb(${shade},${shade},${shade})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - h);
    ctx.lineTo(cx + w, baseY);
    ctx.lineTo(cx - w, baseY);
    ctx.closePath();
    ctx.fill();
  };
  const cell = (i, draw) => {
    ctx.save();
    ctx.translate(i * W, 0);
    draw();
    ctx.restore();
  };
  // y grows downward: the ground line is at H
  cell(0, () => {
    // conical pine: stacked tiers up a bare trunk
    stem(64, H, H * 0.42, 3, 115);
    tri(64, H * 0.42, 30, H * 0.5, 110);
    tri(64, H * 0.27, 24, H * 0.46, 145);
    tri(64, H * 0.12, 17, H * 0.42, 180);
  });
  cell(1, () => {
    for (const [x, h] of [[64, 1], [86, 0.82], [46, 0.9]]) {
      stem(x, H, H - H * h * 0.6, 2, 200);
      blob(x, H - H * h * 0.7, 13, 24);
      blob(x + 3, H - H * h * 0.88, 10, 13);
    }
  });
  cell(2, () => {
    // deciduous oak: a broad rounded crown of stacked lobes
    stem(64, H, H - 46, 5, 110);
    blob(64, H - 76, 42, 34);
    blob(58, H - 100, 26, 22);
    blob(88, H - 62, 25, 25);
    blob(40, H - 58, 22, 22);
  });
  cell(3, () => {
    blob(64, H - 34, 34, 30);
    blob(98, H - 24, 22, 20);
    blob(40, H - 22, 22, 19);
  });
  cell(4, () => {
    // a canopy patch seen from the side: a lumpy band of crowns
    for (const [x, h, rx] of [[18, 0.72, 18], [40, 0.86, 20], [64, 1, 22], [88, 0.84, 20], [110, 0.74, 17]]) {
      stem(x, H, H - H * h * 0.5, 3, 105);
      blob(x, H - H * h * 0.68, rx, H * h * 0.3);
    }
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------ build
// opts: { data, project, heightAt, rect: {x0,zN,x1,zS}, roads, buildings,
//         avoid: { outlines: [[{x,z}]], plans: [{cx,cz,ux,uz,hu,hv}], boxes: [Box3] },
//         budget, mobile }
// Tree kinds for the streamed tiles (src/tile-worker.js scatters their
// trees with the same heights, mixes and densities).
export const TREE_TABLES = { heights: SPECIES.map((s) => s.h), mix: MIX, density: DENSITY };

export function buildNature(opts) {
  const { data, project, heightAt } = opts;
  const group = new THREE.Group();
  group.name = 'nature';
  const stats = { areas: 0, trees: 0, near: 0, far: 0, water: 0, rejected: 0, landPx: '', stream: 0 };
  const uniforms = {
    uTime: { value: 0 },
    uSunView: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
  };
  if (!data || !Array.isArray(data.areas)) return { group, stats, landcover: null, update() {}, uniforms, setStreamTrees() {} };
  // The masks cover the core only, the area of nature.json: the terrain
  // rectangle may reach far past it (the streamed tiles bring their own).
  let rect = opts.rect;
  if (data.bbox) {
    const sw = project(data.bbox.s, data.bbox.w);
    const ne = project(data.bbox.n, data.bbox.e);
    rect = { x0: Math.max(rect.x0, sw.x), x1: Math.min(rect.x1, ne.x), zN: Math.max(rect.zN, ne.z), zS: Math.min(rect.zS, sw.z) };
  }
  // room for the streamed trees of the tiles around the core
  const STREAM = opts.streamCap ?? (opts.mobile ? 2500 : 8000);

  // ---- project
  const areas = [];
  for (const a of data.areas) {
    if (!Array.isArray(a.r) || !a.r.length) continue;
    const rings = a.r.map((ring) => ring.map((q) => project(q[0], q[1]))).filter((r) => r.length >= 3);
    if (!rings.length) continue;
    const area = Math.max(0, ringArea(rings[0]) - rings.slice(1).reduce((s, r) => s + ringArea(r), 0));
    areas.push({ k: a.k, rings, area });
  }
  stats.areas = areas.length;

  const W = rect.x1 - rect.x0;
  const D = rect.zS - rect.zN;

  // ---- land-cover mask (R forest, G green, B fields, A built-up)
  const lw = Math.ceil(W * LAND_PX);
  const lh = Math.ceil(D * LAND_PX);
  stats.landPx = `${lw}x${lh}`;
  const layer = () => {
    const cv = document.createElement('canvas');
    cv.width = lw;
    cv.height = lh;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(LAND_PX, 0, 0, LAND_PX, -rect.x0 * LAND_PX, -rect.zN * LAND_PX);
    return { cv, ctx };
  };
  const path = (ctx, rings) => {
    ctx.beginPath();
    for (const ring of rings) {
      ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z)));
      ctx.closePath();
    }
  };
  const fillKinds = (ctx, kinds) => {
    for (const a of areas) {
      const v = kinds[a.k];
      if (v == null) continue;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      path(ctx, a.rings);
      ctx.fill('evenodd');
    }
  };
  const Lf = layer();
  fillKinds(Lf.ctx, { scrub: 150, forest: 255 });
  const Lg = layer();
  fillKinds(Lg.ctx, { grass: 200, park: 225, garden: 235 });
  const Lb = layer();
  fillKinds(Lb.ctx, { orchard: 85, vineyard: 170, farmland: 255 });
  const Lu = layer();
  if (opts.buildings?.length) {
    Lu.ctx.fillStyle = '#fff';
    Lu.ctx.strokeStyle = '#fff';
    Lu.ctx.lineWidth = 3 / LAND_PX;
    for (const poly of opts.buildings) {
      path(Lu.ctx, [poly]);
      Lu.ctx.fill();
      Lu.ctx.stroke();
    }
  }
  const px = lw * lh;
  const mask = new Uint8Array(px * 4);
  const rd = (L) => L.ctx.getImageData(0, 0, lw, lh).data;
  const f = rd(Lf);
  const g = rd(Lg);
  const b = rd(Lb);
  const u = blur(rd(Lu), lw, lh, 3);
  for (let i = 0; i < px; i++) {
    mask[i * 4] = f[i * 4];
    mask[i * 4 + 1] = g[i * 4];
    mask[i * 4 + 2] = b[i * 4];
    mask[i * 4 + 3] = Math.min(255, u[i] * 1.6);
  }
  // canvas rows run north to south, as do world z; no flip needed
  const landcover = new THREE.DataTexture(mask, lw, lh, THREE.RGBAFormat);
  landcover.flipY = false;
  landcover.magFilter = THREE.LinearFilter;
  landcover.minFilter = THREE.LinearMipmapLinearFilter;
  landcover.generateMipmaps = true;
  landcover.anisotropy = 4; // read across the whole ground at grazing angles
  landcover.colorSpace = THREE.NoColorSpace;
  landcover.needsUpdate = true;
  // uv = (world - rect origin) / size: rows from zN downward
  const landRect = { x0: rect.x0, z0: rect.zN, w: lw / LAND_PX, d: lh / LAND_PX };

  // ---- occupancy: where no tree may stand (1 px per world unit)
  const OCC = opts.mobile ? 0.5 : 1;
  const ow = Math.ceil(W * OCC);
  const oh = Math.ceil(D * OCC);
  const occCv = document.createElement('canvas');
  occCv.width = ow;
  occCv.height = oh;
  const oc = occCv.getContext('2d', { willReadFrequently: true });
  oc.setTransform(OCC, 0, 0, OCC, -rect.x0 * OCC, -rect.zN * OCC);
  oc.fillStyle = '#fff';
  oc.strokeStyle = '#fff';
  oc.lineCap = 'round';
  oc.lineJoin = 'round';
  // streets at their real width plus a verge
  const ROAD_M = { primary: 8 + 8, secondary: 5 + 6, minor: 3 + 5, rail: 3 + 6, water: 10 };
  for (const feat of opts.roads?.features || []) {
    const wM = ROAD_M[feat.kind];
    if (!wM || !Array.isArray(feat.pts) || feat.pts.length < 2) continue;
    oc.lineWidth = wM * S;
    oc.beginPath();
    feat.pts.forEach((q, i) => {
      const p = project(q[0], q[1]);
      if (i) oc.lineTo(p.x, p.z);
      else oc.moveTo(p.x, p.z);
    });
    oc.stroke();
  }
  oc.lineWidth = 2;
  for (const poly of opts.buildings || []) {
    path(oc, [poly]);
    oc.fill();
    oc.stroke();
  }
  // landmarks: their OSM outlines, fitted plans and model boxes, with a margin
  oc.lineWidth = 6;
  for (const poly of opts.avoid?.outlines || []) {
    path(oc, [poly]);
    oc.fill();
    oc.stroke();
  }
  for (const r of opts.avoid?.plans || []) {
    const hu = r.hu + 3;
    const hv = r.hv + 3;
    const corners = [[hu, hv], [-hu, hv], [-hu, -hv], [hu, -hv]].map(([a, c]) => ({ x: r.cx + a * r.ux - c * r.uz, z: r.cz + a * r.uz + c * r.ux }));
    path(oc, [corners]);
    oc.fill();
  }
  for (const bx of opts.avoid?.boxes || []) oc.fillRect(bx.min.x - 3, bx.min.z - 3, bx.max.x - bx.min.x + 6, bx.max.z - bx.min.z + 6);
  for (const a of areas) {
    if (a.k !== 'water') continue;
    path(oc, a.rings);
    oc.fill('evenodd');
  }
  for (const l of data.lines || []) {
    oc.lineWidth = ((l.w || 3) + 6) * S;
    oc.beginPath();
    l.p.forEach((q, i) => {
      const p = project(q[0], q[1]);
      if (i) oc.lineTo(p.x, p.z);
      else oc.moveTo(p.x, p.z);
    });
    oc.stroke();
  }
  let occ = oc.getImageData(0, 0, ow, oh).data;
  const blocked = (x, z) => {
    const i = Math.floor((x - rect.x0) * OCC);
    const j = Math.floor((z - rect.zN) * OCC);
    if (i < 0 || j < 0 || i >= ow || j >= oh) return true;
    return occ[(j * ow + i) * 4] > 40;
  };

  // ---- the wooded sanctuary hills (views: cities/<id>.json nature.hills)
  const hills = HILLS().map((h) => ({ ...project(h.lat, h.lon), r: h.r * S }));

  // ---- socalcos: cultivated plots below the sanctuary, stamped into the
  // occupancy mask before the trees scatter (they must not cover the plots)
  const terraces = buildTerraces({ hills, heightAt, blocked, oc, OCC });
  if (terraces) occ = oc.getImageData(0, 0, ow, oh).data;

  // ---- scatter
  const boostAt = (x, z) => {
    let k = 1;
    for (const h of hills) {
      const d = Math.hypot(x - h.x, z - h.z);
      if (d < h.r) k = Math.max(k, 1 + (HILL_BOOST - 1) * (1 - d / h.r));
    }
    return k;
  };
  const cands = areas.filter((a) => DENSITY[a.k] > 0 && a.area > 4);
  let weightSum = 0;
  for (const a of cands) {
    let cx = 0;
    let cz = 0;
    for (const p of a.rings[0]) {
      cx += p.x;
      cz += p.z;
    }
    cx /= a.rings[0].length;
    cz /= a.rings[0].length;
    a.weight = a.area * DENSITY[a.k] * boostAt(cx, cz);
    weightSum += a.weight;
  }
  const budget = opts.budget ?? 5000;
  const rnd = lcg(20260928);
  const trees = []; // { x, y, z, h, rot, s, tint }
  const tint = new THREE.Color();
  for (const a of cands) {
    const want = (budget * a.weight) / weightSum;
    let n = Math.floor(want) + (rnd() < want % 1 ? 1 : 0);
    if (!n) continue;
    const xs = a.rings[0].map((p) => p.x);
    const zs = a.rings[0].map((p) => p.z);
    const bx0 = Math.min(...xs);
    const bx1 = Math.max(...xs);
    const bz0 = Math.min(...zs);
    const bz1 = Math.max(...zs);
    // dart throwing with a minimum spacing: an even, natural scatter
    const minD = Math.sqrt(a.area / n) * 0.62;
    const cell = minD / Math.SQRT2;
    const grid = new Map();
    const key = (i, j) => i * 73856093 ^ j * 19349663;
    const mix = MIX[a.k];
    let tries = n * 14;
    while (n > 0 && tries-- > 0) {
      const x = bx0 + rnd() * (bx1 - bx0);
      const z = bz0 + rnd() * (bz1 - bz0);
      if (!inRings(x, z, a.rings)) continue;
      const gi = Math.floor(x / cell);
      const gj = Math.floor(z / cell);
      let close = false;
      for (let di = -2; di <= 2 && !close; di++) {
        for (let dj = -2; dj <= 2 && !close; dj++) {
          const q = grid.get(key(gi + di, gj + dj));
          if (q && Math.hypot(q.x - x, q.z - z) < minD) close = true;
        }
      }
      if (close) continue;
      let s = pickSpecies(mix, rnd());
      const gy = heightAt(x, z);
      // upper Penha: the pine takes over from broadleaf and closed canopy
      if (gy > PINE_Y) {
        const p = Math.min(0.8, (gy - PINE_Y) / 28);
        if ((s === 1 || s === 2 || s === 4) && rnd() < p) s = 0;
      }
      const sp = SPECIES[s];
      const hM = sp.h[0] + rnd() * (sp.h[1] - sp.h[0]);
      // the whole clump keeps clear, not only its centre
      const reach = hM * S * (s === 4 ? 0.62 : s === 3 ? 0.4 : 0.25);
      if (blocked(x, z) || blocked(x + reach, z) || blocked(x - reach, z) || blocked(x, z + reach) || blocked(x, z - reach)) {
        stats.rejected++;
        continue;
      }
      grid.set(key(gi, gj), { x, z });
      tint.set(sp.tint).multiplyScalar(0.8 + rnd() * 0.4);
      tint.offsetHSL((rnd() - 0.5) * 0.03, 0, 0);
      // per-instance squash: no two crowns share a width / height ratio
      trees.push({
        x,
        // sink the base a little: the trunk foot stays in the ground on a slope
        y: gy - Math.min(0.35, hM * S * 0.12),
        z,
        h: hM * S,
        s,
        rot: rnd() * Math.PI * 2,
        tint: [tint.r, tint.g, tint.b],
        phase: rnd() * 6.283,
        wx: 0.84 + rnd() * 0.32,
        wz: 0.84 + rnd() * 0.32,
        wy: 0.92 + rnd() * 0.16,
      });
      n--;
    }
  }
  stats.trees = trees.length;

  // ---- tree meshes (near) and billboards (far)
  const bySpecies = SPECIES.map(() => []);
  for (const t of trees) bySpecies[t.s].push(t);
  const near = bySpecies.map((list, s) => {
    const geo = clumpGeometry(s);
    const cap = Math.max(1, list.length + STREAM);
    const tintAttr = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    tintAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTint', tintAttr);
    const mat = treeMaterial(uniforms, s);
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    // the shadow pass shrinks and sways the crowns the same way: bare
    // winter crowns cast no summer shadows
    mesh.customDepthMaterial = treeDepthMaterial(uniforms, s);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `trees-${s}`;
    group.add(mesh);
    return { mesh, list, stream: [], tintAttr, tris: geo.attributes.position.count / 3 };
  });

  const bbGeo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  bbGeo.index = quad.index;
  bbGeo.setAttribute('position', quad.attributes.position);
  bbGeo.setAttribute('uv', quad.attributes.uv);
  const bbCap = trees.length + STREAM + 1;
  const bbInst = new THREE.InstancedBufferAttribute(new Float32Array(bbCap * 4), 4);
  const bbInfo = new THREE.InstancedBufferAttribute(new Float32Array(bbCap * 4), 4);
  const bbTint = new THREE.InstancedBufferAttribute(new Float32Array(bbCap * 3), 3);
  for (const a of [bbInst, bbInfo, bbTint]) a.setUsage(THREE.DynamicDrawUsage);
  bbGeo.setAttribute('aInst', bbInst);
  bbGeo.setAttribute('aInfo', bbInfo);
  bbGeo.setAttribute('aTint', bbTint);
  bbGeo.instanceCount = 0;
  const bbMat = billboardMaterial(uniforms, billboardAtlas());
  const billboards = new THREE.Mesh(bbGeo, bbMat);
  billboards.frustumCulled = false;
  billboards.name = 'tree-billboards';
  group.add(billboards);

  // ---- granite outcrops on the upper Penha slopes
  if (hills.length) {
    const rRock = lcg(4242);
    const rocks = [];
    for (const h of hills) {
      const N = opts.mobile ? 18 : 64;
      let tries = N * 50;
      let n = 0;
      const minD = Math.max(3.5, h.r * 0.035);
      const grid = new Map();
      const gk = (i, j) => (i * 73856093) ^ (j * 19349663);
      while (n < N && tries-- > 0) {
        const a = rRock() * 6.283;
        const rad = Math.sqrt(rRock()) * h.r * 0.9;
        const x = h.x + Math.cos(a) * rad;
        const z = h.z + Math.sin(a) * rad;
        const y = heightAt(x, z);
        if (y < ROCK_Y || blocked(x, z)) continue;
        // favour exposed slopes over level ground
        const gxp = heightAt(x + 4, z) - heightAt(x - 4, z);
        const gzp = heightAt(x, z + 4) - heightAt(x, z - 4);
        if (Math.hypot(gxp, gzp) < 0.7 && rRock() < 0.6) continue;
        const gi = Math.floor(x / minD);
        const gj = Math.floor(z / minD);
        let close = false;
        for (let di = -2; di <= 2 && !close; di++) {
          for (let dj = -2; dj <= 2 && !close; dj++) {
            const q = grid.get(gk(gi + di, gj + dj));
            if (q && Math.hypot(q.x - x, q.z - z) < minD) close = true;
          }
        }
        if (close) continue;
        grid.set(gk(gi, gj), { x, z });
        rocks.push({ x, y: y - 0.25, z, rot: rRock() * 6.283, s: 1.1 + rRock() * 1.7, sy: 0.8 + rRock() * 0.4 });
        n++;
      }
    }
    if (rocks.length) {
      const rockGeo = rockCluster(7);
      const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true });
      rockMat.name = 'outcrops';
      const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
      const rm = new THREE.Matrix4();
      const rq = new THREE.Quaternion();
      const rp = new THREE.Vector3();
      const rs = new THREE.Vector3();
      const rUp = new THREE.Vector3(0, 1, 0);
      rocks.forEach((o, i) => {
        rp.set(o.x, o.y, o.z);
        rq.setFromAxisAngle(rUp, o.rot);
        rs.set(o.s, o.s * o.sy, o.s);
        rm.compose(rp, rq, rs);
        rockMesh.setMatrixAt(i, rm);
      });
      rockMesh.instanceMatrix.needsUpdate = true;
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      rockMesh.name = 'outcrops';
      group.add(rockMesh);
      stats.rocks = rocks.length;
      stats.rockTris = Math.round((rockGeo.attributes.position.count / 3) * rocks.length);
    }
  }

  // ---- the sanctuary boulder field and the socalcos below it
  if (hills.length) {
    const boulders = buildSanctuaryBoulders({ hills, heightAt, blocked, avoid: opts.avoid });
    if (boulders) {
      group.add(boulders.mesh);
      stats.boulders = boulders.stats;
    }
    const t = buildTerraceGeometry(terraces);
    if (t) {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, flatShading: true });
      mat.name = 'socalcos';
      const mesh = new THREE.Mesh(t.geometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'socalcos';
      group.add(mesh);
      stats.terraces = t.stats;
    }
  }

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const lastCam = new THREE.Vector3(Infinity, 0, 0);
  let nearR = NEAR;
  function partition(cam) {
    lastCam.copy(cam);
    const r2 = nearR * nearR;
    let far = 0;
    let nearCount = 0;
    let nearTris = 0;
    for (let s = 0; s < near.length; s++) {
      const N = near[s];
      let k = 0;
      const wr = SPECIES[s].w;
      for (let ti = 0, nl = N.list.length, nt = nl + N.stream.length; ti < nt; ti++) {
        const t = ti < nl ? N.list[ti] : N.stream[ti - nl];
        const dx = t.x - cam.x;
        const dy = t.y - cam.y;
        const dz = t.z - cam.z;
        if (dx * dx + dy * dy + dz * dz < r2) {
          _p.set(t.x, t.y, t.z);
          _q.setFromAxisAngle(_up, t.rot);
          _s.set(t.h * (t.wx || 1), t.h * (t.wy || 1), t.h * (t.wz || 1));
          _m.compose(_p, _q, _s);
          N.mesh.setMatrixAt(k, _m);
          N.tintAttr.setXYZ(k, t.tint[0], t.tint[1], t.tint[2]);
          k++;
        } else {
          bbInst.setXYZW(far, t.x, t.y, t.z, t.h * (t.wy || 1));
          bbInfo.setXYZW(far, s, wr * (t.wx || 1), t.phase, 0);
          bbTint.setXYZ(far, t.tint[0], t.tint[1], t.tint[2]);
          far++;
        }
      }
      N.mesh.count = k;
      N.mesh.instanceMatrix.needsUpdate = true;
      N.tintAttr.needsUpdate = true;
      nearCount += k;
      nearTris += k * N.tris;
    }
    bbGeo.instanceCount = far;
    bbInst.needsUpdate = true;
    bbInfo.needsUpdate = true;
    bbTint.needsUpdate = true;
    stats.near = nearCount;
    stats.far = far;
    stats.nearTris = Math.round(nearTris);
  }

  // ---- water: river ribbons and pond / reservoir polygons (src/water.js)
  const water = createWater({ data, areas, project, heightAt });
  if (water) {
    group.add(water.mesh);
    stats.water = water.triangles;
  }

  // ---- leaf field for the falling leaves and petals (src/leaves.js)
  const leafField = buildLeafField(trees, rect, heightAt);

  const _sv = new THREE.Vector3();
  function update(dt, camera, light) {
    uniforms.uTime.value += dt;
    water?.update(dt, light);
    if (light) {
      _sv.copy(light.dir).transformDirection(camera.matrixWorldInverse);
      uniforms.uSunView.value.copy(_sv);
      uniforms.uSunColor.value.copy(light.color);
      bbMat.uniforms.uSunDir.value.copy(light.dir);
      bbMat.uniforms.uSunColor.value.copy(light.color);
      bbMat.uniforms.uAmbient.value.copy(light.ambient);
    }
    if (lastCam.distanceToSquared(camera.position) > REPART_MOVE * REPART_MOVE) partition(camera.position);
  }

  return {
    group,
    stats,
    data, // the OSM lines and areas (life.js puts a flock over the Rio Este)
    landcover,
    landRect,
    uniforms,
    water,
    leafField,
    update,
    setNearRadius(r) {
      nearR = r;
      lastCam.set(Infinity, 0, 0);
    },
    setShadows(on) {
      for (const N of near) N.mesh.castShadow = on;
    },
    // Trees of the streamed tiles (src/tiles.js): a list of Float32Arrays,
    // 9 floats per clump: x, y (base), z, height, species, rotation, sway
    // phase, and two randoms for the tint. Replaces the previous set; at
    // most `streamCap` clumps are kept. They join the same meshes and
    // billboards as the core's trees, so they sway, turn with the seasons
    // and switch to billboards the same way.
    streamCap: STREAM,
    setStreamTrees(chunks) {
      for (const N of near) N.stream = [];
      let n = 0;
      const c = new THREE.Color();
      for (const arr of chunks) {
        for (let i = 0; i + 8 < arr.length && n < STREAM; i += 9, n++) {
          const s = arr[i + 4] | 0;
          const sp = SPECIES[s];
          if (!sp) continue;
          c.set(sp.tint).multiplyScalar(0.8 + arr[i + 7] * 0.4);
          c.offsetHSL((arr[i + 8] - 0.5) * 0.03, 0, 0);
          near[s].stream.push({ x: arr[i], y: arr[i + 1], z: arr[i + 2], h: arr[i + 3], s, rot: arr[i + 5], phase: arr[i + 6], tint: [c.r, c.g, c.b] });
        }
      }
      stats.stream = n;
      lastCam.set(Infinity, 0, 0); // re-split at the next update
    },
  };
}

// The field the falling leaves and petals read (src/leaves.js), one texel
// per 4 world units (16 m) over the data rectangle, half float:
//   R ground height (world y), G deciduous crowns nearby 0..1 (autumn
//   leaves), B blossoming trees nearby 0..1 (spring petals), A the mean
//   crown height there (world units).
const FIELD_UNIT = 4;
function buildLeafField(trees, rect, heightAt) {
  const w = Math.ceil((rect.x1 - rect.x0) / FIELD_UNIT);
  const h = Math.ceil((rect.zS - rect.zN) / FIELD_UNIT);
  const n = w * h;
  const dec = new Float32Array(n * 4);
  const blo = new Float32Array(n * 4);
  const cnt = new Float32Array(n * 4);
  const hgt = new Float32Array(n * 4);
  for (const t of trees) {
    const i = Math.floor((t.x - rect.x0) / FIELD_UNIT);
    const j = Math.floor((t.z - rect.zN) / FIELD_UNIT);
    if (i < 0 || j < 0 || i >= w || j >= h) continue;
    const k = (j * w + i) * 4;
    const sc = SEASON_CROWNS[t.s];
    dec[k] += sc.bare;
    blo[k] += sc.bloom;
    cnt[k] += 1;
    hgt[k] += t.h;
  }
  const bd = blur(dec, w, h, 2);
  const bb = blur(blo, w, h, 2);
  const bc = blur(cnt, w, h, 2);
  const bh = blur(hgt, w, h, 2);
  // each clump stands for a few crowns: scale so the densest tenth of the
  // wooded cells reads as full cover
  const p90 = (a) => {
    const v = Array.from(a).filter((x) => x > 1e-4).sort((x, y) => x - y);
    return v.length ? v[Math.floor(v.length * 0.9)] : 1;
  };
  const kd = 0.9 / p90(bd);
  const kb = 0.9 / p90(bb);
  const data = new Uint16Array(n * 4);
  const half = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const x = rect.x0 + (i + 0.5) * FIELD_UNIT;
      const z = rect.zN + (j + 0.5) * FIELD_UNIT;
      data[k * 4] = half(heightAt(x, z));
      data[k * 4 + 1] = half(Math.min(1, bd[k] * kd));
      data[k * 4 + 2] = half(Math.min(1, bb[k] * kb));
      data[k * 4 + 3] = half(bc[k] > 1e-3 ? bh[k] / bc[k] : 0);
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  // uv = (world xz - origin) / size; rows run north to south like world z
  return { texture: tex, rect: { x0: rect.x0, z0: rect.zN, w: w * FIELD_UNIT, d: h * FIELD_UNIT } };
}

// separable box blur of the red channel of RGBA data; returns one channel
function blur(rgba, w, h, r) {
  const a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = rgba[i * 4];
  const tmp = new Float32Array(w * h);
  const k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s * k;
      s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      a[y * w + x] = s * k;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return a;
}

// ------------------------------------------------------------ materials
// Per-species season uniforms: the palette in linear light and the shares
// (see SEASON_CROWNS). One object per species, shared by the colour and
// the shadow material.
const speciesUniforms = [];
function seasonUniforms(s) {
  if (speciesUniforms[s]) return speciesUniforms[s];
  const sc = SEASON_CROWNS[s];
  speciesUniforms[s] = {
    uPal: { value: sc.pal.map((h) => new THREE.Color(h)) },
    uBase: { value: new THREE.Color(SPECIES[s].tint) },
    uKind: { value: new THREE.Vector3(sc.share, sc.bare, sc.bloom) },
  };
  return speciesUniforms[s];
}

// Vertex code shared by the tree colour and shadow materials: per-tree and
// per-crown hashes, the winter shrink of the bare crowns, the wind sway.
const TREE_VERT_PARS = /* glsl */ `
uniform float uTime;
uniform vec4 seasonW;
uniform vec3 uKind; // x palette share, y bare share, z bloom share
attribute vec4 aCenter;
float tHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
`;
const TREE_DEFORM = /* glsl */ `
#ifdef USE_INSTANCING
  vec2 wp = instanceMatrix[3].xz;
#else
  vec2 wp = vec2(0.0);
#endif
float tHI = tHash(wp * 0.37 + 0.11);
float tHC = fract(tHI * 7.31 + aCenter.w * 3.17);
float tCrown = step(0.0, aCenter.w);
float tPal = tCrown * step(tHC, uKind.x);
float tBare = tCrown * step(tHC, uKind.y);
// winter: bare crowns shrink to a twig mass; autumn thins them a little
transformed = mix(transformed, aCenter.xyz, tBare * (seasonW.w * 0.5 + seasonW.z * 0.08));
// wind: the crown sways, more toward the top; phase from the position
float sway = sin(uTime * 1.3 + wp.x * 0.05 + wp.y * 0.07) + 0.4 * sin(uTime * 2.9 + wp.y * 0.11);
float bend = position.y * position.y * 0.035;
transformed.x += sway * bend;
transformed.z += sway * bend * 0.6;
`;
// Crown colour for the season, resolved from the authored palette every
// frame (never from last frame's colour, so nothing drifts).
const TREE_SEASON_COLOR = /* glsl */ `
{
  vec3 vary = aTint / max(uBase, vec3(1e-3)); // this tree's own variation
  vec3 cSum = uPal[1];
  vec3 ever = cSum * (seasonW.x * vec3(1.06, 1.1, 1.0) + vec3(seasonW.y) + seasonW.z * vec3(1.0, 0.97, 0.92) + seasonW.w * vec3(0.86, 0.88, 0.9));
  vec3 cFall = mix(uPal[2], uPal[3], fract(tHC * 5.3 + tHI));
  // one tree in six turns late: still half green
  cFall = mix(cFall, mix(cSum, uPal[2], 0.5), step(0.83, fract(tHI * 13.7)));
  vec3 own = seasonW.x * uPal[0] + seasonW.y * cSum + seasonW.z * cFall + seasonW.w * uPal[4];
  vec3 leaf = mix(ever, own, tPal) * vary;
  // spring blossom: whole trees, in specks over the crown
  float bloom = step(tHI, uKind.z) * seasonW.x * aCrown;
  float speck = smoothstep(0.3, 0.7, tHash(position.xz * 23.0 + position.y * 7.0 + tHI * 9.0));
  vec3 blossom = mix(vec3(0.84, 0.44, 0.52), vec3(0.86, 0.72, 0.7), fract(tHI * 3.1));
  float b = bloom * speck * 0.8;
  vTint = mix(leaf, blossom, b);
  // blossom and bare twigs do not glow against the sun like leaves
  vBack = aCrown * (1.0 - b) * (1.0 - tBare * seasonW.w * 0.8);
}
`;

function treeMaterial(uniforms, s) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  mat.name = 'trees';
  mat.defines = { BRG_NO_DUST: '' }; // crowns take snow only above the snow line
  const su = seasonUniforms(s);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms, su);
    sh.uniforms.seasonW = WEATHER_UNIFORMS.seasonW;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${TREE_VERT_PARS}\nuniform vec3 uPal[5];\nuniform vec3 uBase;\nattribute float aCrown;\nattribute vec3 aTint;\nvarying float vCrown;\nvarying float vBack;\nvarying vec3 vTint;`,
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvCrown = aCrown;\n${TREE_DEFORM}\n${TREE_SEASON_COLOR}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunView;\nuniform vec3 uSunColor;\nvarying float vCrown;\nvarying float vBack;\nvarying vec3 vTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(1.0), vTint, vCrown);')
      // leaves glow a little when the sun is behind them
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  // vViewPosition points from the fragment to the camera
  float back = pow(max(dot(-normalize(vViewPosition), uSunView), 0.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * uSunColor * back * 0.35 * vBack;
}`,
      );
  };
  return mat;
}

// Shadow caster with the same shrink and sway as the colour material.
function treeDepthMaterial(uniforms, s) {
  const mat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  mat.name = 'trees-depth';
  const su = seasonUniforms(s);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.uniforms.uKind = su.uKind;
    sh.uniforms.seasonW = WEATHER_UNIFORMS.seasonW;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${TREE_VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${TREE_DEFORM}`);
  };
  return mat;
}

function billboardMaterial(uniforms, atlas) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...FOG_UNIFORMS,
      ...WEATHER_UNIFORMS,
      uTime: uniforms.uTime,
      tAtlas: { value: atlas },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(1, 1, 1) },
      uAmbient: { value: new THREE.Color(0.3, 0.3, 0.3) },
      // the season palettes of all species, five colours each (SEASON_CROWNS)
      uBPal: { value: SPECIES.flatMap((_, s) => seasonUniforms(s).uPal.value) },
      uBBase: { value: SPECIES.map((_, s) => seasonUniforms(s).uBase.value) },
      uBKind: { value: SPECIES.map((_, s) => seasonUniforms(s).uKind.value) },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform vec4 seasonW;
      uniform vec3 uBPal[${CELLS * 5}];
      uniform vec3 uBBase[${CELLS}];
      uniform vec3 uBKind[${CELLS}];
      attribute vec4 aInst;
      attribute vec4 aInfo;
      attribute vec3 aTint;
      varying vec2 vUv;
      varying vec3 vTint;
      varying float vUp;
      varying float vBare;
      float bHash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * 0.1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      // the same season colour as the near meshes, one crown per tree
      vec3 seasonTint(int s, vec3 tint, vec3 base) {
        float h = bHash(aInst.xz * 0.37 + 0.11);
        float hc = fract(h * 7.31 + 1.7);
        vec3 k = uBKind[s];
        float pal = step(hc, k.x);
        vec3 cSum = uBPal[s * 5 + 1];
        vec3 ever = cSum * (seasonW.x * vec3(1.06, 1.1, 1.0) + vec3(seasonW.y) + seasonW.z * vec3(1.0, 0.97, 0.92) + seasonW.w * vec3(0.86, 0.88, 0.9));
        vec3 cFall = mix(uBPal[s * 5 + 2], uBPal[s * 5 + 3], fract(hc * 5.3 + h));
        cFall = mix(cFall, mix(cSum, uBPal[s * 5 + 2], 0.5), step(0.83, fract(h * 13.7)));
        vec3 own = seasonW.x * uBPal[s * 5] + seasonW.y * cSum + seasonW.z * cFall + seasonW.w * uBPal[s * 5 + 4];
        vec3 c = mix(ever, own, pal) * tint / max(base, vec3(1e-3));
        float bloom = step(h, k.z) * seasonW.x;
        c = mix(c, vec3(0.84, 0.66, 0.7), bloom * 0.45);
        vBare = step(hc, k.y) * seasonW.w;
        return c;
      }
      void main() {
        vec3 base = aInst.xyz;
        float h = aInst.w;
        float w = h * aInfo.y * 1.15;
        vec3 toCam = cameraPosition - base;
        vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-4, 0.0, 0.0));
        float sway = sin(uTime * 1.3 + base.x * 0.05 + base.z * 0.07) * position.y * position.y * 0.03 * h;
        vec3 p = base + right * (position.x * w + sway) + vec3(0.0, position.y * h, 0.0);
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        vUv = vec2((aInfo.x + uv.x) / ${CELLS.toFixed(1)}, uv.y);
        int sp = int(aInfo.x + 0.5);
        vTint = seasonTint(sp, aTint, uBBase[sp]);
        vUp = position.y;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D tAtlas;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uAmbient;
      varying vec2 vUv;
      varying vec3 vTint;
      varying float vUp;
      varying float vBare;
      ${CLOUD_GLSL}
      ${SEASON_GLSL}
      void main() {
        vec4 t = texture2D(tAtlas, vUv);
        if (t.a < 0.5) discard;
        // winter: a bare crown lets the sky through in a twiggy pattern
        if (vBare > 0.01 && fract(sin(dot(floor(vUv * vec2(640.0, 128.0)), vec2(12.9898, 78.233))) * 43758.5453) < vBare * 0.55) discard;
        // crowns take the tint; the grey level is baked shading
        float lum = t.r;
        vec3 albedo = vTint * (0.55 + 0.7 * lum);
        // winter: snow on the upper crowns above the snow line (scene.js)
        float snowAlt = smoothstep(seasonSnow.z - 3.0, seasonSnow.z + 6.0, vFogWorld.y);
        albedo = mix(albedo, vec3(0.62, 0.65, 0.7), seasonSnow.x * snowAlt * 0.6 * smoothstep(0.4, 0.9, vUp) * step(0.4, lum));
        // the woods far away lie under the same cloud shadows as the ground
        float sun = clamp(uSunDir.y * 0.8 + 0.35, 0.0, 1.0) * brgCloudShade(vFogWorld, uSunDir);
        vec3 col = albedo * (uAmbient + uSunColor * sun * 0.32 * (0.6 + 0.4 * vUp));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

