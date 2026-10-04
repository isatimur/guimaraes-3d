// Inland water: the Rio Este and its streams, the ponds, the Bom Jesus lake.
//
// Adapted from the 3d-ultra-realistic-water skill (MengTo, Pirate Ship
// Sunset) for small, sheltered water seen from a moving orbit camera:
//
//   - wind ripples: a sum of four Gerstner waves (2.4 .. 0.42 world units,
//     10 .. 1.7 m) shaded per pixel from their analytic derivatives. Each
//     wave fades out once its wavelength falls below the pixel footprint,
//     so the far water settles into a smooth sky reflection instead of
//     boiling into grain. The phases are wrapped to [0, 2pi) on the CPU.
//     The mesh stays flat: ripples this small only change the shading;
//   - a baked, tileable detail texture (micro normal, foam lattice, fbm),
//     carried downstream by the river's flow map;
//   - Fresnel reflection of the PMREM sky environment (MeshPhysicalMaterial,
//     ior 1.33: F0 = 0.02, as in the skill);
//   - sun glitter: the stock GGX sun highlight is replaced by the skill's
//     sheen + sparkle terms, scaled so only pin-point sparkles pass the
//     bloom threshold (no bloom blob); clamped at 2.2 linear;
//   - a shallow, greener body near the banks and lace foam along them: the
//     lattice is thresholded by a bank mask, so the foam breaks into lace
//     instead of fading to grey;
//   - rain rings when it rains (WEATHER_UNIFORMS.cloudShape.w).
//
// One material and one draw for all the water. waterUniforms are shared,
// so another basin (a fountain) can use createWaterMaterial() and move with
// the same ripples, sun and time.
import * as THREE from 'three';
import { S } from './geo.js';

const TAU = Math.PI * 2;

// Light mode (main.js): one detail octave instead of the Gerstner sum and
// two cross-faded octaves; no rain rings, no subsurface term. Set before
// the first water material is made.
let LITE = false;
export function setWaterLite(on) {
  LITE = !!on;
}
// [wavelength (world units), amplitude, heading offset from the wind (deg), steepness Q]
// Wavelengths step by ~0.6 but not in simple ratios, headings spread, so
// the crossings never lock into a lattice; slopes kA of 0.04 .. 0.05 keep
// sheltered water calm. ΣQ = 0.3, far below the skill's limit of 1.
const RIPPLES = [
  [2.7, 0.02, 0, 0.1],
  [1.61, 0.011, 31, 0.08],
  [0.93, 0.0066, -43, 0.07],
  [0.57, 0.0042, 72, 0.05],
];
const G = 9.81 * S; // gravity in world units per second squared
const WIND_HEADING = Math.atan2(0.93, -0.37); // from the Atlantic (WSW), as weather.js

