// Procedural landmark models for Guimarães. DOM-free: node can import this file.
//
// buildModel(type, landmarkId, site) returns one merged, non-indexed
// BufferGeometry per landmark (attributes: position, normal, color, aEmit,
// aMat, aUv) plus userData.glass for transparent panes.
//
// Metric builders (builder.metric = true) draw at 1:1 in metres:
//   origin = centre of the OSM outline's box, y = 0 = the base (terrain
//   level at the site, see fit.js), local +z = the main front, +x to the
//   right of a viewer looking at that front.
// site = { footprint, dims }:
//   footprint: the OSM outline and parts in this frame (fit.js siteFrame()),
//     with ground(x, z) = the visible terrain relative to the base;
//   dims: the record of data/dimensions.json for this landmark.
//
// First launch: every landmark uses the generic massing builder (real
// outline, real parts, real heights). Detailed builders replace it one by
// one (PLAN.md, round 3): add src/models/guimaraes/<name>.js exporting
// { [id]: builder } and spread it into DETAILED below.
import { Kit, PALETTE, MAT, triangleCount } from './models/kit.js';
import { blockBuilders } from './models/guimaraes/block.js';

export { PALETTE, MAT, triangleCount };

// Per landmark: model type, legacy target height (unused by metric
// builders) and yaw.
export const LANDMARK_SPECS = {
  castelo: { type: 'castle', h: 28, yaw: 0 },
  'paco-duques': { type: 'ducal-palace', h: 22, yaw: 0 },
  'sao-miguel-castelo': { type: 'chapel-romanesque', h: 9, yaw: 0 },
  oliveira: { type: 'church', h: 30, yaw: 0 },
  'sao-tiago': { type: 'plaza', h: 12.8, yaw: 0 },
  toural: { type: 'plaza', h: 20, yaw: 0 },
  penha: { type: 'cable-car', h: 26, yaw: 0 },
  'santos-passos': { type: 'basilica-twin', h: 30, yaw: 0 },
  'sao-francisco': { type: 'convent', h: 24, yaw: 0 },
  'alberto-sampaio': { type: 'museum', h: 10, yaw: 0 },
  muralha: { type: 'city-wall', h: 15, yaw: 0 },
  'plataforma-artes': { type: 'arts-platform', h: 16, yaw: 0 },
  couros: { type: 'tannery', h: 1.2, yaw: 0 },
  'santa-marinha': { type: 'monastery', h: 22, yaw: 0 },
  'estadio-afonso-henriques': { type: 'stadium', h: 32, yaw: 0 },
  'uminho-azurem': { type: 'university', h: 16, yaw: 0 },
  briteiros: { type: 'citania', h: 6, yaw: 0 },
  'vila-flor': { type: 'palace', h: 15, yaw: 0 },
};

const DETAILED = {};
const BUILDERS = { ...blockBuilders(Object.keys(LANDMARK_SPECS)), ...DETAILED };

const TYPE_DEFAULT = Object.fromEntries(Object.entries(LANDMARK_SPECS).map(([id, s]) => [s.type, id]));
export const MODEL_TYPES = Object.keys(TYPE_DEFAULT);

// Kept for the shared engine (src/main.js): one city per project, nothing to load.
export function registerModels({ builders = {}, specs = {} } = {}) {
  Object.assign(BUILDERS, builders);
  Object.assign(LANDMARK_SPECS, specs);
}
export async function loadCityModels() {
  return null;
}

function resolve(type, landmarkId) {
  if (landmarkId && BUILDERS[landmarkId]) return landmarkId;
  if (TYPE_DEFAULT[type]) return TYPE_DEFAULT[type];
  return 'castelo';
}

export function specFor(landmarkId, type) {
  return LANDMARK_SPECS[landmarkId] ?? LANDMARK_SPECS[resolve(type, landmarkId)] ?? { h: 50, yaw: 0 };
}

export function isMetric(type, landmarkId) {
  return !!BUILDERS[resolve(type, landmarkId)].metric;
}

// Fit rules a builder carries with it (builder.rule, see fit.js FIT_RULES).
export function builderRule(type, landmarkId) {
  return BUILDERS[resolve(type, landmarkId)].rule || {};
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// site: { footprint, dims } for metric builders.
export function buildModel(type, landmarkId, site = null) {
  const id = resolve(type, landmarkId);
  const spec = LANDMARK_SPECS[id];
  const fn = BUILDERS[id];
  const k = new Kit(hash(id));
  let g;
  if (fn.metric) {
    fn(k, site);
    g = k.build();
    g.userData.metric = true;
  } else {
    fn(k);
    g = k.build(spec.h);
  }
  g.userData.type = spec.type;
  g.userData.builder = id;
  return g;
}
