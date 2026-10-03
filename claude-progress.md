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
- Current highest-priority unfinished feature: `gui-008` (story mode, uncommitted)
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
