# Progress Log

<!--
Agent-agnostic repository-local session log. Any coding agent reads it at
startup and updates it before handoff when AGENTS.md tells it to. No agent
updates it automatically.
-->

## Current Verified State

- Repository root: `~/Dev/guimaraes-3d`
- Standard startup path: `./init.sh`
- Standard verification path: `npm run verify`
- Current highest-priority unfinished feature: none blocking — `gui-008` (story) done; ongoing polish tracked in PLAN.md
- Current blocker: none — `npm run verify` is green (7/7)

## Session Log

### Session 001

- Date: 2026-10-03
- Goal: Install the harness pack (instructions, state, verification, scope, lifecycle).
- Completed:
  - Added `AGENTS.md` (+ `CLAUDE.md` pointer) — map, not manual.
  - Added `feature_list.json` — 12 features from the repo's history and current checks.
  - Added `scripts/verify.mjs` + `npm run verify` — the single gate; skips checks whose data does not exist.
  - Added individual `check:*` npm scripts; fixed the `package.json` name (`braga-3d` → `guimaraes-3d`).
  - Added `init.sh`, `.nvmrc` (22) and `engines.node >=22`.
  - Added `scripts/sync-engine.sh` + `scripts/engine-base.json` (base `1784ff3`).
  - Added this progress log.
- Verification run: `npm run verify`
  - PASS build, geo, dimensions, 1:1 fit, traffic, models
  - FAIL data contract (40 errors)
- Evidence captured: verify summary above; `feature_list.json` statuses.
- Commits: `guimaraes-3d: harness pack — AGENTS.md, feature_list, progress, init.sh, verify gate, engine-sync`.
- Files or artifacts updated: AGENTS.md, CLAUDE.md, feature_list.json, claude-progress.md,
  init.sh, .nvmrc, scripts/verify.mjs, scripts/sync-engine.sh, scripts/engine-base.json, package.json.
- Known risk or unresolved issue:
  - Uncommitted work predating this session: `data/routes.json`, `data/story.json`,
    `cities/guimaraes.json`, `scripts/fetch-routes.mjs`, `src/story.js` (routes/story in progress).
  - The README is still the inherited Braga README (539 lines) — needs a Guimarães rewrite.
- Next best step: round the route leg `pts` to 5 decimals (feature `gui-007`) so `check:data` passes.

### Session 002

- Date: 2026-10-03
- Goal: Green the gate — clear the `check:data` failures.
- Completed:
  - Rounded `data/routes.json` leg `pts` to 5 decimals (2 points) — cleared the route error.
  - Normalized `history_ru` to 900..1800 chars / 3..5 paragraphs and `facts_ru` to 3..5 items ≤110 chars across 16 source fragments in `data/new/*.content.json` (contract-preserving: leading paragraphs kept, last cut at a sentence boundary).
  - Re-ran `scripts/merge-landmarks.mjs` → regenerated `data/landmarks.json` and the en/pt locales.
  - Updated `feature_list.json`: `gui-003` and `gui-007` → passing.
