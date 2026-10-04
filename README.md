# Guimarães 3D

An interactive browser **3D map of Guimarães — the birthplace of Portugal**. It
draws the real city: EU-DEM terrain with the Penha hill rising to 555 m, the
medieval UNESCO core, tens of thousands of OSM and Microsoft building
footprints, and **18 landmarks as procedural 1:1 models** placed on their real
OSM footprints — the castle, the Palace of the Dukes of Braganza, the Oliveira
church, the city wall and the rest. The UI is in Portuguese, English and
Russian.

This repository is a **single-city fork** of the shared `city-3d` engine. Every
place-specific constant, model, text and photo lives here; the engine is shared
with Braga 3D and `porto-3d` (see [Engine lineage](#engine-lineage)).

## The city

Guimarães is where Portugal begins. The medieval centre is a UNESCO World
Heritage Site (2001) and the country's first capital, built around a compact
granite core:

- **Guimarães Castle** — the 10th-century fortress rebuilt under King Dinis.
- **Paço dos Duques de Bragança** — the 15th-century palace of the Dukes.
- **Nossa Senhora da Oliveira** and the old squares (Toural, São Tiago).
- **Penha** — the wooded mountain above the city, reached by cable car, with
  the Sanctuary of Penha and the monastery of Santa Marinha da Costa.
- Beyond the core: the Citânia de Briteiros (Iron Age hillfort), Couros, the
  Estádio D. Afonso Henriques and the University of Minho campus.

The city's story, *“Aqui nasceu Portugal”* — the wall and the Alfândega tower,
the battle of São Mamede in 1128 — is the thread that runs through the content.

## Features

- **18 landmarks**, each a recognisable 1:1 procedural model on its real
  footprint (≈174.6k triangles total, within the per-model and total budgets).
- **Guided routes** — three authored walking/transit itineraries, drawn on the
  map with an itinerary card and a fly-along.
- **Story mode** — ten chapters following Guimarães from the Iron Age to
  UNESCO, with camera moves and sources.
- **Cinema** — an eighteen-stop film that flies the city from dawn to night.
- **Live sun and weather** — time of day (morning / day / sunset / night),
  four seasons and live Open-Meteo weather, with a living street level
  (calçada, trees, terraces, people) and the animated Penha cable car.
- **Search** — one field for places, streets, POIs and routes, with an
  “open now” filter.
- **Seasonal world** — spring blossom and petals, autumn leaves, winter snow
  above ~450 m on Penha, with matching light and ground colours.
- **PWA** — installable manifest, an offline service worker and per-landmark
  share pages (`/og/`, `/p/<id>/`).
- **Accessibility** — a keyboard-reachable UI with visible focus rings,
  labelled icon-only controls, and `prefers-reduced-motion` /
  `prefers-contrast: more` support.

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

## Stack

- Vite + three.js, plain ES modules, no framework.
- Node 22 for the data pipeline (no runtime dependencies).
- Deployed on Vercel (one project per city).

## Run it

```
npm install
npm run dev          # http://localhost:5173
npm run verify       # the gate: build + every check (see Verification)

# useful query flags while developing
#   ?intro=0        skip the opening
#   ?ui=0           hide the chrome
#   #cinema         open a guided mode directly (also #story, #place=<id>)
```

`vite.config.js` serves `/data`, `/assets` and `/cities` from the project root
in dev and copies them into `dist/` on build. The city resolves in
`src/city.js` (single city: `guimaraes`).

## Data pipeline

Everything geographic is built from OpenStreetMap, Microsoft Global ML Building
Footprints, EU-DEM 25 m terrain and Open-Meteo. Raw replies are cached in
`data/.cache/` (gitignored). The pipeline is resumable and idempotent.

```
node scripts/city.mjs guimaraes --dry-run          # print the plan
node scripts/city.mjs guimaraes                    # terrain, buildings,
                                                   # ms-buildings, roads, nature,
                                                   # tiles, traffic-axes, gtfs
node scripts/city.mjs guimaraes --from tiles       # resume at a step
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
scripts/        data pipeline, checks, verify.mjs and the a11y assertion
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
- Live weather, clock-driven traffic and a living street level (calçada, trees,
  terraces, people) with the animated Penha cable car.
- A scheduled bus layer exists in the engine but has **no Guimarães feed** yet
  (see [Status](#status)); it stays off until a GTFS source is authored.

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

The accessibility assertions are a separate, optional harness step (Playwright
is not a project dependency). With the dev server running:

```
node scripts/a11y-check.mjs          # http://localhost:5181/ by default
```

It asserts every visible button, link, tab, select and combobox has a
non-empty accessible name, and that every control reached by the Tab key shows
a visible focus ring; it also fails on page errors.

## Engine lineage

Forked from **braga-3d**, which remains the engine source of truth. The engine
base is recorded in `scripts/engine-base.txt`; `scripts/sync-engine.sh` reports
(or `--apply` carries over) engine changes from Braga. Braga-specific content
was stripped and replaced with Guimarães data, models and locales — the
`guimaraes` fork keeps its own palette, castle mark, dawn opening and cinema
order.

## Status

Complete and green: 18/18 landmarks with 1:1 models (≈174.6k triangles),
terrain/buildings/roads/nature, ring tiles and Microsoft buildings, credited
photos and RU/EN/PT content, three routes, a 10-chapter story mode, cinema and
the living city. The desktop and mobile UI were audited for accessibility
(focus rings, accessible names, reduced motion, high contrast).

## Credits

Landmark photographs come from Wikimedia Commons under free licences, with the
author, licence and source recorded per image in `data/landmarks.json` and
`assets/` credits.
