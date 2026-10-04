// People in the streets of the centre (streetscape.js builds where they may
// be; life.js runs them on the shared clock):
//
//   - walkers on the walk lanes: the pedestrian streets, the sidewalks and
//     paths across the squares. At a lane's end a walker steps onto a lane
//     that joins there (a hop that never crosses a carriageway or a
//     building, checked when the lanes were built) or turns back;
//   - a varied crowd: adults, children (shorter, bigger head), the elderly
//     (stooped, with a cane), shoppers carrying a bag, cyclists on a bike
//     whose legs pedal, and dogs walked on a lead beside a person;
//   - people who stay: groups standing on the squares, guests seated at the
//     café terraces, someone on a bench, and — on market days — a crowd
//     clustered around the market stalls;
//   - all of it instanced, one draw per build, with the walk cycle in the
//     vertex shader (legs and arms swing about the hip and the shoulder;
//     seated figures fold their legs; cyclists pedal). Shirt, trousers and
//     skin vary per person. How many are out follows the hour
//     (pedestrianDemand): busy at lunch and in the evening, nearly empty at
//     3 am, the São João night fuller still. Only within about 600 m of the
//     point the camera looks at.
import * as THREE from 'three';
import { S } from './geo.js';

// ------------------------------------------------------------ the hour
// share of the peak, hour by hour (value at hh:30)
const WEEKDAY = [0.2, 0.12, 0.06, 0.03, 0.03, 0.04, 0.08, 0.22, 0.42, 0.5, 0.58, 0.72, 0.96, 1, 0.78, 0.6, 0.62, 0.74, 0.86, 0.88, 0.8, 0.66, 0.46, 0.3];
const WEEKEND = [0.32, 0.22, 0.12, 0.06, 0.03, 0.03, 0.05, 0.1, 0.2, 0.36, 0.55, 0.74, 0.92, 0.96, 0.82, 0.72, 0.74, 0.8, 0.86, 0.92, 0.9, 0.8, 0.64, 0.46];
// São João (night of 23 to 24 June): the city is out all night
const SAO_JOAO = [1.25, 1.15, 0.95, 0.7, 0.42, 0.22, 0.12, 0.15, 0.3, 0.45, 0.6, 0.75, 0.95, 1, 0.9, 0.85, 0.95, 1.1, 1.25, 1.35, 1.45, 1.5, 1.5, 1.42];
const lerpHour = (P, hour) => {
  const h = (((hour - 0.5) % 24) + 24) % 24;
  const i = Math.floor(h);
  return P[i] + (P[(i + 1) % 24] - P[i]) * (h - i);
};
// demand 0..1.5 (1: a normal lunch hour); ymd: the Lisbon date (20260623)
export function pedestrianDemand(hour, weekend, ymd = 0) {
  const md = ymd % 10000;
  // the festival: from the afternoon of the 23rd to the morning of the 24th
  if ((md === 623 && hour >= 12) || (md === 624 && hour < 8)) return lerpHour(SAO_JOAO, hour);
  return lerpHour(weekend ? WEEKEND : WEEKDAY, hour);
}
export const DEMAND_MAX = 1.5;
// the town reads busier than the raw curve: a denser walker pool, a demand
// lift and more terrace seats taken at any hour
const DENSITY = 1.25;
const SEAT = 1.35;

// ------------------------------------------------------------ the figures
// metres, standing on y = 0, facing +z; aPart: 0 shirt, 1 / 2 legs, 3 / 4
// arms, 5 skin, 6 hair, 7 both legs (light mode). The build bakes the
// proportions; the material's hip / shoulder pivots must match them.
const BUILDS = ['adult', 'child', 'elderly', 'shopper', 'cyclist'];
const PIVOTS = { adult: [0.86, 1.4], child: [0.5, 0.92], elderly: [0.76, 1.2], shopper: [0.86, 1.4], cyclist: [0.8, 1.4] };

