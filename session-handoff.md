# Session handoff

Compact note for the next session. Keep it to one screen.

- Date: 2026-10-05 (session 006)
- Session goal: harden the fork after the sibling-city review (/tmp/review/compare.md): API defaults, cinema config, dead code, sky, SEO, safe engine sync, docs, deploy.
- Verified state (last `npm run verify` result): `verify: OK` (7/7: build, data, geo, dimensions, 1:1 fit, traffic, models). Headless load: 0 page errors, 0 console warnings.
- Active feature (id): none open. gui-013 (session 006 hardening) is passing.
- What changed:
  - `api/*` default to `guimaraes` (bare `/api/adsb` no longer 500s); response headers are `X-Guimaraes-*`.
  - `cities/guimaraes.json` carries `cinema_order` (18 ids); `src/tour.js` reads it and keeps `CINEMA_ORDER` as the fallback.
  - `src/models/guimaraes/block.js` is gone; the icosahedron `toNonIndexed` warnings are fixed in `src/nature.js`.
  - Fit drift (castelo, penha, santos-passos, vila-flor) is documented in `FIT_RULES.drift` in `src/fit.js`; the 97% never-shrink rule still holds.
  - Sky: the sunset and morning presets in `src/scene.js` are brighter (hemi fill, env, exposure) and the haze is thinner.
  - SEO: `public/robots.txt`, `public/sitemap.xml`, `public/favicon.ico`, `public/404.html`; JSON-LD and hreflang in `index.html`.
  - `scripts/sync-engine.sh` now runs `scripts/sync-engine.mjs`, a hash-guarded 3-way; base is `scripts/engine-base.json`.
  - `window.__city` is the neutral alias of `window.__braga` (kept: six modules and `scripts/make-og.mjs` read it).
- What is half-done or risky:
  - Wave 8b is only the lighting minimum. Clouds and sun shafts are not tuned.
  - Braga is not the real upstream: 41 engine files are `ahead`, 1 `diverged`. Port waves 6-8 into braga before any `--apply` brings value.
  - No landmark has a 360 panorama; videos run 1-3 per landmark (toural, santos-passos, sao-francisco have 1).
- Exact next step: Phase C (finer DEM via `terrain.spacing_m`) or wave 8b clouds and sun shafts.
- Files to look at first: `claude-progress.md` (Session 006), `feature_list.json` (gui-013), `src/scene.js` (PRESETS), `scripts/sync-engine.mjs`.
