// The city fabric: every OSM building footprint from data/buildings.json,
// extruded to its real height on the real terrain. One BufferGeometry per
// 1 km tile, one shared material, vertex colours; no per-building draws.
// Walls carry wall-aligned coordinates (aWall: metres along the wall,
// metres above the foot, building height, seed), so the shader draws a
// window grid: dark glass by day, a random share lit warm at night.
// Buildings under a landmark (inside its OSM outline or its fitted model
// plan) are skipped, so the grey mass never pokes through a landmark.
import * as THREE from 'three';
import { S } from './geo.js';

const TILE_M = 1000; // 1 km: about 60 draw calls for the city, not 230
const MAX_TRIS = 1_500_000;
const SMALL_M2 = 30; // dropped first if over budget ...
const FAR_M = 2500; // ... when farther than this from the centre
const SKIRT = 0.4; // world units the walls reach below the lowest ground point

// Braga's fabric: cream and white render, warm granite, a little ochre;
// terracotta roofs on houses, grey flat roofs on large sheds. Picked per
// building from a hash, then varied a little in value.
const WALLS = [0xcfc2aa, 0xd8d0c0, 0xb9ad99, 0xc9ae86, 0xcdb7a6, 0xa89f92].map((h) => new THREE.Color(h));
const ROOFS = [0x9a5a42, 0x8a5240, 0xa2664a, 0x7d4e3e, 0x946a58].map((h) => new THREE.Color(h));
const FLAT_ROOF = new THREE.Color(0x77726a);
const CHURCH_WALL = new THREE.Color(0xd9d2c4);
const WALL_DIM = 0.78; // keeps a sunlit white wall well below bloom threshold

export const BUILDING_UNIFORMS = {
  uNight: { value: 0 },
  // seconds, for the streamed tiles' fade-in (src/tiles.js advances it)
  uClock: { value: 0 },
};

const WIN_PARS = /* glsl */ `
attribute vec4 aWall;
varying vec4 vWall;
`;
const WIN_FRAG_PARS = /* glsl */ `
uniform float uNight;
varying vec4 vWall;
float bHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
`;
// window cells: 3.4 m wide, 3.1 m floors, from 0.6 m above the foot
const WIN_FRAG = /* glsl */ `
#include <emissivemap_fragment>
if (vWall.y >= 0.0) {
  vec2 cell = vec2(vWall.x / 3.4, (vWall.y - 0.6) / 3.1);
  vec2 id = floor(cell);
  vec2 f = fract(cell);
  float inside = step(0.0, id.y) * step((id.y + 0.85) * 3.1 + 0.6, vWall.z);
  float win = step(0.27, f.x) * step(f.x, 0.73) * step(0.28, f.y) * step(f.y, 0.8) * inside;
  // fade the grid out where a cell is only a few pixels (no moire)
  float px = max(fwidth(cell.x), fwidth(cell.y));
  float aa = 1.0 - smoothstep(0.12, 0.35, px);
  if (vWall.w >= 0.0) {
    diffuseColor.rgb *= 1.0 - 0.3 * win * aa;
    float lit = step(bHash(id + vec2(vWall.w * 311.0, vWall.w * 173.0)), 0.3);
    float tone = bHash(id.yx + vWall.w * 57.0);
    vec3 warm = mix(vec3(1.0, 0.56, 0.22), vec3(1.0, 0.78, 0.5), tone);
    float exact = win * lit;
    float average = 0.26 * 0.3 * inside;
    // 2.6: a lit window (~1.6 in linear HDR) passes the 1.5 bloom threshold
    totalEmissiveRadiance += warm * mix(average, exact, aa) * uNight * 2.6;
  } else {
    // churches: floodlit stone at night
    totalEmissiveRadiance += diffuseColor.rgb * uNight * 0.22;
  }
}
`;

// Ray-cast point in polygon; poly = [{x, z}].
function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

// Oriented rectangle test; r = {cx, cz, ux, uz, hu, hv}.
function inRect(x, z, r) {
  const dx = x - r.cx;
  const dz = z - r.cz;
  return Math.abs(dx * r.ux + dz * r.uz) <= r.hu && Math.abs(-dx * r.uz + dz * r.ux) <= r.hv;
}

