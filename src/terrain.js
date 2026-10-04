// Real terrain from data/terrain.json (EU-DEM 25 m via OpenTopoData,
// resampled to a regular lat/lon grid, rows south to north). DOM-free, so
// node scripts can import it.
//
// heightAt(x, z) is the one height function of the scene: world units,
// 0 at the terrain height of the projection origin (the city centre).
// It samples the grid bilinearly, then applies "pads": flat or profiled
// patches under landmarks, so a stadium cut into a hillside or a church on
// a terrace stands on level ground instead of sinking into the DEM slope.
// Roads, routes, buildings and landmarks all read this same function.

export const VERTICAL_EXAGGERATION = 1.0;

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// data: parsed terrain.json or null (flat fallback).
// toMetres(lat, lon) -> {x, z} local metres (z = south); S: world units per metre.
export function createTerrain(data, toMetres, S, { exaggeration = VERTICAL_EXAGGERATION } = {}) {
  const ok = data && Array.isArray(data.heights) && data.cols > 1 && data.rows > 1 && data.heights.length === data.cols * data.rows;
  if (data && !ok) console.warn('[guimaraes] terrain.json is malformed; using flat ground');

  const cols = ok ? data.cols : 2;
  const rows = ok ? data.rows : 2;
  const H = ok ? Float32Array.from(data.heights) : new Float32Array(4);
  // grid corners in metres: west/east x, south/north z (z grows to the south)
  const sw = ok ? toMetres(data.bbox.s, data.bbox.w) : { x: -1, z: 1 };
  const ne = ok ? toMetres(data.bbox.n, data.bbox.e) : { x: 1, z: -1 };
  const x0 = sw.x;
  const x1 = ne.x;
  const zS = sw.z;
  const zN = ne.z;

  // Mean height of the border cells: outside the grid the ground eases
  // toward it, so the clamped edge profile does not run out as ridges.
  let rim = 0;
  let rimN = 0;
  for (let c = 0; c < cols; c++) {
    rim += H[c] + H[(rows - 1) * cols + c];
    rimN += 2;
  }
  for (let r = 0; r < rows; r++) {
    rim += H[r * cols] + H[r * cols + cols - 1];
    rimN += 2;
  }
  rim /= rimN;
  const RIM_FADE_M = 2000;

  // Raw DEM height in metres above sea level, at local metres. Outside the
  // grid there is no data: the edge profile is averaged over a window that
  // widens with the distance (no ridges running out from the edge), then
  // eases toward the rim mean.
  function rawMetres(mx, mz) {
    const ox = mx < x0 ? x0 - mx : mx > x1 ? mx - x1 : 0;
    const oz = mz > zS ? mz - zS : mz < zN ? zN - mz : 0;
    if (!ox && !oz) return gridMetres(mx, mz);
    const d = Math.hypot(ox, oz);
    const cx = mx < x0 ? x0 : mx > x1 ? x1 : mx;
    const cz = mz > zS ? zS : mz < zN ? zN : mz;
    const w = d * 0.8;
    let h = 0;
    for (let k = -2; k <= 2; k++) {
      // spread along the edge the point lies beyond (both for corners)
      h += gridMetres(ox ? cx : cx + (k * w) / 2, oz ? cz : cz + (k * w) / 2);
    }
    h /= 5;
    return h + (rim - h) * smooth(d / RIM_FADE_M);
  }

  function gridMetres(mx, mz) {
    let fc = ((mx - x0) / (x1 - x0)) * (cols - 1);
    let fr = ((zS - mz) / (zS - zN)) * (rows - 1);
    fc = fc < 0 ? 0 : fc > cols - 1 ? cols - 1 : fc;
    fr = fr < 0 ? 0 : fr > rows - 1 ? rows - 1 : fr;
    const c0 = Math.min(cols - 2, Math.floor(fc));
    const r0 = Math.min(rows - 2, Math.floor(fr));
    const tc = fc - c0;
    const tr = fr - r0;
    const i = r0 * cols + c0;
    const a = H[i] + (H[i + 1] - H[i]) * tc;
    const b = H[i + cols] + (H[i + cols + 1] - H[i + cols]) * tc;
    return a + (b - a) * tr;
  }

  // Smooth counterpart of gridMetres for the rendered mesh: Catmull-Rom over
  // the 4 x 4 DEM neighbourhood, so it rounds cell edges and ridges while
  // passing exactly through every lattice sample. heightAt (bilinear) is left
  // untouched, so draped objects keep their datum.
  const nodeAt = (r, c) => {
    r = r < 0 ? 0 : r > rows - 1 ? rows - 1 : r;
    c = c < 0 ? 0 : c > cols - 1 ? cols - 1 : c;
    return H[r * cols + c];
  };
  const cr = (p0, p1, p2, p3, t) =>
    p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function gridSmooth(mx, mz) {
    let fc = ((mx - x0) / (x1 - x0)) * (cols - 1);
    let fr = ((zS - mz) / (zS - zN)) * (rows - 1);
    fc = fc < 0 ? 0 : fc > cols - 1 ? cols - 1 : fc;
    fr = fr < 0 ? 0 : fr > rows - 1 ? rows - 1 : fr;
    const c0 = Math.min(cols - 2, Math.floor(fc));
    const r0 = Math.min(rows - 2, Math.floor(fr));
    const tc = fc - c0;
    const tr = fr - r0;
    const a = cr(nodeAt(r0 - 1, c0 - 1), nodeAt(r0 - 1, c0), nodeAt(r0 - 1, c0 + 1), nodeAt(r0 - 1, c0 + 2), tc);
    const b = cr(nodeAt(r0, c0 - 1), nodeAt(r0, c0), nodeAt(r0, c0 + 1), nodeAt(r0, c0 + 2), tc);
    const c = cr(nodeAt(r0 + 1, c0 - 1), nodeAt(r0 + 1, c0), nodeAt(r0 + 1, c0 + 1), nodeAt(r0 + 1, c0 + 2), tc);
    const d = cr(nodeAt(r0 + 2, c0 - 1), nodeAt(r0 + 2, c0), nodeAt(r0 + 2, c0 + 1), nodeAt(r0 + 2, c0 + 2), tc);
    return cr(a, b, c, d, tr);
  }

  // Same edge treatment as rawMetres, but over the smooth grid: outside the
  // DEM the rendered mesh keeps the windowed edge profile and the rim fade,
  // so the smooth and bilinear surfaces only part inside the data.
  function rawSmoothMetres(mx, mz) {
    const ox = mx < x0 ? x0 - mx : mx > x1 ? mx - x1 : 0;
    const oz = mz > zS ? mz - zS : mz < zN ? zN - mz : 0;
    if (!ox && !oz) return gridSmooth(mx, mz);
    const d = Math.hypot(ox, oz);
    const cx = mx < x0 ? x0 : mx > x1 ? x1 : mx;
    const cz = mz > zS ? zS : mz < zN ? zN : mz;
    const w = d * 0.8;
    let h = 0;
    for (let j = -2; j <= 2; j++) {
      h += gridSmooth(ox ? cx : cx + (j * w) / 2, oz ? cz : cz + (j * w) / 2);
    }
    h /= 5;
    return h + (rim - h) * smooth(d / RIM_FADE_M);
  }

  // Datum: the DEM height at the origin becomes y = 0.
  const datum = ok ? rawMetres(0, 0) : 0;
  const k = S * exaggeration;

  // Raw world height, no pads.
  const rawAt = (x, z) => (rawMetres(x / S, z / S) - datum) * k;
  // Smooth raw world height, no pads (the rendered mesh's base surface).
  const rawSmoothAt = (x, z) => (rawSmoothMetres(x / S, z / S) - datum) * k;

  // Pads, in world units. Each: centre (cx, cz), unit long axis (ux, uz),
  // half extents (hu along, hv across), falloff distance, and either a
  // constant height `y` or a profile `yAt(u, v, x, z)` in local pad coords.
  const pads = [];
  function addPad(p) {
    const pad = { ...p, r: Math.hypot(p.hu, p.hv) + p.fall };
    pads.push(pad);
    return pad;
  }

  // The landmark pad blend, shared by heightAt (the data datum) and the
  // rendered mesh, so a terraced landmark stays level on both.
  function applyPads(h, x, z) {
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      const dx = x - p.cx;
      const dz = z - p.cz;
      if (dx * dx + dz * dz > p.r * p.r) continue;
      const u = dx * p.ux + dz * p.uz;
      const v = -dx * p.uz + dz * p.ux;
      const ou = Math.abs(u) - p.hu;
      const ov = Math.abs(v) - p.hv;
      const d = Math.hypot(ou > 0 ? ou : 0, ov > 0 ? ov : 0);
      if (d >= p.fall) continue;
      const w = 1 - smooth(d / p.fall);
      const target = p.yAt ? p.yAt(u, v, x, z) : p.y;
      h += (target - h) * w;
    }
    return h;
  }

  function heightAt(x, z) {
    return applyPads(rawAt(x, z), x, z);
  }

  // Terrain extent in world units, for the ground mesh, the haze wall and
  // the fly-mode walls. The grid now reaches past the core to the streamed
  // tiles (data/tiles); `core` is the original 90 x 60 grid inside it: the
  // area of roads.json, buildings.json and nature.json. With an old core-only
  // file `core` equals `bounds`.
  const bounds = { x0: x0 * S, x1: x1 * S, zN: zN * S, zS: zS * S, cols, rows };
  let core = bounds;
  if (ok && data.core?.bbox) {
    const c = data.core;
    const csw = toMetres(c.bbox.s, c.bbox.w);
    const cne = toMetres(c.bbox.n, c.bbox.e);
    core = { x0: csw.x * S, x1: cne.x * S, zN: cne.z * S, zS: csw.z * S, cols: c.cols, rows: c.rows, c0: c.c0, r0: c.r0 };
  }

  // ---- rendered-mesh relief ----------------------------------------------
  // All of this displaces only the drawn ground, never heightAt. It is zero
  // on the DEM lattice nodes (so the samples keep their data value and the
  // shadow proxy stays exact) and inside the OSM core, where buildings and
  // roads drape to heightAt and must not be left in the air.

  // hash / value noise, deterministic in world coords so the tile worker
  // (src/tile-worker.js) builds the identical surface.
  const hash2 = (i, j) => {
    let n = (Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263)) | 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return (n >>> 8) / 16777216;
  };
  const vnoise = (x, z) => {
    const i = Math.floor(x);
    const j = Math.floor(z);
    const tx = x - i;
    const tz = z - j;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);
    const a = hash2(i, j);
    const b = hash2(i + 1, j);
    const c = hash2(i, j + 1);
    const d = hash2(i + 1, j + 1);
    const ab = a + (b - a) * sx;
    const cd = c + (d - c) * sx;
    return ab + (cd - ab) * sz;
  };

  const cellX = (x1 - x0) / (cols - 1);
  const cellZ = (zS - zN) / (rows - 1);
  const rIn = (mx, mz) => (mx - x0) / cellX;
  const rInZ = (mx, mz) => (zS - mz) / cellZ;
  // 1 at a DEM cell centre, 0 on every lattice line: keeps the samples exact.
  const latticeWeight = (mx, mz) => {
    if (mx < x0 || mx > x1 || mz > zS || mz < zN) return 0;
    const fx = rIn(mx, mz) % 1;
    const fz = rInZ(mx, mz) % 1;
    return Math.sin(Math.PI * fx) * Math.sin(Math.PI * fz);
  };
  // hillside microrelief: a metre or two of coherent bumps, slope-scaled and
  // faded out across the built core so draped objects are never lifted.
  const CORE_FADE = 220; // world units
  const coreMask = (x, z) => {
    const dx = Math.max(core.x0 - x, x - core.x1, 0);
    const dz = Math.max(core.zN - z, z - core.zS, 0);
    return smooth(Math.hypot(dx, dz) / CORE_FADE);
  };
  const reliefNoise = (mx, mz) =>
    (vnoise(mx * 0.014, mz * 0.014) - 0.5) * 0.62 +
    (vnoise(mx * 0.031 + 13.7, mz * 0.031 - 7.3) - 0.5) * 0.28 +
    (vnoise(mx * 0.062 - 41.1, mz * 0.062 + 23.9) - 0.5) * 0.1;

  // steep, rocky faces and a faint terrace staircase on the high Penha ground
  const TERRACE_M = 7;
  function penhaAt(mx, mz, slope) {
    const elev = rawSmoothMetres(mx, mz);
    const high = smooth((elev - 400) / 150);
    if (high <= 0) return 0;
    const rock = (vnoise(mx * 0.05 + 5.1, mz * 0.05 - 2.7) - 0.5) * 2.5;
    const terr = Math.round(elev / TERRACE_M) * TERRACE_M - elev;
    return (rock + terr * 0.7) * high * Math.min(1, slope * 4.5);
  }

  function slopeOf(at, x, z) {
    const d = 8;
    return Math.hypot((at(x + d, z) - at(x - d, z)) / (2 * d), (at(x, z + d) - at(x, z - d)) / (2 * d));
  }

  // Rendered height (world units): smooth base + pads, then microrelief and
  // Penha detail, both in metres.
  function groundMeshAt(x, z) {
    const base = applyPads(rawSmoothAt(x, z), x, z);
    const mx = x / S;
    const mz = z / S;
    const w = latticeWeight(mx, mz) * coreMask(x, z);
    if (w <= 0) return base;
    const slope = slopeOf((px, pz) => applyPads(rawSmoothAt(px, pz), px, pz), x, z);
    const sf = smooth((slope - 0.05) / 0.17);
    if (sf <= 0) return base;
    const micro = reliefNoise(mx, mz) * 2.0 * sf;
    const penha = penhaAt(mx, mz, slope);
    return base + (micro + penha) * w * k;
  }

  // Same, without pads: the tile worker's ground (streamed tiles have no pads).
  function groundMeshRawAt(x, z) {
    const base = rawSmoothAt(x, z);
    const mx = x / S;
    const mz = z / S;
    const w = latticeWeight(mx, mz) * coreMask(x, z);
    if (w <= 0) return base;
    const slope = slopeOf(rawSmoothAt, x, z);
    const sf = smooth((slope - 0.05) / 0.17);
    if (sf <= 0) return base;
    const micro = reliefNoise(mx, mz) * 2.0 * sf;
    const penha = penhaAt(mx, mz, slope);
    return base + (micro + penha) * w * k;
  }

  return {
    ok,
    heightAt,
    rawAt,
    rawSmoothAt,
    groundMeshAt,
    groundMeshRawAt,
    rawMetres,
    addPad,
    pads,
    bounds,
    core,
    // the raw grid, for the tile worker (src/tile-worker.js), which drapes
    // the streamed tiles on the same ground
    grid: ok ? { bbox: data.bbox, cols, rows, heights: H, core: data.core || null } : null,
    datum,
    // metres above sea level at a world point (with pads)
    elevationAt: (x, z) => heightAt(x, z) / k + datum,
    minM: ok ? data.min_m : 0,
    maxM: ok ? data.max_m : 0,
    source: ok ? data.source : 'flat',
  };
}