function buildGeometry(build, lite) {
  const P = [];
  const N = [];
  const A = [];
  // a box from (x0, y0, z0) to (x1, y1, z1) without the faces in `skip`
  // ('bottom', 'top')
  const box = (x0, y0, z0, x1, y1, z1, part, skip = []) => {
    const faces = [
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 'top'],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], 'bottom'],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
    ];
    for (const f of faces) {
      if (f[5] && skip.includes(f[5])) continue;
      const [a, b, c, d, n] = f;
      for (const p of [a, b, c, a, c, d]) {
        P.push(p[0] * S, p[1] * S, p[2] * S);
        N.push(n[0], n[1], n[2]);
        A.push(part);
      }
    }
  };
  if (lite) {
    // one cheap figure for every build (light mode)
    box(-0.17, 0, -0.08, 0.17, 0.84, 0.08, 7, ['bottom', 'top']);
    box(-0.19, 0.84, -0.11, 0.19, 1.44, 0.11, 0, ['bottom']);
    box(-0.1, 1.44, -0.1, 0.1, 1.7, 0.11, 5, ['bottom']);
  } else if (build === 'child') {
    box(-0.11, 0, -0.06, -0.015, 0.5, 0.06, 1, ['top']);
    box(0.015, 0, -0.06, 0.11, 0.5, 0.06, 2, ['top']);
    box(-0.145, 0.48, -0.09, 0.145, 0.92, 0.09, 0, ['bottom']);
    box(-0.225, 0.5, -0.045, -0.15, 0.9, 0.045, 3);
    box(0.15, 0.5, -0.045, 0.225, 0.9, 0.045, 4);
    box(-0.12, 0.92, -0.12, 0.12, 1.2, 0.12, 5, ['bottom']);
    box(-0.126, 1.14, -0.126, 0.126, 1.27, 0.1, 6, ['bottom']);
  } else if (build === 'elderly') {
    box(-0.15, 0, -0.07, -0.02, 0.76, 0.07, 1, ['top']);
    box(0.02, 0, -0.07, 0.15, 0.76, 0.07, 2, ['top']);
    box(-0.19, 0.74, -0.08, 0.19, 1.28, 0.14, 0, ['bottom']);
    box(-0.27, 0.78, -0.02, -0.19, 1.2, 0.1, 3);
    box(0.19, 0.78, -0.02, 0.27, 1.2, 0.1, 4);
    box(-0.09, 1.26, -0.04, 0.09, 1.46, 0.16, 5, ['bottom']);
    box(-0.1, 1.42, -0.05, 0.1, 1.52, 0.13, 6, ['bottom']);
    box(0.27, 0, 0.1, 0.31, 0.9, 0.15, 6); // the cane
  } else if (build === 'cyclist') {
    // the bike: frame, wheels and bars, dark (part 6)
    box(-0.035, 0, 0.5, 0.035, 0.34, 0.58, 6);
    box(-0.035, 0, -0.58, 0.035, 0.34, -0.5, 6);
    box(-0.04, 0.3, -0.52, 0.04, 0.72, 0.55, 6);
    box(-0.24, 0.72, 0.5, 0.24, 0.78, 0.58, 6);
    box(-0.08, 0.78, -0.24, 0.08, 0.83, 0.02, 6);
    // the rider, leaning forward: torso, pedalling legs, arms to the bars, head
    box(-0.16, 0.82, -0.02, 0.16, 1.34, 0.3, 0);
    box(-0.16, 0.3, -0.05, -0.02, 0.82, 0.3, 1);
    box(0.02, 0.3, -0.05, 0.16, 0.82, 0.3, 2);
    box(-0.22, 0.76, 0.26, -0.16, 1.3, 0.54, 5);
    box(0.16, 0.76, 0.26, 0.22, 1.3, 0.54, 5);
    box(-0.09, 1.32, 0.28, 0.09, 1.52, 0.48, 5, ['bottom']);
    box(-0.1, 1.48, 0.28, 0.1, 1.58, 0.44, 6, ['bottom']);
  } else {
    // adult (also the shopper, with a bag)
    box(-0.155, 0, -0.075, -0.02, 0.86, 0.075, 1, ['top']);
    box(0.02, 0, -0.075, 0.155, 0.86, 0.075, 2, ['top']);
    box(-0.185, 0.84, -0.11, 0.185, 1.43, 0.11, 0, ['bottom']);
    box(-0.28, 0.86, -0.05, -0.19, 1.42, 0.05, 3);
    box(0.19, 0.86, -0.05, 0.28, 1.42, 0.05, 4);
    box(-0.095, 1.43, -0.1, 0.095, 1.66, 0.11, 5, ['bottom']);
    box(-0.105, 1.6, -0.115, 0.105, 1.71, 0.09, 6, ['bottom']);
    if (build === 'shopper') box(0.24, 0.5, -0.13, 0.37, 0.92, 0.13, 6, ['bottom']); // a bag in the right hand
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 1));
  g.computeBoundingSphere();
  return g;
}

const SHIRTS = [0xf2efe8, 0x23324f, 0x1c1c1e, 0x9b2c2c, 0xc99a2e, 0x2f7f7a, 0x8b8f94, 0xc9b79a, 0x5c6b3a, 0x7fa6c9, 0x6b2737, 0xd78ca0, 0x3d6fb0, 0xe2d37a].map((h) => new THREE.Color(h));
const PANTS = [0x2c3e5c, 0x1b1c1f, 0xb9a98a, 0x55585c, 0x4a3b2e, 0x3b4f70, 0x262a33].map((h) => new THREE.Color(h));
const FURS = [0x8a5a2b, 0x2b2622, 0xd8c8a8, 0x6b6b68, 0xb8863b, 0xf0ece2].map((h) => new THREE.Color(h));