// ------------------------------------------------------------ detail texture
// Baked once on the CPU (the nature layer has no renderer yet), 256 x 256:
// RG micro normal from 32 sines with integer wave vectors (tileable), B a
// foam lattice from two Worley octaves, A an fbm. Data, not colour.
function lcg(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function detailTexture(size = 256) {
  const r = lcg(71);
  const waves = [];
  for (let i = 0; i < 32; i++) {
    const a = r() * TAU;
    const kmag = Math.floor(3 + Math.pow(r(), 1.6) * 40);
    let kx = Math.round(Math.cos(a) * kmag);
    let ky = Math.round(Math.sin(a) * kmag);
    if (!kx && !ky) kx = 3;
    waves.push({ kx, ky, amp: 1 / Math.pow(Math.hypot(kx, ky), 1.35), ph: r() * TAU });
  }
  // tileable Worley: distance to the nearest two feature points
  const worley = (u, v, per, seed) => {
    const x = u * per;
    const y = v * per;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let d1 = 9;
    let d2 = 9;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = (((ix + i) % per) + per) % per;
        const cy = (((iy + j) % per) + per) % per;
        let h = Math.imul(cx * 374761393 + cy * 668265263 + seed, 1274126177) >>> 0;
        const ox = (h & 0xffff) / 65535;
        h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
        const oy = (h & 0xffff) / 65535;
        const dx = ix + i + ox - x;
        const dy = iy + j + oy - y;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
    }
    return Math.sqrt(d2) - Math.sqrt(d1);
  };
  const vgrid = (n, seed) => {
    const rr = lcg(seed);
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rr();
    return (u, v) => {
      const x = u * n;
      const y = v * n;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const tx = x - x0;
      const ty = y - y0;
      const at = (i, j) => g[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const o = [vgrid(4, 3), vgrid(8, 5), vgrid(16, 7), vgrid(32, 11)];
  const fbm = (u, v) => (0.5 * o[0](u, v) + 0.25 * o[1](u, v) + 0.15 * o[2](u, v) + 0.1 * o[3](u, v));
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let gx = 0;
      let gy = 0;
      for (const w of waves) {
        const c = Math.cos((w.kx * u + w.ky * v) * TAU + w.ph) * w.amp;
        gx += w.kx * c;
        gy += w.ky * c;
      }
      const nx = -gx * 0.2;
      const ny = -gy * 0.2;
      const l = Math.hypot(nx, ny, 1);
      const wu = u + (fbm(u, v) - 0.5) * 0.08;
      const wv = v + (fbm(v + 0.37, u) - 0.5) * 0.08;
      const w1 = worley(wu, wv, 9, 17);
      const w2 = worley(wu, wv, 21, 29);
      const sm = (a, b, t) => {
        const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
        return k * k * (3 - 2 * k);
      };
      let lace = (1 - sm(0, 0.2, w1)) * (0.6 + 0.4 * o[3](u, v));
      lace = Math.max(lace, (1 - sm(0, 0.24, w2)) * 0.7);
      const body = fbm(wu * 1.7 % 1, wv * 1.7 % 1);
      const foam = Math.min(1, Math.max(0, lace * 0.75 + body * 0.75 - 0.12));
      const i = (y * size + x) * 4;
      data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      data[i + 2] = foam * 255;
      data[i + 3] = fbm(u, v) * 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8; // grazing views over the lake
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ------------------------------------------------------------ shared uniforms
const phases = new Float32Array(RIPPLES.length);
const waveList = RIPPLES.map(([L, A, deg, Q], i) => {
  const k = TAU / L;
  const h = WIND_HEADING + (deg * Math.PI) / 180;
  const dx = Math.sin(h);
  const dz = -Math.cos(h);
  return { L, A, Q, k, omega: Math.sqrt(G * k), dx, dz, ang: Math.atan2(dz, dx), seed: (i * 2.39) % TAU };
});
export const waterUniforms = {
  uWaveDir: { value: waveList.map((w) => new THREE.Vector4(w.dx, w.dz, w.k, w.A)) },
  uWaveQ: { value: waveList.map((w) => new THREE.Vector4(w.Q / w.k, w.L, w.ang, 0)) },
  uWavePhase: { value: phases },
  uWDetail: { value: null },
  uWTime: { value: 0 },
  uWSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uWSunCol: { value: new THREE.Color(1, 1, 1) },
  uWSky: { value: new THREE.Color(0x8fa6bb) },
  uWDeep: { value: new THREE.Color(0x202c29) },
  uWShallow: { value: new THREE.Color(0x5d6549) },
  uWFoam: { value: new THREE.Color(0xdde0d6) },
};

// One seek-safe clock for every water body (river, weirs, fountain basins).
// update() advances it; seekWater() pins it for cinema / story scrubbing and
// for deterministic screenshots, resumeWater() hands it back to the frame loop.
let waterTime = 0;
let waterFrozen = false;
function syncWaterTime() {
  waterUniforms.uWTime.value = waterTime;
  // phases wrapped on the CPU (skill rule): no large sin() arguments
  for (let i = 0; i < waveList.length; i++) {
    const w = waveList[i];
    let ph = (w.seed - w.omega * waterTime) % TAU;
    if (ph < 0) ph += TAU;
    phases[i] = ph;
  }
}
export function seekWater(t) {
  waterTime = t;
  waterFrozen = true;
  syncWaterTime();
}
export function resumeWater() {
  waterFrozen = false;
}
export function getWaterTime() {
  return waterTime;
}

const WATER_VERT_PARS = /* glsl */ `
attribute vec2 aFlow;
attribute float aShore;
varying vec2 vFlow;
varying float vShore;
`;
const WATER_FRAG_PARS = /* glsl */ `
#define NW ${RIPPLES.length}
uniform vec4 uWaveDir[NW];   // dx, dz, k, A
uniform vec4 uWaveQ[NW];     // Q/k, L, heading (rad)
uniform float uWavePhase[NW];
uniform sampler2D uWDetail;
uniform float uWTime;
uniform vec3 uWSunDir, uWSunCol, uWSky, uWDeep, uWShallow, uWFoam;
varying vec2 vFlow;
varying float vShore;
// Gerstner sum with analytic partial derivatives; every wave fades out
// once it is shorter than ~2-5 pixel footprints (skill rule 1). Where the
// waterway has a flow the wave headings turn toward the channel tangent,
// so the ripples travel downstream instead of across the current.
vec3 wGerstner(vec2 p, float footprint, out vec3 dPdx, out vec3 dPdz) {
  vec3 d = vec3(0.0);
  dPdx = vec3(1.0, 0.0, 0.0);
  dPdz = vec3(0.0, 0.0, 1.0);
  float fl = length(vFlow);
  float flowAmt = clamp(fl * 4.5, 0.0, 1.0);
  float flowAng = fl > 1e-4 ? atan(vFlow.y, vFlow.x) : 0.0;
  for (int i = 0; i < NW; i++) {
    vec4 w = uWaveDir[i];
    float L = uWaveQ[i].y;
    float fade = 1.0 - smoothstep(L * 0.18, L * 0.5, footprint);
    if (fade <= 0.0) continue;
    float A = w.w * fade;
    float QA = uWaveQ[i].x * fade;
    float da = (flowAng - uWaveQ[i].z) * flowAmt;
    float cd = cos(da), sd = sin(da);
    vec2 dir = vec2(w.x * cd - w.y * sd, w.x * sd + w.y * cd);
    float th = w.z * dot(dir, p) + uWavePhase[i];
    float s = sin(th), c = cos(th);
    d.y += A * s;
    float kA = w.z * A, kQA = w.z * QA;
    dPdx.x -= kQA * dir.x * dir.x * s;
    dPdx.y += kA * dir.x * c;
    dPdx.z -= kQA * dir.x * dir.y * s;
    dPdz.x -= kQA * dir.x * dir.y * s;
    dPdz.y += kA * dir.y * c;
    dPdz.z -= kQA * dir.y * dir.y * s;
  }
  return d;
}
// Small wavelets riding the channel: their crests are normal to the flow and
// travel downstream, with a slower cross-wave so the train never locks.
vec2 wFlowRipples(vec2 p, float foot, float far) {
  float fl = length(vFlow);
  if (fl < 0.02) return vec2(0.0);
  vec2 fd = vFlow / fl;
  vec2 nrm = vec2(-fd.y, fd.x);
  float sp = 2.2 + fl * 5.0;
  float ph = dot(fd, p) * 6.5 - uWTime * sp;
  float ph2 = dot(nrm, p) * 3.4 + uWTime * 1.3;
  float rip = sin(ph) * 0.62 + sin(ph * 1.9 + ph2) * 0.38;
  float fade = (1.0 - smoothstep(0.05, 0.12, foot)) * exp(-far / 130.0);
  return fd * rip * 0.075 * clamp(fl * 3.0, 0.0, 1.0) * fade;
}
float wHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// rain rings: one expanding ring per cell and cycle; the xz slope of the
// ring profile (world units), faded where a cell is only a few pixels
vec2 wRings(vec2 p, float cell, float t, float foot) {
  vec2 g = p / cell;
  vec2 id = floor(g);
  vec2 f = fract(g);
  vec2 slope = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    float h = wHash(id + o);
    float ph = fract(t * (0.9 + 0.4 * h) + h * 7.3);
    vec2 c = o + vec2(wHash(id + o + 17.1), wHash(id + o + 41.7)) - f;
    float d = length(c);
    float r = ph * 1.1;
    float x = (d - r) * 9.0;
    float env = exp(-x * x * 0.35) * (1.0 - ph) * step(d, 1.2);
    slope += (d > 1e-3 ? -c / d : vec2(0.0)) * cos(x * 2.2) * env;
  }
  // strong slopes: under a flat overcast sky only the Fresnel change shows
  return slope * (1.0 - smoothstep(0.08, 0.25, foot / cell)) * 1.8;
}
`;

// replaces #include <normal_fragment_maps>: the water normal, world space
const WATER_NORMAL = /* glsl */ `
vec3 wP = vFogWorld;
vec3 wToCam = cameraPosition - wP;
float wDist = length(wToCam);
vec3 wV = wToCam / max(wDist, 1e-4);
vec2 wFw = fwidth(wP.xz);
float wFoot = max(wFw.x + wFw.y, 1e-4);
#ifdef BRG_WATER_LITE
vec3 wN = vec3(0.0, 1.0, 0.0);
{
  vec2 dA = texture2D(uWDetail, wP.xz / 4.8 - vFlow * uWTime * 0.08 + uWTime * vec2(0.011, 0.007)).xy * 2.0 - 1.0;
  vec2 dn = dA * (0.4 * exp(-wDist / 160.0) + 0.08);
  dn += wFlowRipples(wP.xz, wFoot, wDist) * 1.6;
  wN = normalize(wN + vec3(dn.x, 0.0, dn.y));
}
#else
vec3 wDx, wDz;
wGerstner(wP.xz, wFoot * 2.0, wDx, wDz);
vec3 wN = normalize(cross(wDz, wDx));
{
  // detail: two octaves carried downstream by the flow map, in two phases
  // half a cycle apart and cross-faded, so they never stretch
  float ph0 = fract(uWTime * 0.08);
  float ph1 = fract(uWTime * 0.08 + 0.5);
  float wf = abs(1.0 - 2.0 * ph0);
  vec2 fA = vFlow * ph0 * 12.5;
  vec2 fB = vFlow * ph1 * 12.5;
  vec2 s1 = uWTime * vec2(0.011, 0.007);
  vec2 s2 = uWTime * vec2(-0.008, 0.012);
  vec2 dA = mix(texture2D(uWDetail, (wP.xz - fA) / 4.8 + s1).xy, texture2D(uWDetail, (wP.xz - fB) / 4.8 + s1 + 0.5).xy, wf) * 2.0 - 1.0;
  vec2 dB = mix(texture2D(uWDetail, (wP.zx - fA.yx) / 3.2 + s2).xy, texture2D(uWDetail, (wP.zx - fB.yx) / 3.2 + s2 + 0.5).xy, wf) * 2.0 - 1.0;
  float dStr = 0.22 * exp(-wDist / 160.0) + 0.045;
  vec2 dn = (dA * 0.5 + dB.yx * 0.18) * dStr;
  dn += wFlowRipples(wP.xz, wFoot, wDist);
  #ifdef USE_FOG
  if (cloudShape.w > 0.01) dn += (wRings(wP.xz, 0.4, uWTime, wFoot) + wRings(wP.xz + 0.13, 0.27, uWTime * 1.3 + 0.5, wFoot)) * cloudShape.w;
  #endif
  wN = normalize(wN + vec3(dn.x, 0.0, dn.y));
}
#endif
normal = normalize(mat3(viewMatrix) * wN);
`;

// after the lights: glitter in place of the stock sun highlight
const WATER_GLITTER = /* glsl */ `
#include <lights_fragment_end>
reflectedLight.directSpecular *= 0.0;
{
  vec3 L = uWSunDir;
  vec3 R = reflect(-wV, wN);
  R.y = abs(R.y) + 0.002; // skill rule: no reflection below the horizon
  float rl = max(dot(R, L), 0.0);
  float sheen = pow(rl, 90.0) * 0.18 + pow(rl, 12.0) * 0.012;
  float sparkle = pow(rl, 1400.0) * 6.0;
  float shade = 1.0;
  #ifdef USE_FOG
  shade = brgCloudShade(vFogWorld, fogLightDir);
  #endif
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(wN, wV), 0.0), 5.0);
  vec3 glit = uWSunCol * (sheen + sparkle) * shade * (0.35 + 0.65 * fres) * (1.0 - wFoamK) * step(0.0, L.y);
  // cheap sky reflection: a Fresnel mix toward the sky colour, so the water
  // takes the colour of the hour (blue at noon, warm at dusk, near-black at
  // night) and brightens at grazing angles. Shifts with the sun and time.
  vec3 skyRefl = uWSky * fres * (1.0 - wFoamK) * 0.5;
  #ifdef BRG_WATER_LITE
  reflectedLight.indirectSpecular += glit + skyRefl;
  #else
  // subsurface: the ripple faces toward a low sun let a little light through
  float toward = pow(max(dot(-normalize(vec2(wV.x, wV.z) + 1e-4), normalize(L.xz + 1e-4)), 0.0), 2.0);
  vec3 sss = uWShallow * uWSunCol * toward * clamp(1.0 - wN.y, 0.0, 1.0) * 0.35 * shade;
  reflectedLight.indirectSpecular += glit + sss + skyRefl;
  #endif
}
`;

// the body and the foam, before any lighting (replaces color_fragment)
const WATER_COLOR = /* glsl */ `
#include <color_fragment>
float wFoamK = 0.0;
{
  vec3 P = vFogWorld;
  #ifdef BRG_WATER_OPEN
  // a fountain basin: shallow, so it reads green-blue rather than ink-black
  float shore = 99.0;
  diffuseColor.rgb = mix(uWDeep, uWShallow, 0.55);
  #else
  float shore = vShore;
  // shallow within ~2 world units (8 m) of the bank: the bottom shows through
  float shallow = 1.0 - smoothstep(0.0, 2.2, shore);
  diffuseColor.rgb = mix(uWDeep, uWShallow, shallow * 0.75);
  #endif
  // lace foam hugging the bank: the lattice thresholded by the mask
  vec4 ft = texture2D(uWDetail, P.xz / 2.2 - vFlow * uWTime * 0.35);
  vec4 ft2 = texture2D(uWDetail, P.zx / 0.85 + uWTime * vec2(0.006, -0.004));
  float pattern = ft.b * 0.72 + ft2.b * 0.28;
  // the mask stays below ~0.6 even at the bank: lace, never a solid rim
  float m = (1.0 - smoothstep(0.0, 0.8, shore)) * 0.55;
  // a little more foam where the river runs fast
  m = max(m, (1.0 - smoothstep(0.0, 1.2, shore)) * clamp(length(vFlow) * 0.7, 0.0, 0.3));
  float foam = smoothstep(1.0 - m, 1.2 - m, pattern * 0.88 + m * 0.22);
  float dist = length(cameraPosition - P);
  foam *= 1.0 - smoothstep(250.0, 700.0, dist);
  wFoamK = foam;
  diffuseColor.rgb = mix(diffuseColor.rgb, uWFoam * 0.6, foam * 0.85);
}
`;

// One program for every water surface. opts.open: no banks (a basin whose
// rim hides the edge): no shore attribute needed.
export function createWaterMaterial({ open = false } = {}) {
  if (!waterUniforms.uWDetail.value) waterUniforms.uWDetail.value = detailTexture();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1f24,
    roughness: 0.05,
    metalness: 0,
    ior: 1.33, // F0 = 0.02
    envMapIntensity: 1.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  mat.name = 'water';
  mat.defines = { BRG_WATER: '' };
  if (open) mat.defines.BRG_WATER_OPEN = '';
  if (LITE) mat.defines.BRG_WATER_LITE = '';
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, waterUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WATER_VERT_PARS}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = aFlow;\nvShore = aShore;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${WATER_FRAG_PARS}`)
      .replace('#include <color_fragment>', WATER_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.85, wFoamK);')
      .replace('#include <normal_fragment_maps>', WATER_NORMAL)
      .replace('#include <lights_fragment_end>', WATER_GLITTER)
      // sparkles may pass the bloom threshold (1.5) as points, never as a blob
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb = min(gl_FragColor.rgb, vec3(2.2));');
  };
  return mat;
}

// ------------------------------------------------------------ geometry
// The OSM waterway polylines resampled every MAX_SEG world units, each
// sample carrying the local flow direction; shared by the surface ribbon,
// the banks and the weirs so they line up.
function sampleLines(data, project) {
  const MAX_SEG = 5;
  const out = [];
  for (const l of data.lines || []) {
    if (!Array.isArray(l.p) || l.p.length < 2) continue;
    const half = ((l.w || 3) * S) / 2;
    const pts = [];
    let prev = null;
    for (const q of l.p) {
      const c = project(q[0], q[1]);
      if (prev) {
        const n = Math.max(1, Math.ceil(Math.hypot(c.x - prev.x, c.z - prev.z) / MAX_SEG));
        for (let i = 1; i <= n; i++) pts.push({ x: prev.x + ((c.x - prev.x) * i) / n, z: prev.z + ((c.z - prev.z) * i) / n });
      } else pts.push(c);
      prev = c;
    }
    const smp = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b.x - a.x;
      let dz = b.z - a.z;
      const L = Math.hypot(dx, dz) || 1;
      return { x: p.x, z: p.z, dx: dx / L, dz: dz / L };
    });
    out.push({ name: l.n || '', w: l.w || 3, half, smp });
  }
  return out;
}

// Distance from (x, z) to the rings' edges, world units.
function edgeDistance(x, z, rings) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j];
      const b = ring[i];
      const dx = b.x - a.x;
      const dz = b.y - a.y;
      const l2 = dx * dx + dz * dz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / l2));
      best = Math.min(best, Math.hypot(a.x + dx * t - x, a.y + dz * t - z));
    }
  }
  return best;
}

// Distance of a waterway's closest sample to the map origin, world units:
// the narrow centre streams run under paving and take no banks.
function riverCoreDist(r) {
  let d = Infinity;
  for (const p of r.smp) d = Math.min(d, Math.hypot(p.x, p.z));
  return d;
}

// Stone edging and a green verge along a river, one ribbon per bank,
// draped on the terrain: wet granite at the waterline, a gravel verge, then
// the grass of the valley. One merged geometry, one draw.
function buildBanks(rivers, heightAt) {
  const pos = [];
  const col = [];
  const idx = [];
  const C = [new THREE.Color(0x7b786e), new THREE.Color(0x5f6d44), new THREE.Color(0x58673e)];
  for (const r of rivers) {
    // no banks for the narrow streams buried under the historic centre
    if (r.w < 8 && riverCoreDist(r) < 220) continue;
    const bw = r.w >= 8 ? 0.95 : 0.62;
    for (const side of [-1, 1]) {
      const base = pos.length / 3;
      for (const p of r.smp) {
        const nx = -p.dz * side;
        const nz = p.dx * side;
        const offs = [r.half * 0.96, r.half + bw * 0.42, r.half + bw];
        const ys = [0.22, 0.07, 0.0];
        for (let c = 0; c < 3; c++) {
          const x = p.x + nx * offs[c];
          const z = p.z + nz * offs[c];
          pos.push(x, heightAt(x, z) + ys[c], z);
          col.push(C[c].r, C[c].g, C[c].b);
        }
      }
      for (let i = 0; i < r.smp.length - 1; i++) {
        const v = base + i * 3;
        for (let k = 0; k < 2; k++) idx.push(v + k, v + 3 + k, v + k + 1, v + k + 1, v + 3 + k, v + 4 + k);
      }
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  mat.name = 'riverbank';
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'riverbank';
  mesh.receiveShadow = true;
  return { mesh, triangles: idx.length / 3 };
}

// Boulders strewn along the banks: instanced low-poly rocks, the stone the
// town's walls and kerbs are cut from.
function buildBankRocks(rivers, heightAt) {
  const count = new THREE.DodecahedronGeometry(0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x77746a, roughness: 0.98, flatShading: true });
  mat.name = 'bank-rocks';
  const spots = [];
  const rnd = lcg(913);
  for (const r of rivers) {
    if (r.smp.length < 3) continue;
    if (r.w < 8 && riverCoreDist(r) < 220) continue;
    const n = Math.min(24, Math.max(1, Math.round(r.smp.length / 14)));
    for (let k = 0; k < n; k++) {
      const p = r.smp[Math.floor(rnd() * r.smp.length)];
      const side = rnd() < 0.5 ? -1 : 1;
      const off = r.half + 0.5 + rnd() * 1.6;
      const x = p.x - p.dz * side * off;
      const z = p.z + p.dx * side * off;
      spots.push({ x, z, s: 0.25 + rnd() * 0.55, rot: rnd() * TAU });
    }
  }
  if (!spots.length) return null;
  const mesh = new THREE.InstancedMesh(count, mat, spots.length);
  mesh.name = 'bank-rocks';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const sc = new THREE.Vector3();
  spots.forEach((s, i) => {
    q.setFromAxisAngle(up, s.rot);
    pos.set(s.x, heightAt(s.x, s.z) + s.s * 0.25, s.z);
    sc.set(s.s, s.s * 0.7, s.s);
    mesh.setMatrixAt(i, m.compose(pos, q, sc));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return { mesh, count: spots.length };
}

// Rivers as ribbons draped on the terrain (three vertices across: bank,
// centre, bank, so the bank distance interpolates); ponds and reservoirs as
// flat polygons, split until no edge is longer than MAX_EDGE so the bank
// distance has interior vertices to live on.
export function createWater({ data, areas, project, heightAt }) {
  const pos = [];
  const idx = [];
  const flow = [];
  const shore = [];
  const FLOW = 0.45; // world units per second, about 1.8 m/s
  const LIFT = 0.28; // world units (1.1 m) above the terrain
  const MAX_EDGE = 4.5; // world units (18 m)
  const rivers = sampleLines(data, project);
  for (const r of rivers) {
    const base = pos.length / 3;
    for (const p of r.smp) {
      for (const side of [-1, 0, 1]) {
        const x = p.x - p.dz * r.half * side;
        const z = p.z + p.dx * r.half * side;
        pos.push(x, heightAt(x, z) + LIFT, z);
        flow.push(p.dx * FLOW, p.dz * FLOW);
        shore.push(side ? 0 : r.half);
      }
    }
    for (let i = 0; i < r.smp.length - 1; i++) {
      const v = base + i * 3;
      for (let k = 0; k < 2; k++) idx.push(v + k, v + 3 + k, v + k + 1, v + k + 1, v + 3 + k, v + 4 + k);
    }
  }
  for (const a of areas) {
    if (a.k !== 'water') continue;
    const outer = a.rings[0].map((p) => new THREE.Vector2(p.x, p.z));
    const holes = a.rings.slice(1).map((r) => r.map((p) => new THREE.Vector2(p.x, p.z)));
    if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
    for (const h of holes) if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
    let faces;
    try {
      faces = THREE.ShapeUtils.triangulateShape(outer, holes);
    } catch {
      continue;
    }
    const all = outer.concat(...holes);
    const rings = [outer, ...holes];
    const hs = all.map((p) => heightAt(p.x, p.y));
    const lo = Math.min(...hs);
    const flat = Math.max(...hs) - lo < 2; // a pond: level; else follow the ground
    // split long edges (midpoints shared through a key map)
    const verts = all.map((p) => ({ x: p.x, z: p.y }));
    const mid = new Map();
    const midpoint = (i, j) => {
      const key = i < j ? `${i}_${j}` : `${j}_${i}`;
      let m = mid.get(key);
      if (m === undefined) {
        m = verts.length;
        verts.push({ x: (verts[i].x + verts[j].x) / 2, z: (verts[i].z + verts[j].z) / 2 });
        mid.set(key, m);
      }
      return m;
    };
    let tris = faces.map((f) => f.slice());
    for (let pass = 0; pass < 6; pass++) {
      const next = [];
      let split = false;
      for (const [i, j, k] of tris) {
        const e = (p, q) => Math.hypot(verts[p].x - verts[q].x, verts[p].z - verts[q].z);
        if (Math.max(e(i, j), e(j, k), e(k, i)) <= MAX_EDGE) {
          next.push([i, j, k]);
          continue;
        }
        split = true;
        const ij = midpoint(i, j);
        const jk = midpoint(j, k);
        const ki = midpoint(k, i);
        next.push([i, ij, ki], [ij, j, jk], [ki, jk, k], [ij, jk, ki]);
      }
      tris = next;
      if (!split) break;
    }
    const base = pos.length / 3;
    const dist = verts.map((v) => edgeDistance(v.x, v.z, rings));
    // a basin too small for interior vertices would be lace all over: it
    // gets no bank foam (a tank or a fountain pool with a stone rim)
    const tiny = Math.max(...dist) < 1;
    verts.forEach((v, i) => {
      pos.push(v.x, (flat ? lo : heightAt(v.x, v.z)) + LIFT * 0.7, v.z);
      flow.push(0, 0);
      shore.push(tiny ? 3 : dist[i]);
    });
    for (const [i, j, k] of tris) idx.push(base + i, base + j, base + k);
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  // face every triangle up
  const P = geo.attributes.position.array;
  const I = geo.index.array;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const ny = (P[b + 2] - P[a + 2]) * (P[c] - P[a]) - (P[b] - P[a]) * (P[c + 2] - P[a + 2]);
    if (ny < 0) {
      const tmp = I[t + 1];
      I[t + 1] = I[t + 2];
      I[t + 2] = tmp;
    }
  }
  const nor = new Float32Array(P.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
  geo.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, createWaterMaterial());
  mesh.name = 'water';
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;

  // banks and boulders ride with the surface: nature.js adds one object
  const banks = buildBanks(rivers, heightAt);
  const rocks = buildBankRocks(rivers, heightAt);
  if (banks) mesh.add(banks.mesh);
  if (rocks) mesh.add(rocks.mesh);

  let sunSource = null; // the visible sun (scene.js skySunDir), when set
  return {
    mesh,
    banks: banks?.mesh ?? null,
    triangles: idx.length / 3 + (banks?.triangles ?? 0),
    bankTriangles: banks?.triangles ?? 0,
    rocks: rocks?.count ?? 0,
    rivers,
    // the glitter follows the visible sun disc
    setSunSource(v) {
      sunSource = v;
    },
    // dt: 0 under reduced motion (a still surface); light: { dir, color }
    update(dt, light) {
      if (!waterFrozen) waterTime += Math.min(dt, 1 / 20);
      syncWaterTime();
      if (light) {
        waterUniforms.uWSunDir.value.copy(sunSource || light.dir);
        waterUniforms.uWSunCol.value.copy(light.color);
        // the sky reflection: the ambient sky of the hour, lifted a little
        if (light.ambient) waterUniforms.uWSky.value.copy(light.ambient).multiplyScalar(2.4);
      }
    },
  };
}

// ------------------------------------------------------------ weirs
// Small stone weirs across the waterway with a white cascade sheet and a
// little spray. The bars are merged into one stone draw; every cascade is
// one animated sheet; all spray is one points draw. Placed from the weirs
// authored in data/life.json, found on the nearest waterway sample.
const WEIR_VERT = /* glsl */ `
  attribute vec2 aUv;
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = aUv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const WEIR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  varying vec3 vW;
  float h21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    // foam streaks rushing down the sheet, faster near the crest
    float y = vUv.y;
    vec2 q = vec2(vUv.x * 7.0 + sin(y * 9.0 + uTime * 3.0) * 0.4, y * 6.0 - uTime * (2.4 + y * 4.0));
    float n = noise(q) * 0.6 + noise(q * 2.3 + 11.0) * 0.4;
    float foam = smoothstep(0.26, 0.78, n) * (0.68 + 0.32 * y);
    // a bright lip of foam at the crest, where the water curls over
    foam = max(foam, (1.0 - smoothstep(0.0, 0.06, y)) * 0.8);
    float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    float head = smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.8, y);
    float a = foam * edge * head * uAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }`;

export function createWeirs({ data, project, heightAt, weirs }) {
  if (!Array.isArray(weirs) || !weirs.length) return null;
  const rivers = sampleLines(data, project);
  if (!rivers.length) return null;
  const crestY = 0.28;
  const barPos = [];
  const sheetPos = [];
  const sheetUv = [];
  const sheetIdx = [];
  const tailPos = [];
  const tailUv = [];
  const tailIdx = [];
  const drops = [];
  const rnd = lcg(559);
  const _m = new THREE.Matrix4();
  const _e = new THREE.Euler();
  const LIFT = 0.28;
  for (const wdef of weirs) {
    if (!Number.isFinite(wdef.lat) || !Number.isFinite(wdef.lon)) continue;
    const c = project(wdef.lat, wdef.lon);
    let best = null;
    let bd = Infinity;
    for (const r of rivers) {
      if (wdef.line && !r.name.includes(wdef.line)) continue;
      for (const p of r.smp) {
        const d = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
        if (d < bd) { bd = d; best = { r, p }; }
      }
    }
    if (!best || bd > 40 * 40) continue;
    const { r, p } = best;
    const half = r.half;
    const drop = (wdef.drop || 0.9) * S;
    const y0 = heightAt(p.x, p.z);
    const barH = drop + 0.7 * S + 0.15;
    const yaw = Math.atan2(p.dx, p.dz);
    // stone bar across the channel
    _e.set(0, yaw, 0);
    _m.makeRotationFromEuler(_e);
    _m.setPosition(p.x, y0 + barH / 2, p.z);
    const bg = new THREE.BoxGeometry(half * 2 + 0.7, barH, 0.9);
    bg.applyMatrix4(_m);
    barPos.push(bg);
    // cascade sheet: crest edge upstream, toe downstream
    const clen = 1.1 + drop * 1.8;
    const ax = -p.dz, az = p.dx; // across the flow
    const wy = half * 0.94;
    const topY = y0 + crestY + drop * 0.55;
    const upd = 0.42;
    const bx = p.x + p.dx * upd;
    const bz = p.z + p.dz * upd;
    const ex = bx + p.dx * clen;
    const ez = bz + p.dz * clen;
    const base = sheetPos.length / 3;
    sheetPos.push(
      bx - ax * wy, topY, bz - az * wy,
      bx + ax * wy, topY, bz + az * wy,
      ex + ax * wy, y0 + crestY, ez + az * wy,
      ex - ax * wy, y0 + crestY, ez - az * wy,
    );
    sheetUv.push(0, 0, 1, 0, 1, 1, 0, 1);
    sheetIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    // whitewater tail: a churning foam sheet on the water below the toe,
    // following the ground so it lies on the surface rather than floats
    const steps = 5;
    const tlen = clen * 1.5 + drop * 2.2;
    const twy = half * 1.06;
    const tbase = tailPos.length / 3;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const cx = ex + p.dx * tlen * f;
      const cz = ez + p.dz * tlen * f;
      for (const side of [-1, 1]) {
        const x = cx + ax * twy * side;
        const z = cz + az * twy * side;
        tailPos.push(x, heightAt(x, z) + LIFT + 0.03, z);
        tailUv.push(side < 0 ? 0 : 1, f);
      }
    }
    for (let s = 0; s < steps; s++) {
      const v = tbase + s * 2;
      tailIdx.push(v, v + 2, v + 3, v, v + 3, v + 1);
    }
    drops.push({ x: bx, z: bz, y: topY, half, dx: p.dx, dz: p.dz, ax, az, drop });
  }
  if (!barPos.length) return null;
  const merged = mergeWeirGeoms(barPos);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x777469, roughness: 0.96, metalness: 0 });
  stoneMat.name = 'weir-stone';
  const stone = new THREE.Mesh(merged, stoneMat);
  stone.name = 'weir-stone';
  stone.castShadow = true;
  stone.receiveShadow = true;

  const sheetGeo = new THREE.BufferGeometry();
  sheetGeo.setAttribute('position', new THREE.Float32BufferAttribute(sheetPos, 3));
  sheetGeo.setAttribute('aUv', new THREE.Float32BufferAttribute(sheetUv, 2));
  sheetGeo.setIndex(sheetIdx);
  sheetGeo.computeVertexNormals();
  sheetGeo.computeBoundingSphere();
  const sheetUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.9, 0.94, 0.93) }, uAlpha: { value: 0.9 } };
  const sheetMat = new THREE.ShaderMaterial({ uniforms: sheetUniforms, vertexShader: WEIR_VERT, fragmentShader: WEIR_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -10 });
  sheetMat.name = 'weir-foam';
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  sheet.name = 'weir-foam';
  sheet.renderOrder = 3;

  // the whitewater streak on the water below each weir: one merged draw
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.Float32BufferAttribute(tailPos, 3));
  tailGeo.setAttribute('aUv', new THREE.Float32BufferAttribute(tailUv, 2));
  tailGeo.setIndex(tailIdx);
  tailGeo.computeVertexNormals();
  tailGeo.computeBoundingSphere();
  const tailUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.92, 0.95, 0.94) }, uAlpha: { value: 1.0 } };
  const tailMat = new THREE.ShaderMaterial({
    uniforms: tailUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -12,
    vertexShader: /* glsl */ `
      attribute vec2 aUv;
      varying vec2 vUv;
      varying vec3 vW;
      void main() {
        vUv = aUv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uAlpha;
      varying vec2 vUv;
      varying vec3 vW;
      float h21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        // streaks stretched along the flow, racing away from the toe
        vec2 q = vec2(vUv.x * 6.0 + sin(vUv.y * 5.0 + uTime * 2.0) * 0.5, vUv.y * 2.4 - uTime * 1.5);
        float n = noise(q) * 0.55 + noise(q * 2.6 + 7.0) * 0.45;
        float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
        // brightest at the plunge, thinning downstream
        float decay = 0.35 + 0.65 * (1.0 - smoothstep(0.0, 1.0, vUv.y));
        float plunge = (1.0 - smoothstep(0.0, 0.14, vUv.y)) * 0.7;
        float a = (smoothstep(0.28, 0.8, n) * decay + plunge) * edge * uAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  tailMat.name = 'weir-tail';
  const tail = new THREE.Mesh(tailGeo, tailMat);
  tail.name = 'weir-tail';
  tail.renderOrder = 2;

  // spray: droplets thrown from the toe of each cascade
  const per = 60;
  const total = drops.length * per;
  const sp = new Float32Array(total * 3);
  const sv = new Float32Array(total * 3);
  const sl = new Float32Array(total * 2);
  let k = 0;
  for (const d of drops) {
    for (let i = 0; i < per; i++) {
      const o = k * 3;
      const along = rnd();
      const across = (rnd() - 0.5) * 2 * d.half * 0.9;
      sp[o] = d.x + d.dx * along * 0.6 + d.ax * across;
      sp[o + 1] = d.y - d.drop * 0.4 + rnd() * d.drop * 0.5;
      sp[o + 2] = d.z + d.dz * along * 0.6 + d.az * across;
      sv[o] = d.dx * (0.4 + rnd() * 0.8) + (rnd() - 0.5) * 0.9;
      sv[o + 1] = 0.9 + rnd() * 0.8;
      sv[o + 2] = d.dz * (0.4 + rnd() * 0.8) + (rnd() - 0.5) * 0.9;
      sl[k * 2] = 0.5 + rnd() * 0.5;
      sl[k * 2 + 1] = rnd();
      k++;
    }
  }
  const sprayGeo = new THREE.BufferGeometry();
  sprayGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sprayGeo.setAttribute('aVel', new THREE.BufferAttribute(sv, 3));
  sprayGeo.setAttribute('aLife', new THREE.BufferAttribute(sl, 2));
  const sprayUniforms = { uTime: { value: 0 }, uG: { value: 9.81 * S }, uPx: { value: 500 }, uColor: { value: new THREE.Color(0.9, 0.93, 0.92) } };
  const sprayMat = new THREE.ShaderMaterial({
    uniforms: sprayUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uG;
      uniform float uPx;
      attribute vec3 aVel;
      attribute vec2 aLife;
      varying float vA;
      void main() {
        float life = aLife.x;
        float age = mod(uTime + aLife.y * life, life);
        vec3 p = position + aVel * age - vec3(0.0, 0.5 * uG * age * age, 0.0);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = clamp(0.035 * uPx / d, 1.0, 5.0);
        float k = age / life;
        vA = (1.0 - smoothstep(0.7, 1.0, k)) * smoothstep(0.0, 0.06, k) * (1.0 - smoothstep(260.0, 600.0, d));
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = dot(p, p);
        if (r > 1.0 || vA < 0.01) discard;
        gl_FragColor = vec4(uColor, vA * 0.5 * (1.0 - r));
      }`,
  });
  sprayMat.name = 'weir-spray';
  const spray = new THREE.Points(sprayGeo, sprayMat);
  spray.name = 'weir-spray';
  spray.frustumCulled = false;
  spray.renderOrder = 4;

  const group = new THREE.Group();
  group.name = 'weirs';
  group.add(stone, tail, sheet, spray);

  return {
    object: group,
    update(dt, light, px) {
      // the shared seek-safe water clock (river + weirs + basins agree)
      const t = waterUniforms.uWTime.value;
      sheetUniforms.uTime.value = t;
      tailUniforms.uTime.value = t;
      sprayUniforms.uTime.value = t;
      if (px) sprayUniforms.uPx.value = px;
      if (light) {
        sheetUniforms.uColor.value.setRGB(0.9, 0.94, 0.93).lerp(light.color, 0.22);
        tailUniforms.uColor.value.setRGB(0.92, 0.95, 0.94).lerp(light.color, 0.18);
      }
    },
    stats: { weirs: drops.length, spray: total, bars: barPos.length, tail: tailIdx.length / 3 },
  };
}

function mergeWeirGeoms(geoms) {
  const total = geoms.reduce((a, g) => a + g.attributes.position.count, 0);
  const P = new Float32Array(total * 3);
  const N = new Float32Array(total * 3);
  const idx = [];
  let v = 0;
  let vi = 0;
  for (const g of geoms) {
    const gp = g.attributes.position.array;
    const gn = g.attributes.normal.array;
    const gi = g.index.array;
    P.set(gp, v * 3);
    N.set(gn, v * 3);
    for (let i = 0; i < gi.length; i++) idx.push(gi[i] + v);
    v += g.attributes.position.count;
    vi += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}
