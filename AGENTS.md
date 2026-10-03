# AGENTS.md

guimaraes-3d is a single-city fork of the **braga-3d** engine: an interactive
browser 3D map of Guimarães (Vite + three.js, plain ES modules). Everything
place-specific lives in `cities/guimaraes.json` and `data/`; the engine is shared.

This file is a **map, not a manual**. Read the pointer, then follow it. Keep
this under ~100 lines; put detail in `README.md`, `PLAN.md`, or `docs/`.

## Startup Workflow

Before writing code:

1. `pwd` — confirm you are in `guimaraes-3d`.
2. Read `claude-progress.md` — latest verified state and next step.
3. Read `feature_list.json` — pick the highest-priority unfinished feature.
4. `git log --oneline -5` — see what landed.
5. `./init.sh` — install + baseline verification.
6. If baseline verification fails, **fix that first**.

## Working Rules

- Work on **one feature at a time**; do not half-finish several.
- Do not mark a feature passing just because code was added.
- Keep changes in the selected feature's scope unless a blocker forces a narrow fix.
- Never hand-edit generated geodata in `data/*.json`; regenerate via the pipeline.
- Do not silently weaken `scripts/verify.mjs` or a check to make a feature pass.
- Prefer durable repo artifacts over chat summaries.

## Verification — Definition Of Done

`npm run verify` is the gate. It builds the app and runs every check whose
input data exists (missing inputs are skipped, not faked). A feature is done
only when:

- the user-visible behavior is implemented,
- `npm run verify` was actually run and passed,
- evidence is recorded in `feature_list.json` / `claude-progress.md`,
- the repo is restartable from `./init.sh`.

Commands (all default to `--city guimaraes`):

```
npm run verify              # build + every check (the gate)
npm run check:data          # landmarks/routes content contract, licenses, photos
npm run check:geo           # footprints, buildings, terrain, landmark osm
npm run check:dimensions    # real-world dimensions + sources
npm run check:fit           # 1:1 fit vs OSM (>=97 %, hard fail)
npm run check:traffic       # street network + traffic invariants
npm run check:models        # triangle budgets (4k..40k/model, <=600k total)
```

## Data Pipeline

Resumable, idempotent, raw replies cached in `data/.cache/` (gitignored).

```
node scripts/city.mjs guimaraes --dry-run      # print the plan
node scripts/city.mjs guimaraes                # run remaining steps
node scripts/city.mjs guimaraes --from tiles   # resume at a step
node scripts/city.mjs guimaraes --only ms-buildings
node scripts/check-geo.mjs --city guimaraes
```

Step order matters: `ms-buildings` runs **after** `tiles`.

## Layout

```
src/            three.js engine; src/models/guimaraes/ is Guimarães' landmark builders
scripts/        data pipeline, checks, and verify.mjs
api/            Vercel functions: live aircraft, route lookup, AI guide
cities/         guimaraes.json — every place-specific constant
data/           generated geodata (terrain, roads, buildings, tiles, ...)
assets/img/     landmark photos (credited Commons, free licences)
public/         PWA manifest, service worker, icons, share pages
index.html      static shell (crawlers + first paint)
PLAN.md         project plan and remaining rounds
```

## Engine Lineage

Forked from braga-3d (engine base recorded in `scripts/engine-base.txt`; see
`PLAN.md`). Braga is the engine source of truth. Use `scripts/sync-engine.sh`
to report (or `--apply`) engine changes.

## Hard Constraints

- Node 22 (`.nvmrc`, `engines`). Plain ES modules, no framework.
- Landmark models are authored in metres on real OSM footprints.
- Photos must be free-licensed; `check:data` rejects NC/ND.
- Never commit `data/.cache/`, `dist/`, or `node_modules/`.

## End Of Session

1. Update `claude-progress.md`.
2. Update `feature_list.json` (status + evidence).
3. Record any blocker or risk.
4. Commit only when the repo is in a safe, restartable state.
5. Leave it clean enough that the next session can run `./init.sh` immediately.

Use `clean-state-checklist.md` to close out, `session-handoff.md` for larger
sessions, and `evaluator-rubric.md` before accepting a feature.