function peopleMaterial(uniforms, hipM, shoulderM) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.customProgramCacheKey = () => `people-walk:${hipM}:${shoulderM}`;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPTime = uniforms.uPTime;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uPTime;
attribute float aPart;
attribute vec4 iAnim; // phase, walking 0..1, seated 0..1, cadence
attribute vec4 iLook; // trousers rgb, skin 0..2
vec3 rotX(vec3 p, float pivot, float a) {
  float y = p.y - pivot;
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, pivot + y * c - p.z * s, y * s + p.z * c);
}`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
{
  float walk = iAnim.y;
  float sit = iAnim.z;
  float ph = uPTime * 6.4 * iAnim.w + iAnim.x;
  float sw = sin(ph) * 0.52 * walk;
  float isL = 1.0 - step(0.5, abs(aPart - 1.0));
  float isR = 1.0 - step(0.5, abs(aPart - 2.0));
  float isAL = 1.0 - step(0.5, abs(aPart - 3.0));
  float isAR = 1.0 - step(0.5, abs(aPart - 4.0));
  // standing: a slow gesture now and then
  float idle = (1.0 - walk) * (1.0 - sit) * 0.12 * max(0.0, sin(uPTime * 0.7 + iAnim.x * 3.0));
  // legs forward (-angle) about the hip; seated: thighs folded forward
  float legA = isL * (-sw) + isR * sw - (isL + isR) * sit * 1.25;
  transformed = rotX(transformed, ${(hipM * S).toFixed(5)}, legA);
  float armA = isAL * (sw * 0.8 - idle) + isAR * (-sw * 0.8) - (isAL + isAR) * sit * 0.5;
  transformed = rotX(transformed, ${(shoulderM * S).toFixed(5)}, armA);
  transformed.y += walk * abs(sin(ph)) * ${(0.03 * S).toFixed(5)} - sit * ${(0.4 * S).toFixed(5)};
}`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
{
  // the instance colour is the shirt; trousers and skin per instance too
  float pt = aPart;
  vec3 skin = iLook.w < 0.5 ? vec3(0.62, 0.42, 0.31) : iLook.w < 1.5 ? vec3(0.42, 0.26, 0.17) : vec3(0.2, 0.12, 0.08);
  vec3 hair = iLook.w < 0.5 ? vec3(0.09, 0.06, 0.04) : iLook.w < 1.5 ? vec3(0.03, 0.025, 0.02) : vec3(0.02, 0.02, 0.02);
  vec3 shirt = vec3(1.0);
#ifdef USE_INSTANCING_COLOR
  shirt = instanceColor.rgb;
#endif
  vColor = vec4(pt < 0.5 || (pt > 2.5 && pt < 4.5) ? shirt : (pt < 2.5 || pt > 6.5) ? iLook.rgb : pt < 5.5 ? skin : hair, 1.0);
}`,
      );
  };
  return mat;
}

// a small dog: body, head, snout, four legs, a tail and a lead rising back to
// the walker's hand. Legs are parts 1/2 (back, 3/4 front) for the trot.
function dogGeometry() {
  const P = [];
  const N = [];
  const A = [];
  const box = (x0, y0, z0, x1, y1, z1, part) => {
    const faces = [
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
    ];
    for (const f of faces) {
      const [a, b, c, d, n] = f;
      for (const p of [a, b, c, a, c, d]) {
        P.push(p[0] * S, p[1] * S, p[2] * S);
        N.push(n[0], n[1], n[2]);
        A.push(part);
      }
    }
  };
  box(-0.09, 0.22, -0.22, 0.09, 0.4, 0.22, 0);
  box(-0.075, 0.3, 0.18, 0.075, 0.46, 0.38, 0);
  box(-0.045, 0.3, 0.34, 0.045, 0.4, 0.46, 0);
  box(-0.075, 0.3, -0.22, -0.02, 0.36, -0.36, 0);
  for (const [x0, x1, z, part] of [
    [-0.085, -0.035, -0.16, 1],
    [0.035, 0.085, -0.16, 2],
    [-0.085, -0.035, 0.14, 3],
    [0.035, 0.085, 0.14, 4],
  ]) box(x0, 0, z - 0.035, x1, 0.25, z + 0.035, part);
  box(-0.012, 0.4, -0.1, 0.012, 0.85, -0.05, 0); // the lead
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(A, 1));
  g.computeBoundingSphere();
  return g;
}

function dogMaterial(uniforms) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
  mat.customProgramCacheKey = () => 'people-dog';
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uPTime = uniforms.uPTime;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uPTime;
attribute float aPart;
attribute vec4 iAnim;
vec3 rotX(vec3 p, float pivot, float a) {
  float y = p.y - pivot;
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, pivot + y * c - p.z * s, y * s + p.z * c);
}`,
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
{
  float ph = uPTime * 8.0 * iAnim.w + iAnim.x;
  float sw = sin(ph) * 0.5;
  float back = 1.0 - step(0.5, abs(aPart - 1.0)) + 1.0 - step(0.5, abs(aPart - 2.0));
  float front = 1.0 - step(0.5, abs(aPart - 3.0)) + 1.0 - step(0.5, abs(aPart - 4.0));
  transformed = rotX(transformed, ${(0.25 * S).toFixed(5)}, (front - back) * sw * 0.7);
  transformed.y += (front + back) * abs(sin(ph)) * ${(0.015 * S).toFixed(5)};
}`,
      );
  };
  return mat;
}

function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function makePool(name, geo, cap, material, seedColor) {
  const iAnim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iLook = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iAnim', iAnim);
  geo.setAttribute('iLook', iLook);
  const mesh = new THREE.InstancedMesh(geo, material, cap);
  mesh.name = name === 'dog' ? 'dogs' : `people-${name}`;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.visible = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, seedColor);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  return { name, geo, mesh, iAnim, iLook, E: mesh.instanceMatrix.array, C: mesh.instanceColor.array, IA: iAnim.array, IL: iLook.array, cap, count: 0 };
}

const MARKET_KIND = 3; // a spot that only stands on market days
const MAX_MARKET = 500;

// lanes (streetscape.js): { X, Z, Y, H (half width per sample), start, n,
//   type, weight, sampleLane, linkStart, links, nLanes }
// spots: { x, y, z, yaw, sit, t, kind, ref } arrays
export function createPeople({ lanes, spots, max, lite, shadows = false }) {
  const uniforms = { uPTime: { value: 0 } };
  const group = new THREE.Group();
  group.name = 'people';

  const builds = lite ? ['adult'] : BUILDS;
  const pools = {};
  for (const b of builds) {
    const [hip, shoulder] = PIVOTS[b] || PIVOTS.adult;
    const pool = makePool(b, buildGeometry(b, lite), max, peopleMaterial(uniforms, hip, shoulder), SHIRTS[0]);
    pools[b] = pool;
    group.add(pool.mesh);
  }
  // every human kind routes to a build (all to the one cheap build in lite)
  const POOL_OF_KIND = ['adult', 'child', 'elderly', 'shopper', 'cyclist'].map((b) => (lite ? 'adult' : b));
  const STATURE = { adult: [0.96, 1.05], child: [0.94, 1.06], elderly: [0.97, 1.03], shopper: [0.96, 1.05], cyclist: [1, 1] };
  const SPEED = { adult: 1, child: 0.85, elderly: 0.72, shopper: 0.95, cyclist: 1.9 };
  const CAD = { adult: 1, child: 1.25, elderly: 0.85, shopper: 1, cyclist: 0.9 };

  const { X, Z, Y, H, start: LS, n: LN, sampleLane, linkStart, links } = lanes;
  const W = lanes.weight;
  const nS = X.length;
  // ---- walkers: 3/4 of the people at the peak of a festival night
  const NW = lanes.nLanes ? Math.round(max * 0.85) : 0;
  const rnd = lcg(1806);
  const wl = new Int32Array(NW); // lane
  const ws = new Float32Array(NW); // position in samples along the lane
  const wd = new Int8Array(NW); // direction +1 / -1
  const wv = new Float32Array(NW); // speed (samples / s)
  const wf = new Float32Array(NW); // lateral place -1..1 of the half width
  const wph = new Float32Array(NW);
  const wcad = new Float32Array(NW);
  const wshirt = new Uint8Array(NW);
  const wpants = new Uint8Array(NW);
  const wskin = new Uint8Array(NW);
  const wsc = new Float32Array(NW);
  const wst = new Float32Array(NW);
  const wkind = new Uint8Array(NW);
  // a hop between lanes: from (hx, hz, hy) to sample wt, t in world units left
  const whop = new Uint8Array(NW);
  const whx = new Float32Array(NW);
  const whz = new Float32Array(NW);
  const why = new Float32Array(NW);
  const wt = new Int32Array(NW);
  const STEP = lanes.step; // world units between samples
  const BASEV = (1.35 * S) / STEP;
  for (let i = 0; i < NW; i++) {
    const r = rnd();
    const kind = r < 0.56 ? 0 : r < 0.71 ? 3 : r < 0.84 ? 1 : r < 0.94 ? 2 : 4;
    wkind[i] = kind;
    const b = POOL_OF_KIND[kind];
    const sp = STATURE[b];
    wph[i] = rnd() * 6.283;
    wv[i] = ((1.15 + rnd() * 0.4) * SPEED[b] * S) / STEP;
    wcad[i] = (0.9 + rnd() * 0.2) * CAD[b] * (wv[i] / BASEV);
    wf[i] = rnd() * 2 - 1;
    wshirt[i] = Math.floor(rnd() * SHIRTS.length);
    wpants[i] = Math.floor(rnd() * PANTS.length);
    wskin[i] = rnd() < 0.78 ? 0 : rnd() < 0.6 ? 1 : 2;
    wsc[i] = 0.92 + rnd() * 0.16;
    wst[i] = sp[0] + rnd() * (sp[1] - sp[0]);
  }

  // ---- spawning near the focus: the samples within R, weighted by type
  const CELL = 16;
  const cells = new Map();
  for (let k = 0; k < nS; k++) {
    const key = Math.floor(X[k] / CELL) * 65536 + Math.floor(Z[k] / CELL);
    let c = cells.get(key);
    if (!c) cells.set(key, (c = []));
    c.push(k);
  }
  let cand = new Int32Array(0);
  let candN = 0;
  let candX = Infinity;
  let candZ = Infinity;
  function gather(fx, fz, R) {
    candX = fx;
    candZ = fz;
    const out = [];
    const R2 = R * R;
    for (let gx = Math.floor((fx - R) / CELL); gx <= Math.floor((fx + R) / CELL); gx++) {
      for (let gz = Math.floor((fz - R) / CELL); gz <= Math.floor((fz + R) / CELL); gz++) {
        const c = cells.get(gx * 65536 + gz);
        if (!c) continue;
        for (const k of c) if ((X[k] - fx) ** 2 + (Z[k] - fz) ** 2 < R2) out.push(k);
      }
    }
    cand = Int32Array.from(out);
    candN = cand.length;
  }
  function place(i) {
    if (!candN) return false;
    // a third walk in twos and threes: share a lane, speed and direction
    // with an earlier walker, keeping a lateral and along-lane offset
    if (i > 0 && rnd() < 0.32) {
      const a = Math.floor(rnd() * i);
      const la = wl[a];
      if (ws[a] < LN[la] - 1 && !whop[a]) {
        wl[i] = la;
        wd[i] = wd[a];
        ws[i] = Math.min(LN[la] - 1, Math.max(0, ws[a] + (rnd() - 0.5) * 1.6));
        wv[i] = wv[a];
        wf[i] = Math.max(-1, Math.min(1, wf[a] + (rnd() < 0.5 ? -1 : 1) * (0.42 + rnd() * 0.34)));
        whop[i] = 0;
        return true;
      }
    }
    // rejection by the lane's weight (pedestrian streets 3, squares 2.5 ...)
    let k = cand[Math.floor(rnd() * candN)];
    for (let g = 0; g < 6; g++) {
      if (rnd() * 3 < W[sampleLane[k]]) break;
      k = cand[Math.floor(rnd() * candN)];
    }
    const l = sampleLane[k];
    wl[i] = l;
    ws[i] = k - LS[l] + rnd() * 0.9;
    if (ws[i] > LN[l] - 1) ws[i] = LN[l] - 1;
    wd[i] = rnd() < 0.5 ? 1 : -1;
    whop[i] = 0;
    return true;
  }

  // at the end of lane l (end 0 or 1): a joined lane, or back
  function turn(i, end) {
    const l = wl[i];
    const a = linkStart[l * 2 + end];
    const b = linkStart[l * 2 + end + 1];
    if (b > a && rnd() > 0.12) {
      const k = links[a + Math.floor(rnd() * (b - a))];
      const s = end ? LN[l] - 1 : 0;
      const g = LS[l] + s;
      whx[i] = X[g];
      whz[i] = Z[g];
      why[i] = Y[g];
      wt[i] = k;
      whop[i] = 1;
      return;
    }
    wd[i] = end ? -1 : 1;
    ws[i] = end ? LN[l] - 1 : 0;
  }
  function step(i, dt) {
    if (whop[i]) {
      const k = wt[i];
      const dx = X[k] - whx[i];
      const dz = Z[k] - whz[i];
      const d = Math.hypot(dx, dz);
      const mv = wv[i] * STEP * dt;
      if (d <= mv) {
        const l = sampleLane[k];
        wl[i] = l;
        ws[i] = k - LS[l];
        wd[i] = ws[i] < 0.5 ? 1 : ws[i] > LN[l] - 1.5 ? -1 : rnd() < 0.5 ? 1 : -1;
        whop[i] = 0;
      } else {
        whx[i] += (dx / d) * mv;
        whz[i] += (dz / d) * mv;
        why[i] += (Y[k] - why[i]) * Math.min(1, mv / d);
      }
      return;
    }
    const l = wl[i];
    let s = ws[i] + wd[i] * wv[i] * dt;
    if (s < 0) turn(i, 0);
    else if (s > LN[l] - 1) turn(i, 1);
    else ws[i] = s;
  }
  const pos = { x: 0, y: 0, z: 0, hx: 0, hz: 1 };
  function locate(i) {
    if (whop[i]) {
      const k = wt[i];
      const dx = X[k] - whx[i];
      const dz = Z[k] - whz[i];
      const d = Math.hypot(dx, dz) || 1;
      pos.x = whx[i];
      pos.z = whz[i];
      pos.y = why[i];
      pos.hx = dx / d;
      pos.hz = dz / d;
      return pos;
    }
    const l = wl[i];
    const s = ws[i];
    let a = Math.floor(s);
    if (a >= LN[l] - 1) a = LN[l] - 2;
    if (a < 0) a = 0;
    const u = Math.min(1, Math.max(0, s - a));
    const g = LS[l] + a;
    const tx = X[g + 1] - X[g];
    const tz = Z[g + 1] - Z[g];
    const L = Math.hypot(tx, tz) || 1;
    const h = (H[g] + (H[g + 1] - H[g]) * u) * wf[i];
    // right of travel along the lane: (-tz, tx)
    pos.x = X[g] + tx * u - (tz / L) * h;
    pos.z = Z[g] + tz * u + (tx / L) * h;
    pos.y = Y[g] + (Y[g + 1] - Y[g]) * u;
    pos.hx = (tx / L) * wd[i];
    pos.hz = (tz / L) * wd[i];
    return pos;
  }

  // ---- the people who stay (groups, terrace seats, benches, market crowd)
  const NSP = spots.x.length;
  const CAP = NSP + MAX_MARKET;
  spots.cap = CAP;
  const sShirt = new Uint8Array(CAP);
  const sPants = new Uint8Array(CAP);
  const sSkin = new Uint8Array(CAP);
  const sBuild = new Uint8Array(CAP);
  const sStature = new Float32Array(CAP);
  const sPh = new Float32Array(CAP);
  const sSc = new Float32Array(CAP);
  let nSpots = NSP;
  let marketSpots = 0;
  const spotCells = new Map();
  function indexSpot(i, key) {
    let c = spotCells.get(key);
    if (!c) spotCells.set(key, (c = []));
    c.push(i);
  }
  for (let i = 0; i < NSP; i++) {
    const r = rnd();
    sBuild[i] = r < 0.6 ? 0 : r < 0.74 ? 3 : r < 0.86 ? 1 : 2;
    sStature[i] = 0.96 + rnd() * 0.08;
    sShirt[i] = Math.floor(rnd() * SHIRTS.length);
    sPants[i] = Math.floor(rnd() * PANTS.length);
    sSkin[i] = rnd() < 0.78 ? 0 : rnd() < 0.6 ? 1 : 2;
    sPh[i] = rnd() * 6.283;
    sSc[i] = 0.92 + rnd() * 0.16;
    const key = Math.floor(spots.x[i] / CELL) * 65536 + Math.floor(spots.z[i] / CELL);
    indexSpot(i, key);
  }
  // market crowd: denser around each stall, only shown on market days
  function addMarket(stalls) {
    if (!Array.isArray(stalls) || !stalls.length) return;
    for (const st of stalls) {
      if (!st) continue;
      // the nearest walkable lane sample: the ground under the stall
      let bk = -1;
      let bd = Infinity;
      for (let k = 0; k < nS; k++) {
        if (W[sampleLane[k]] < 1.5) continue;
        const d = (X[k] - st.x) ** 2 + (Z[k] - st.z) ** 2;
        if (d < bd) {
          bd = d;
          bk = k;
        }
      }
      if (bk < 0 || bd > 49) continue; // within 7 world units
      const y = Y[bk];
      const n = 5 + Math.floor(rnd() * 5);
      for (let q = 0; q < n && nSpots < CAP; q++) {
        const a = rnd() * Math.PI * 2;
        const rr = (0.4 + rnd() * 1.6) * S;
        const x = st.x + Math.cos(a) * rr;
        const z = st.z + Math.sin(a) * rr;
        const i = nSpots++;
        spots.x.push(x);
        spots.y.push(y);
        spots.z.push(z);
        spots.yaw.push(rnd() * Math.PI * 2);
        spots.sit.push(0);
        spots.t.push(rnd() * 0.85);
        spots.kind.push(MARKET_KIND);
        spots.ref.push(-1);
        const r = rnd();
        sBuild[i] = r < 0.5 ? 0 : r < 0.72 ? 3 : r < 0.88 ? 1 : 2;
        sStature[i] = 0.96 + rnd() * 0.08;
        sShirt[i] = Math.floor(rnd() * SHIRTS.length);
        sPants[i] = Math.floor(rnd() * PANTS.length);
        sSkin[i] = rnd() < 0.78 ? 0 : rnd() < 0.6 ? 1 : 2;
        sPh[i] = rnd() * 6.283;
        sSc[i] = 0.92 + rnd() * 0.16;
        indexSpot(i, Math.floor(x / CELL) * 65536 + Math.floor(z / CELL));
        marketSpots++;
      }
    }
  }

  // ---- dogs: a small follower pool, each tethered to a walker
  const ND = lite ? 0 : Math.round(NW * 0.09);
  let dogPool = null;
  const dOwner = new Int32Array(ND).fill(-1);
  const dSide = new Int8Array(ND);
  const dPh = new Float32Array(ND);
  const dCad = new Float32Array(ND);
  const dSc = new Float32Array(ND);
  const dFur = new Uint8Array(ND);
  if (ND) {
    dogPool = makePool('dog', dogGeometry(), ND, dogMaterial(uniforms), FURS[0]);
    group.add(dogPool.mesh);
    for (let i = 0; i < ND; i++) {
      dSide[i] = rnd() < 0.5 ? -1 : 1;
      dPh[i] = rnd() * 6.283;
      dCad[i] = 0.95 + rnd() * 0.3;
      dSc[i] = 0.85 + rnd() * 0.35;
      dFur[i] = Math.floor(rnd() * FURS.length);
    }
  }

  function write(pool, x, y, z, hx, hz, sc, stature, shirt, pants, skin, ph, walk, sit, cad) {
    const n = pool.count;
    if (n >= pool.cap) return;
    const E = pool.E;
    const o = n * 16;
    // +z of the figure along (hx, hz); uniform scale, stature along y
    E[o] = hz * sc;
    E[o + 1] = 0;
    E[o + 2] = -hx * sc;
    E[o + 3] = 0;
    E[o + 4] = 0;
    E[o + 5] = sc * stature;
    E[o + 6] = 0;
    E[o + 7] = 0;
    E[o + 8] = hx * sc;
    E[o + 9] = 0;
    E[o + 10] = hz * sc;
    E[o + 11] = 0;
    E[o + 12] = x;
    E[o + 13] = y;
    E[o + 14] = z;
    E[o + 15] = 1;
    const c = SHIRTS[shirt];
    pool.C[n * 3] = c.r;
    pool.C[n * 3 + 1] = c.g;
    pool.C[n * 3 + 2] = c.b;
    const p = PANTS[pants];
    pool.IL[n * 4] = p.r;
    pool.IL[n * 4 + 1] = p.g;
    pool.IL[n * 4 + 2] = p.b;
    pool.IL[n * 4 + 3] = skin;
    pool.IA[n * 4] = ph;
    pool.IA[n * 4 + 1] = walk;
    pool.IA[n * 4 + 2] = sit;
    pool.IA[n * 4 + 3] = cad;
    pool.count = n + 1;
  }

  function writeDog(x, y, z, hx, hz, sc, ph, cad, fur) {
    const pool = dogPool;
    const n = pool.count;
    if (n >= pool.cap) return;
    const E = pool.E;
    const o = n * 16;
    E[o] = hz * sc;
    E[o + 1] = 0;
    E[o + 2] = -hx * sc;
    E[o + 3] = 0;
    E[o + 4] = 0;
    E[o + 5] = sc;
    E[o + 6] = 0;
    E[o + 7] = 0;
    E[o + 8] = hx * sc;
    E[o + 9] = 0;
    E[o + 10] = hz * sc;
    E[o + 11] = 0;
    E[o + 12] = x;
    E[o + 13] = y;
    E[o + 14] = z;
    E[o + 15] = 1;
    const c = FURS[fur];
    pool.C[n * 3] = c.r;
    pool.C[n * 3 + 1] = c.g;
    pool.C[n * 3 + 2] = c.b;
    pool.IA[n * 4] = ph;
    pool.IA[n * 4 + 1] = 1;
    pool.IA[n * 4 + 2] = 0;
    pool.IA[n * 4 + 3] = cad;
    pool.count = n + 1;
  }

  function inView(frustum, x, y, z, r) {
    const p = frustum.planes;
    for (let k = 0; k < 6; k++) if (p[k].normal.x * x + p[k].normal.y * y + p[k].normal.z * z + p[k].constant < -r) return false;
    return true;
  }

  let active = 0;
  let shown = 0;
  let shownWalkers = 0;
  let shownStaying = 0;
  let shownDogs = 0;
  let time = 0;
  let wasOn = false;
  let marketOpen = false;
  let onFrame = false;
  // focus: where the camera looks (world); R: the radius (world) people
  // live in; demand 0..DEMAND_MAX; spotOk(i) -> may spot i be taken now
  function update(dt, camera, frustum, { fx, fz, R, on, demand, spotOk, camDist }) {
    time += dt;
    uniforms.uPTime.value = time;
    onFrame = on;
    group.visible = on;
    if (!on) {
      wasOn = false;
      shown = 0;
      for (const b of builds) pools[b].count = 0;
      if (dogPool) dogPool.count = 0;
      return;
    }
    // re-gather the spawn samples when the focus moved
    const moved = (fx - candX) ** 2 + (fz - candZ) ** 2;
    if (moved > 12 * 12) gather(fx, fz, R);
    const want = Math.min(NW, Math.round((NW * Math.min(DEMAND_MAX, demand * DENSITY)) / DEMAND_MAX));
    // after a jump (or the first time) everyone is placed anew
    if (!wasOn || moved > R * R * 0.25) {
      for (let i = 0; i < want; i++) place(i);
    } else for (let i = active; i < want; i++) place(i);
    active = want;
    wasOn = true;
    for (const b of builds) pools[b].count = 0;
    if (dogPool) dogPool.count = 0;
    const cx = camera.position.x;
    const cz = camera.position.z;
    const R2 = R * R;
    const RV2 = (R * 1.05) ** 2;
    let n = 0;
    shownWalkers = 0;
    for (let i = 0; i < active; i++) {
      if (dt > 0) step(i, dt);
      const p = locate(i);
      const d2 = (p.x - fx) ** 2 + (p.z - fz) ** 2;
      if (d2 > R2) {
        // walked out of the circle: back in somewhere near the focus
        place(i);
        continue;
      }
      if (n >= max || (p.x - cx) ** 2 + (p.z - cz) ** 2 > RV2 * 1.6 || !inView(frustum, p.x, p.y + 0.2, p.z, 0.6)) continue;
      const b = POOL_OF_KIND[wkind[i]];
      write(pools[b], p.x, p.y, p.z, p.hx, p.hz, wsc[i], wst[i], wshirt[i], wpants[i], wskin[i], wph[i], 1, 0, wcad[i]);
      shownWalkers++;
      n++;
    }
    // the people who stay, nearest cells first is not needed: the cap is high
    shownStaying = 0;
    const share = Math.min(1, (demand / DEMAND_MAX) * SEAT);
    for (let gx = Math.floor((fx - R) / CELL); gx <= Math.floor((fx + R) / CELL) && n < max; gx++) {
      for (let gz = Math.floor((fz - R) / CELL); gz <= Math.floor((fz + R) / CELL) && n < max; gz++) {
        const c = spotCells.get(gx * 65536 + gz);
        if (!c) continue;
        for (const i of c) {
          if (n >= max) break;
          if (spots.kind[i] === MARKET_KIND && !marketOpen) continue;
          const x = spots.x[i];
          const z = spots.z[i];
          if ((x - fx) ** 2 + (z - fz) ** 2 > R2) continue;
          if (spots.t[i] > share * 1.25 || !spotOk(i)) continue;
          if (!inView(frustum, x, spots.y[i] + 0.2, z, 0.6)) continue;
          const yaw = spots.yaw[i];
          const b = POOL_OF_KIND[sBuild[i]];
          write(pools[b], x, spots.y[i], z, Math.sin(yaw), Math.cos(yaw), sSc[i], sStature[i], sShirt[i], sPants[i], sSkin[i], sPh[i], 0, spots.sit[i], 1);
          shownStaying++;
          n++;
        }
      }
    }
    // dogs: each follows a walker, at the walker's side and a little ahead
    shownDogs = 0;
    if (dogPool) {
      for (let i = 0; i < ND; i++) {
        if (dogPool.count >= dogPool.cap) break;
        let owner = dOwner[i];
        if (owner < 0 || owner >= active || wkind[owner] === 4) {
          // pick the next walker that is not a cyclist
          let found = -1;
          for (let s = 0; s < active; s++) {
            const o = (owner + 1 + s) % active;
            if (wkind[o] !== 4) {
              found = o;
              break;
            }
          }
          if (found < 0) break;
          owner = found;
          dOwner[i] = owner;
        }
        const o = locate(owner);
        const side = dSide[i];
        const px = -o.hz;
        const pz = o.hx;
        const x = o.x + px * side * 0.22 * S + o.hx * 0.28 * S;
        const z = o.z + pz * side * 0.22 * S + o.hz * 0.28 * S;
        if ((x - fx) ** 2 + (z - fz) ** 2 > R2) continue;
        if ((x - cx) ** 2 + (z - cz) ** 2 > RV2 * 1.6 || !inView(frustum, x, o.y + 0.2, z, 0.4)) continue;
        writeDog(x, o.y, z, o.hx, o.hz, dSc[i], dPh[i], dCad[i], dFur[i]);
        shownDogs++;
      }
    }
    shown = n + shownDogs;
    for (const b of builds) {
      const pool = pools[b];
      pool.mesh.count = pool.count;
      pool.mesh.visible = pool.count > 0;
      if (pool.count) {
        pool.mesh.instanceMatrix.clearUpdateRanges();
        pool.mesh.instanceMatrix.addUpdateRange(0, pool.count * 16);
        pool.mesh.instanceMatrix.needsUpdate = true;
        pool.mesh.instanceColor.clearUpdateRanges();
        pool.mesh.instanceColor.addUpdateRange(0, pool.count * 3);
        pool.mesh.instanceColor.needsUpdate = true;
        pool.iAnim.clearUpdateRanges();
        pool.iAnim.addUpdateRange(0, pool.count * 4);
        pool.iAnim.needsUpdate = true;
        pool.iLook.clearUpdateRanges();
        pool.iLook.addUpdateRange(0, pool.count * 4);
        pool.iLook.needsUpdate = true;
      }
      pool.mesh.castShadow = shadows && camDist < 160;
    }
    if (dogPool) {
      dogPool.mesh.count = dogPool.count;
      dogPool.mesh.visible = dogPool.count > 0;
      if (dogPool.count) {
        dogPool.mesh.instanceMatrix.clearUpdateRanges();
        dogPool.mesh.instanceMatrix.addUpdateRange(0, dogPool.count * 16);
        dogPool.mesh.instanceMatrix.needsUpdate = true;
        dogPool.mesh.instanceColor.clearUpdateRanges();
        dogPool.mesh.instanceColor.addUpdateRange(0, dogPool.count * 3);
        dogPool.mesh.instanceColor.needsUpdate = true;
        dogPool.iAnim.clearUpdateRanges();
        dogPool.iAnim.addUpdateRange(0, dogPool.count * 4);
        dogPool.iAnim.needsUpdate = true;
      }
      dogPool.mesh.castShadow = shadows && camDist < 120;
    }
  }

  // tests: every walker's position now, [x, z, ...] (world)
  function sampleWalkers() {
    const out = [];
    for (let i = 0; i < active; i++) {
      const p = locate(i);
      out.push(p.x, p.z);
    }
    return out;
  }

  return {
    object: group,
    update,
    sampleWalkers,
    addMarket,
    setMarketOpen(v) {
      marketOpen = !!v;
    },
    stats: {
      walkers: NW,
      spots: NSP,
      marketSpots,
      dogs: ND,
      builds,
      trianglesEach: pools[builds[0]].geo.attributes.position.count / 3,
    },
    get active() {
      return active;
    },
    get shown() {
      return shown;
    },
    get shownWalkers() {
      return shownWalkers;
    },
    get shownStaying() {
      return shownStaying;
    },
    get shownDogs() {
      return shownDogs;
    },
  };
}
