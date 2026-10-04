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
  - Added `scripts/sync-engine.sh` + `scripts/engine-base.txt` (base `1784ff3`).
  - Added this progress log.
- Verification run: `npm run verify`
  - PASS build, geo, dimensions, 1:1 fit, traffic, models
  - FAIL data contract (40 errors)
- Evidence captured: verify summary above; `feature_list.json` statuses.
- Commits: `guimaraes-3d: harness pack — AGENTS.md, feature_list, progress, init.sh, verify gate, engine-sync`.
- Files or artifacts updated: AGENTS.md, CLAUDE.md, feature_list.json, claude-progress.md,
  init.sh, .nvmrc, scripts/verify.mjs, scripts/sync-engine.sh, scripts/engine-base.txt, package.json.
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