export function hash(i) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Wall and roof colour of one building (linear rgb, into wc and rc) and the
// window seed its walls carry (churches: -1, no windows).
const _wc = new THREE.Color();
const _rc = new THREE.Color();
export function buildingColors(seed, k, areaM2, wc = _wc, rc = _rc) {
  const h1 = hash(seed);
  const h2 = hash(seed + 7919);
  const tint = 0.9 + h2 * 0.2;
  const church = k === 'church';
  const shed = k === 'industrial' || k === 'commercial' || areaM2 > 900;
  wc.copy(church ? CHURCH_WALL : WALLS[Math.floor(h1 * WALLS.length)]).multiplyScalar(tint * WALL_DIM);
  rc.copy(shed ? FLAT_ROOF : ROOFS[Math.floor(h2 * ROOFS.length)]).multiplyScalar(0.92 + h1 * 0.16);
  return { wc, rc, win: church ? -1 : h1 };
}

// One building, extruded into T = { pos, nor, col, wall, idx } (plain
// arrays). pts: [{x, z}] world units, counter-clockwise seen from above
// (positive area), no closing duplicate; h metres; heightAt(x, z) the ground.
// The core (below) and the streamed tiles (src/tile-worker.js) both call it.
const contour = [];
// roofOnly: the very far LOD (beyond ~6 km, a house is a few pixels): the
// flat roof at the same height and colour, without the walls (2 triangles
// for a box instead of 10).
export function extrudeBuilding(T, pts, h, k, areaM2, seedIndex, heightAt, roofOnly = false) {
  const n = pts.length;
  const gs = pts.map((p) => heightAt(p.x, p.z));
  const gmin = Math.min(...gs);
  const gmax = Math.max(...gs);
  const base = gmin - SKIRT;
  const top = Math.max(gmin + h * S, gmax + 0.5);
  const { wc, rc, win: seed } = buildingColors(seedIndex, k, areaM2);
  // metres, for the window grid
  const hM = (top - base) / S - SKIRT / S;
  const footM = (gmin - base) / S;
  let run = 0;

  // walls: 4 vertices each, darker at the foot (cheap ambient occlusion)
  for (let i = 0; i < n && !roofOnly; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz);
    const nx = dz / L;
    const nz = -dx / L;
    const v = T.pos.length / 3;
    T.pos.push(a.x, base, a.z, b.x, base, b.z, b.x, top, b.z, a.x, top, a.z);
    T.nor.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
    const f = 0.62;
    T.col.push(wc.r * f, wc.g * f, wc.b * f, wc.r * f, wc.g * f, wc.b * f, wc.r, wc.g, wc.b, wc.r, wc.g, wc.b);
    const LM = L / S;
    const vTop = (top - gmin) / S;
    T.wall.push(run, -footM, hM, seed, run + LM, -footM, hM, seed, run + LM, vTop, hM, seed, run, vTop, hM, seed);
    run += LM;
    // (a0, b1, b0) and (a0, a1, b1) face outward
    T.idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
  }

  // flat roof
  contour.length = 0;
  for (const p of pts) contour.push(new THREE.Vector2(p.x, p.z));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const v0 = T.pos.length / 3;
  // roof-only: the missing walls were ~35 % of the house's pixels seen from
  // above at an angle, and lighter than the roof: blend their colour in
  const W = roofOnly ? 0.35 : 0;
  const cr = rc.r * (1 - W) + wc.r * 0.81 * W;
  const cg = rc.g * (1 - W) + wc.g * 0.81 * W;
  const cb = rc.b * (1 - W) + wc.b * 0.81 * W;
  for (const p of pts) {
    T.pos.push(p.x, top, p.z);
    T.nor.push(0, 1, 0);
    T.col.push(cr, cg, cb);
    T.wall.push(0, -1, 0, seed);
  }
  for (const [a, b, c] of faces) {
    const A = pts[a];
    const B = pts[b];
    const C = pts[c];
    const up = (B.z - A.z) * (C.x - A.x) - (B.x - A.x) * (C.z - A.z);
    if (up >= 0) T.idx.push(v0 + a, v0 + b, v0 + c);
    else T.idx.push(v0 + a, v0 + c, v0 + b);
  }
  return top;
}