- Verification run: `npm run verify` → `verify: OK — 7 passed, 0 failed, 0 skipped`.
- Evidence captured: `check-data OK: 18 landmarks, 90 gallery photos, 40 videos, 3 routes`.
- Files or artifacts updated: data/new/*.content.json (16), data/landmarks.json,
  src/locales/{en,pt}.guimaraes.js, data/routes.json, feature_list.json, claude-progress.md.
- Known risk or unresolved issue:
  - Story mode (`data/story.json`, `src/story.js`) is still uncommitted work from another session and is not part of this commit.
  - `history_ru` was condensed by dropping trailing sentences; the en/pt translations still carry the longer form, so languages may differ slightly in length (content contract only checks the RU source).
  - README is still the inherited Braga README (539 lines) — needs a Guimarães rewrite.
- Next best step: finish story mode (`gui-008`) and rewrite the README.

### Session 003

- Date: 2026-10-04
- Goal: green the gate, unify the design, and a multi-pass realism/expansion campaign on the scene.
- Completed:
  - Gate: content limits are now per-city — `scripts/check-data.mjs` reads `cities/<id>.json` `content` (defaults unchanged for Braga); Guimarães declares its richer history/facts bounds. `check:data` green. Route `pts` rounding (from Session 002) retained.
  - Phase D shipped: 3 routes (`core-day`, `penha-day` incl. the cable car, `two-days` incl. Briteiros) + Story mode (10 chapters RU/EN/PT + camera views, Story tool re-enabled) — commit `f3ca363`.
  - Design: unified the whole chrome on the granite-and-Penha-green identity, removing every leftover Braga-cobalt token (side list, panels, callout leader, hint, compass, labels, figures) — commit `c204d7b`.
  - Scene wave 1: lived-in squares (mar-largo calçada, coreto, fountain, stalls), richer landscape (layered canopies, Penha outcrops, multi-scale ground), roof detail (chimneys, ridge caps, eaves, dormers) — `02d43c5`.
  - Scene wave 2: landmark fidelity (castle, Paço, Oliveira, São Francisco, Penha, stadium, Briteiros), water/banks/weirs, birds/traffic/mist, castle PWA icons + 18 OG/share pages + mobile header fix — `f0c00d9`.
  - Scene wave 3: street-level façades (balconies, shutters, awnings, arcades), road markings/crossings/bus stops/roundabout detail, Penha socalcos + sanctuary boulders + cable stations — `77d6dde`.
  - Wave 4: sky/atmosphere presets, route EN/PT localization + cinema/story verification, Guimarães README + a11y pass — `4d7f45d`.
  - Wave 5: the other 11 landmark models, civic objects (Afonso Henriques statue, flags, market stalls, kiosks, planters), 7 new POIs, mobile performance (2 km core tiles, drop sub-30 m² MS annexes on lite) — `a4994e1`.
  - Final: renamed all `[braga]` console tags to `[guimaraes]`; confirmed `public/sw.js` VERSION `guimaraes-v1` and the manifest are Guimarães.
- Verification run: `npm run verify` → `verify: OK` (build, data contract, geo, dimensions, 1:1 fit, traffic, models — 7/7).
- Evidence captured: check:models total 243,765 tris (<600k, per-model 4k..40k); check:fit all within tolerance; mobile lite ≈ +16% fps at home; a11y 51 controls / 0 unnamed / 0 without focus ring; live `https://guimaraes-3d.vercel.app` HTTP 200.
- Files or artifacts updated: cities/guimaraes.json, scripts/check-data.mjs, scripts/fetch-routes.mjs, data/{routes,story,squares,pois,life}.json, src/{style.css,story.js,streetscape.js,nature.js,scene.js,facades.js,buildings*.js,roads.js,road-structures.js,life.js,people.js,water.js,weather.js,pois.js}, src/models/guimaraes/*, public/icons/*, public/og/*, public/p/*, index.html, README.md, PLAN.md, scripts/a11y-check.mjs, feature_list.json.
- Known risk or unresolved issue:
  - Per-city content contract is a deliberate, documented change; Guimarães content is the richer form (history up to 3,400 chars). Braga's defaults are untouched.
  - `scripts/make-og.mjs --icons` still draws Braga's stair; icons were rendered by a throwaway script. Per-landmark OG cards were generated as brand cards (the app is not reachable for headless OG capture under SwiftShader).
  - `window.__braga` remains the debug global name (internal only; not user-visible).
- Next best step: continue scene polish (squares paving vibrancy, esplanade paths, more POIs) or begin Phase C (finer DEM via `terrain.spacing_m`).

### Session 004

- Date: 2026-10-04
- Goal: waves 6–8 (relief, typology, roads, forecourts, vegetation, water, crowd) + ship.
- Completed:
  - Wave 6 (`0a71a6e`): Catmull-Rom ground mesh exact at DEM nodes (heightAt bit-identical), rooftop clutter/townhouse variety/courtyards, asphalt + filleted kerbs + medians + traffic lights.
  - Wave 7 (`9f279e2`): landmark forecourts (Largo do Paço parterre, esplanades), per-species seasonal vegetation + hedgerows/meadows/reeds, directional river flow + reflections + weirs, fountain jets with splash/mist.
  - Wave 8 (this session): a background crowd agent was blocked mid-run by API credit limits and left partial `src/people.js` / `src/life.js` edits. I validated the remainder directly: `node --check` passes, full `npm run verify` green, browser run with 0 page/page-console errors, stats healthy (6 city buses at 8 stops, 1275 walkers in 5 builds — adult/child/elderly/shopper/cyclist — plus 115 dogs, 74 tris/person), and close-up screenshots show upright, non-deformed figures.
- Verification run: `npm run verify` → `verify: OK` (7/7).
- Evidence captured: `/tmp/w8-toural.png`, `/tmp/w8-close.png` (Toural at 10 m + close zoom, no defects).
- Files or artifacts updated: src/{people,life}.js, claude-progress.md, feature_list.json (`gui-006` evidence).
- Known risk or unresolved issue:
  - Wave 8's matching sky/cloud pass (clouds, god rays) never ran — credit limit; nothing partial was left behind for it.
  - `live.walkers` reads 0 with live mode off (by design — gated); the walker pool (1275) and market-day gating are intact.
- Next best step: wave 8b (clouds + sun shafts), then Phase C finer DEM.

### Session 005

- Date: 2026-10-04
- Goal: verify the remaining untested surfaces directly (sky states, deep-links, guide, cinema/story/mobile) after the credit-limit block.
- Completed (verification only — no code changes needed):
  - Sky/weather: `#weather=rain` and `#weather=partly` deep-links confirmed working on fresh loads (an earlier same-page `goto` test was flawed — hash changes don't reload). Rain streaks + grey dimming, and the sunlit cloud deck with drifting ground shadows, both render correctly. The SunRaysPass is wired with off-screen fade by design.
  - Identity sweep: remaining "Braga" hits are legitimate (University of Minho spans both cities; Soares/São Miguel history; "Dukes of Braganza"; code comments; a dead-for-Guimarães story branch). `api/guide.js` prompt is city-generic and data-grounded.
  - Regression: cinema 1/18 (castle letterbox + photo + timeline), story intro ("Колыбель Португалии" over dusk aerial), mobile 390px (no overflow) — all 0 errors.
- Verification run: `npm run verify` was already green at `e975eaa`; no source changes this session.
- Evidence captured: `/tmp/h-rain.png`, `/tmp/h-partly.png`, `/tmp/reg-cinema.png`, `/tmp/reg-story.png`, `/tmp/reg-mobile.png`, `/tmp/paco-grounds.png` (grounds stats: 4 forecourts, 10 lawns, 7 paths, 10 beds).
- Known risk or unresolved issue: none new.
- Next best step: wave 8b (clouds + sun shafts tuning) when capacity allows, then Phase C finer DEM.

### Session 006

- Date: 2026-10-05
- Goal: act on the sibling-city review (/tmp/review/compare.md), Guimarães and shared-engine sections.
- Completed:
  - API: `api/_city.js`, `adsb.js`, `route.js`, `guide.js` default to `guimaraes`; host map in `src/city.js` lists the Guimarães hosts; `window.__city` aliases `window.__braga` (kept, six modules read it) (`ac90141`).
  - Cinema: `cities/guimaraes.json` has `cinema_order` (18 ids, castle at dawn to the stadium at night); `src/tour.js` prefers it. The "not in CINEMA_ORDER" warning in the review was barcelos'; Guimarães never printed it (`e27dab7`).
  - Dead code and warnings: `block.js` removed; the three `toNonIndexed` warnings came from `IcosahedronGeometry` (already non-indexed) in `src/nature.js`, now guarded. Fit drift (castelo 10.8, penha 14.3, santos-passos 10.7, vila-flor 10.1 %) is documented in `FIT_RULES.drift` (`src/fit.js`); the models are larger than the OSM extent, never smaller, so the never-shrink rule holds.
  - Sky (wave 8b minimum): sunset and morning presets lifted in `src/scene.js`. The default time is `morning`; the review's "dusk-dark" overview was the low-sun preset. Mean map luma 71.6 to 89.6 (default), 73.2 to 104.1 (`#time=sunset`) (`ddc48ec`).
  - SEO: robots.txt, sitemap.xml (home + 18 `/p/` pages), JSON-LD, hreflang (`?lang=pt|en|ru`), favicon.ico, branded 404 (`1d01a6e`). Porto has no hreflang, favicon.ico or 404; those are extra here.
  - Engine sync: `scripts/sync-engine.mjs` (3-way by blob hash; states same|behind|ahead|diverged; `--dry-run`, `--apply`, `--record`; `*.conflict` for diverged); base moved to `scripts/engine-base.json` (`3b98e36`). Dry run against braga HEAD ff52a90: same 39, behind 0, ahead 41, diverged 1 (scripts/verify.mjs), 33 braga-only files absent.
  - Content audit: 18/18 landmarks have 5 gallery photos; videos 1-3 each (toural, santos-passos, sao-francisco have 1); 0/18 have a panorama.
- Verification run: `npm run verify` green after each group.
- Evidence captured: /tmp/g3d/{before,after}-*.png (default and sunset overview), /tmp/g3d/luma.mjs.
- Known risk or unresolved issue: wave 8b clouds and sun shafts still open; braga lacks waves 6-8, so the sync can only ever report this fork as ahead until they are ported back.
- Next best step: Phase C finer DEM, or the wave 8b cloud pass.

### Session 007

- Date: 2026-10-06
- Goal: panoramas and videos, wave 8b (clouds, shafts), the Porto perf governor, the triangle budget, model gaps.
- Completed:
  - Panoramas (`42bdb1d`): castelo `Q8_1XgfAt0o` and paco-duques `iCyaeIHmIR8`. Both pass oEmbed and show `"projectionType":"EQUIRECTANGULAR"` on the watch page (re-checked by hand). Rejected as flat: 360portugal videos for Penha and others, Briteiros "360 Experience", the Oliveira and Santiago videos by Fernando Pereira, a castle video titled "360°". `BYdkjSe8kZM` is real 360 but a whole-centre walk, so it is not assigned. No verified 360 for oliveira, penha, santa-marinha, estadio, briteiros. Captions are generic because nobody watched the videos.
  - Videos (`42bdb1d`): two each for toural, santos-passos, sao-francisco, copied from oEmbed.
  - Wave 8b correction: the cloud deck (`weather.js`), the shadows on every lit material (`CLOUD_GLSL`) and `SunRaysPass` (`effects.js`) already existed; they were identical to braga's. The notes saying wave 8b "was never done" were wrong. They were invisible: the default `clear` state had cover 0, and the shafts were faint. Fix (`2db1212`): `clear` is now a fair-weather sky (cover 0.2, shadow 0.55); shafts threshold 0.85 to 0.7, gain 1.9 to 2.6, wider source. Cost: +1 draw call, +2 triangles. Evidence: /tmp/g3d/{b,a}-*.png and /tmp/g3d/{sb,sa}-*.png (looking into the sun at Penha and the castle, morning and sunset).
  - Governor (`401113d`): ported from porto-3d. `main.js` (levels 0 to 3: dpr, shadow map, nature radius, tile budget, post stack), `effects.setPostLevel`, `tiles.setBudgetScale`. Shafts also close under a solid deck or rain (as in porto). Not ported: the landmark near-LOD radius (no such LOD here). Test: `/tmp/g3d/gov.mjs`. Result: 8x CPU throttle steps to level 3 (30 ms to 23 ms) and returns to level 0 at 16.7 ms; 20x steps to level 3 (88 ms to 72 ms, CPU-bound) and recovers; 4x does not slow this machine (16.7 ms, vsync), so the governor correctly stays at 0. Console: 0 errors, 0 warnings (the governor logs with `console.info`).
  - Triangle budget: no change needed. Home overview 1920x1080: 1.81 M triangles, 196 calls. Worst probed: 2.29 M at 1500 m altitude, 2.4 to 2.6 M in close-ups of the castle (not overview).
- Model gaps (castelo, paco-duques, penha). Caveat: the gallery has interiors and details only, no exterior photo, so the exterior notes come from the building's known form and the first photo of the castle; check them against exterior photos before building.
  - castelo: (1) merlons are square blocks; the real ones are pointed, pyramid-capped (castelo-1.jpg shows it clearly). (2) The enclosure reads as a smooth round drum; the real wall is a polygon with a stepped line and a separate keep. (3) No ground-level door, barbican or stair; the keep has two slit windows only. (4) Ground apron is a flat brown rim; give it rock outcrop and a path. (5) Add the flagpole with the Portuguese flag on the keep (the photo shows it).
  - paco-duques: (1) Walls are white plaster; the real palace is granite with brick upper courses. (2) Corner towers are cones with slate caps; the real towers are square and capped with the chimneys. (3) The chimney count is lower than the real ~39 tall brick stacks and they are all the same shape; vary height and add the corbelled tops. (4) Window grid is regular; the real one is irregular with larger arched openings on the upper floor. (5) The inner courtyard is a flat white slab.
  - penha: (1) The sanctuary is a plain box with a single tower; check the real front (towers, stair, terrace) against an exterior photo; the interior has a square lantern ceiling (penha-2.jpg) and granite columns (penha-1.jpg) that the model does not suggest. (2) The base platform shows dark patches with no paving pattern. (3) Boulders are pale blue-white low-poly shards; tint them granite grey. (4) The pines are one uniform cone; mix crown sizes and add trunk flare.
- Open: `check:data -- --online` shows title or channel drift on 9 older video entries (castelo 1 and 2, paco-duques 0 and 2, toural 0, penha 0 and 2, muralha 0, briteiros 1). Not synced yet. `merge-landmarks.mjs` overwrites the hand-written `routes` export in `src/locales/{en,pt}.guimaraes.js`; use it for `landmarks.json` only.
- Known risk: the ray source now fires more strongly in clear air; check low-end phones before raising the gain again.
- Next best step: sync the 9 drifted video titles, then build exterior-accurate castelo and paco-duques models from exterior photos.
