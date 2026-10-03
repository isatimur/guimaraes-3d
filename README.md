# Guimarães 3D

An interactive browser 3D map of **Guimarães, Portugal — the birthplace of the
nation**. Real EU-DEM terrain (the Penha hill rising to 555 m), the medieval
core, tens of thousands of OSM + Microsoft buildings, and 18 landmarks as
procedural **1:1 models** on their real footprints: the castle, the Palace of
the Dukes of Braganza, the Oliveira church, the city wall, the Citânia de
Briteiros and the rest. Time of day, weather, seasons, the animated Penha cable
car, a cinema tour, story mode, routes and an AI guide. UI in Portuguese,
English and Russian.

The engine is shared with [Braga 3D](https://braga-3d.com) and `porto-3d`; this
repository is a **single-city fork** — everything place-specific comes from
`cities/guimaraes.json`, `data/`, `src/models/guimaraes/` and
`src/locales/*.guimaraes.js`.

## Its own character

- **Granite and Penha** palette, a castle wordmark, a dawn opening and a
  Guimarães cinema order — deliberately distinct from Braga and Porto.
- The story of *“Aqui nasceu Portugal”*: the castle, the wall and the
  Alfândega tower, the Dukes' Palace, and the monasteries and squares of the
  old town.

## Stack

- Vite + three.js, plain ES modules, no framework.
- Node 22 for the data pipeline (no runtime dependencies).
- Deployed on Vercel (one project per city).

## Build

```
npm install
npm run dev          # http://localhost:5173
npm run build        # copies data/, assets/, cities/ and public/ into dist/
npm run preview
npm run verify       # the gate: build + every check (see Verification)
```

`vite.config.js` serves `/data`, `/assets` and `/cities` from the project root
in dev and copies them into `dist/` on build. The city resolves in
`src/city.js` (single city: `guimaraes`).

## The 18 places

| id | Place | Kind |
|---|---|---|
| `castelo` | Guimarães Castle | civic |
| `paco-duques` | Palace of the Dukes of Braganza | museum |
| `sao-miguel-castelo` | Church of São Miguel do Castelo | religious |
| `oliveira` | Church of Nossa Senhora da Oliveira | religious |
| `sao-tiago` | Largo de São Tiago | street |
| `toural` | Largo do Toural | street |
| `penha` | Sanctuary of Penha + cable car | religious |
| `santos-passos` | Church of Nossa Senhora dos Santos Passos | religious |
| `sao-francisco` | Church of São Francisco | religious |
| `alberto-sampaio` | Alberto Sampaio Museum | museum |
| `muralha` | City wall and Alfândega tower | archaeology |
| `plataforma-artes` | Platform of Arts and Creativity | museum |
| `couros` | Couros zone | archaeology |
| `santa-marinha` | Monastery of Santa Marinha da Costa | religious |
| `estadio-afonso-henriques` | Estádio D. Afonso Henriques | sport |
| `uminho-azurem` | University of Minho — Azurém campus | education |
| `briteiros` | Citânia de Briteiros | archaeology |
| `vila-flor` | Vila Flor Palace and Cultural Centre | civic |

Each landmark card carries Russian source text with English and Portuguese
translations, credited free-licence photos, facts, a source list and a tip.

## Data pipeline

Everything geographic is built from OpenStreetMap, Microsoft Global ML Building
Footprints, EU-DEM 25 m terrain and Open-Meteo. Raw replies are cached in
`data/.cache/` (gitignored). The pipeline is resumable and idempotent.

```
node scripts/city.mjs guimaraes --dry-run          # print the plan
node scripts/city.mjs guimaraes                    # terrain, buildings,
                                                   # ms-buildings, roads, nature,
                                                   # tiles, traffic-axes, gtfs
node scripts/city.mjs guimaraes --from tiles        # resume at a step
node scripts/city.mjs guimaraes --only ms-buildings
node scripts/check-geo.mjs --city guimaraes
```

Step order matters: `ms-buildings` runs **after** `tiles`. The core bbox is
`41.41–41.475 × −8.34…−8.24` with a wide ring beyond it; `scripts/city-lib.mjs`
derives the tile grid, terrain lattice and projection from
`cities/guimaraes.json`.

Content is authored per landmark in `data/new/<id>.content.json` (Russian
source), `.en.json` and `.pt.json`, then folded into the runtime data and
locales:

```
node scripts/merge-landmarks.mjs --city guimaraes
```

## Layout

```
src/            the three.js engine; src/models/guimaraes/ is Guimarães' builders
scripts/        data pipeline, checks, and verify.mjs
api/            Vercel functions: live aircraft (adsb), route lookup, AI guide
cities/         guimaraes.json — every place-specific constant
data/           generated geodata (terrain, roads, buildings, tiles, ...)
assets/img/     landmark photos (credited Wikimedia Commons, free licences)
public/         PWA manifest, service worker, icons, share (/og, /p) pages
index.html      static shell (crawlers + first paint)
PLAN.md         the project plan and remaining rounds
AGENTS.md       the agent operating manual (start here)
```

## Live layers

- Aircraft over the region (ADS-B), an authored route lookup, and the AI guide,
  served by the `api/` Vercel functions.
- Transit from GTFS, weather and a living street level (calçada, trees,
  terraces, people) and the Penha cable car.

## Verification

`npm run verify` builds the app and runs every check whose input data exists:

```
npm run check:data          # content contract, licences, photo/image checks
npm run check:geo           # footprints, buildings, terrain, landmark osm
npm run check:dimensions    # real-world dimensions + sources
npm run check:fit           # 1:1 fit vs OSM (>=97 %, hard fail)
npm run check:traffic       # street-network and traffic invariants
npm run check:models        # triangle budgets (4k..40k/model, <=600k total)
```

## Status

Complete and green: 18/18 landmarks with 1:1 models (≈174.6k triangles),
terrain/buildings/roads/nature, ring tiles and Microsoft buildings, credited
photos and RU/EN/PT content, three routes, a 10-chapter story mode and the
living city. `npm run verify` passes all checks.

## Credits

Landmark photographs come from Wikimedia Commons under free licences, with the
author, licence and source recorded per image in `data/landmarks.json` and
`assets/` credits.