// Fade-in for the streamed tiles (src/tiles.js): each vertex carries the
// clock time it appeared (aBorn); for 0.6 s after that a growing share of
// its pixels is drawn (ordered dither), so a tile appears without a pop and
// stays opaque (shadows, depth, no sorting).
export const FADE_S = 0.6;
export const FADE_VERT_PARS = /* glsl */ `
#ifdef BRG_FADE
attribute float aBorn;
varying float vBorn;
#endif
`;
export const FADE_VERT = /* glsl */ `
#ifdef BRG_FADE
vBorn = aBorn;
#endif
`;
export const FADE_FRAG_PARS = /* glsl */ `
#ifdef BRG_FADE
uniform float uClock;
varying float vBorn;
#endif
`;
export const FADE_FRAG = /* glsl */ `
#include <clipping_planes_fragment>
#ifdef BRG_FADE
{
  float brgK = clamp((uClock - vBorn) / ${FADE_S.toFixed(2)}, 0.0, 1.0);
  // interleaved gradient noise: an even dither without a visible pattern
  float brgB = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  if (brgK < 1.0 && brgB >= brgK) discard;
}
#endif
`;

// The building material: vertex colours, the window grid, night lights.
// fade: the streamed-tile variant (BRG_FADE, aBorn, uClock); a separate
// program, so the core's shader stays exactly as it was.
export function createBuildingMaterial({ fade = false } = {}) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  material.name = fade ? 'buildings-tiles' : 'buildings';
  if (fade) material.defines = { BRG_FADE: '' };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, BUILDING_UNIFORMS);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WIN_PARS}\n${FADE_VERT_PARS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvWall = aWall;\n${FADE_VERT}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${WIN_FRAG_PARS}\n${FADE_FRAG_PARS}`)
      .replace('#include <clipping_planes_fragment>', FADE_FRAG)
      .replace('#include <emissivemap_fragment>', WIN_FRAG);
  };
  return material;
}

// masks: { outlines: [[{x,z}]], plans: [{cx,cz,ux,uz,hu,hv}] } in world units
export function buildBuildings(data, project, heightAt, masks = { outlines: [], plans: [] }) {
  const group = new THREE.Group();
  group.name = 'buildings';
  const stats = { input: 0, built: 0, skippedOutline: 0, skippedPlan: 0, droppedSmall: 0, degenerate: 0, tiles: 0, triangles: 0, vertices: 0 };
  const list = data?.buildings;
  if (!Array.isArray(list) || !list.length) return { group, stats, material: null };
  stats.input = list.length;

  const outlineBoxes = masks.outlines.map((poly) => {
    const xs = poly.map((p) => p.x);
    const zs = poly.map((p) => p.z);
    return { poly, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
  });

  // --- pass 1: project, clean, classify
  const items = [];
  let tris = 0;
  for (let bi = 0; bi < list.length; bi++) {
    const b = list[bi];
    if (!Array.isArray(b.p) || b.p.length < 3 || !(b.h > 0)) {
      stats.degenerate++;
      continue;
    }
    let pts = b.p.map((q) => project(q[0], q[1]));
    // drop a closing duplicate and zero-length edges
    pts = pts.filter((p, i) => {
      const n = pts[(i + 1) % pts.length];
      return Math.hypot(n.x - p.x, n.z - p.z) > 1e-4;
    });
    if (pts.length < 3) {
      stats.degenerate++;
      continue;
    }
    let area2 = 0;
    let cx = 0;
    let cz = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const c = pts[(i + 1) % pts.length];
      area2 += a.x * c.z - c.x * a.z;
      cx += a.x;
      cz += a.z;
    }
    cx /= pts.length;
    cz /= pts.length;
    if (Math.abs(area2) < 1e-6) {
      stats.degenerate++;
      continue;
    }
    if (outlineBoxes.some((o) => cx >= o.x0 && cx <= o.x1 && cz >= o.z0 && cz <= o.z1 && inPoly(cx, cz, o.poly))) {
      stats.skippedOutline++;
      continue;
    }
    if (masks.plans.some((r) => inRect(cx, cz, r))) {
      stats.skippedPlan++;
      continue;
    }
    if (area2 < 0) pts.reverse(); // positive area: (dz, -dx) is the outward normal
    const areaM2 = Math.abs(area2) / 2 / (S * S);
    const n = pts.length;
    const t = 2 * n + (n - 2);
    tris += t;
    items.push({ pts, cx, cz, h: b.h, k: b.k, areaM2, far: Math.hypot(cx, cz) / S > FAR_M, tris: t, seed: bi });
  }

  let keep = items;
  if (tris > MAX_TRIS) {
    keep = items.filter((it) => !(it.far && it.areaM2 < SMALL_M2));
    stats.droppedSmall = items.length - keep.length;
    console.info(`[braga] buildings: ${tris} triangles > ${MAX_TRIS}; dropped ${stats.droppedSmall} buildings < ${SMALL_M2} m² beyond ${FAR_M} m`);
  }

  // --- pass 2: geometry per tile
  const tiles = new Map();
  const tileOf = (it) => {
    const key = `${Math.floor(it.cx / S / TILE_M)},${Math.floor(it.cz / S / TILE_M)}`;
    let t = tiles.get(key);
    if (!t) tiles.set(key, (t = { key, pos: [], nor: [], col: [], wall: [], idx: [], roofs: { pos: [], nor: [], col: [], wall: [], idx: [] } }));
    return t;
  };
  for (const it of keep) {
    const T = tileOf(it);
    extrudeBuilding(T, it.pts, it.h, it.k, it.areaM2, it.seed, heightAt);
    extrudeBuilding(T.roofs, it.pts, it.h, it.k, it.areaM2, it.seed, heightAt, true);
    stats.built++;
  }

  const material = createBuildingMaterial();
  for (const T of tiles.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(T.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(T.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(T.col, 3));
    g.setAttribute('aWall', new THREE.Float32BufferAttribute(T.wall, 4));
    g.setIndex(T.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    const mesh = new THREE.Mesh(g, material);
    mesh.name = `buildings-${T.key}`;
    mesh.userData.full = g;
    if (T.roofs.idx.length) {
      const r = new THREE.BufferGeometry();
      r.setAttribute('position', new THREE.Float32BufferAttribute(T.roofs.pos, 3));
      r.setAttribute('normal', new THREE.Float32BufferAttribute(T.roofs.nor, 3));
      r.setAttribute('color', new THREE.Float32BufferAttribute(T.roofs.col, 3));
      r.setAttribute('aWall', new THREE.Float32BufferAttribute(T.roofs.wall, 4));
      r.setIndex(T.roofs.idx);
      r.boundingSphere = g.boundingSphere;
      r.boundingBox = g.boundingBox;
      mesh.userData.roofs = r;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    stats.tiles++;
    stats.triangles += T.idx.length / 3;
    stats.vertices += T.pos.length / 3;
  }
  // Very far tiles draw their roofs only: a tile wholly beyond 6 km from the
  // camera (`cam`) and 3 km from the focus. Called by src/tiles.js.
  const VFAR = 6000 * S;
  const KEEP = 3000 * S;
  group.userData.updateLod = (cam, focus) => {
    for (const mesh of group.children) {
      const roofs = mesh.userData.roofs;
      if (!roofs) continue;
      const bs = mesh.userData.full.boundingSphere;
      const dc = Math.hypot(bs.center.x - cam.x, bs.center.y - cam.y, bs.center.z - cam.z) - bs.radius;
      const df = Math.hypot(bs.center.x - focus.x, bs.center.z - focus.z) - bs.radius;
      const now = mesh.geometry === roofs;
      const want = df > KEEP && dc > (now ? VFAR * 0.9 : VFAR);
      if (want !== now) mesh.geometry = want ? roofs : mesh.userData.full;
    }
  };
  // projected footprints, for the nature layer's masks
  return { group, stats, material, footprints: keep.map((it) => it.pts) };
}
