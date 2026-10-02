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
- Current highest-priority unfinished feature: `gui-003` (content contract)
- Current blocker: `check:data` — 40 errors, starting with route `penha-day` legs pts not rounded to 5 decimals

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
