# Cities

One JSON per city. `src/` and `scripts/` read every place-specific constant from here, so a new city is a config file, a landmark list and the usual agent rounds (data → models → integration).

## Status

| City | Config | Data pipeline | Landmarks | Live |
|---|---|---|---|---|
| Braga | `braga.json` | done (`data/`; all constants now come from the config) | 30 | https://braga-3d.com |
| Guimarães | `guimaraes.json` | not run (`npm run city -- guimaraes --dry-run` prints the plan) | 18 candidates | – (`?city=guimaraes` loads: empty list, no data yet) |
| Porto | `porto.json` | not run | 20 candidates | – |

## How the city is chosen

`src/city.js` resolves the id, in this order: `?city=<id>` in the query → `VITE_CITY` at build time → the hostname (`braga-3d.com` → braga; any `<id>-3d.com`) → `braga`. It then fetches `/cities/<id>.json` before `start()` and exports `CITY`. `vite.config.js` copies `cities/` into `dist/`; the dev server serves it from the root.

## Config schema (as implemented)

| Key | Used by |
|---|---|
| `id`, `name {pt,en,ru}`, `name_ru_cases {gen,prep,ins}` | shell strings, badges (`cityT()`: `{city}`, `{city_gen}`, `{city_prep}`, `{city_ins}`) |
| `domain`, `hostnames`, `og_image` | canonical/og tags, share links, the postcard footer, `make-og` |
| `origin {lat,lon}` | scripts' projection; the app's origin comes from `roads.json` (placeholder: the config) |
| `core_bbox`, `wide_bbox` | fetchers, checks, `fetch-ms-buildings` (wide) |
| `tiles {core_nx, core_ny, ext}` | the 1 km tile grid (derived from the bboxes when absent; Braga pins 11 × 6, +5/5/6/6) |
| `terrain {dataset, spacing_m, lattice {cols,rows,ext}, probes}` | `fetch-terrain`, `check-geo` (Braga pins 90 × 60, +41/41/59/59) |
| `timezone` | live clock, sun times, traffic model, GTFS metadata |
| `transit {gtfs_url, operator, operator_long, catalogue, gtfs_rt}` | `fetch-gtfs`, the bus badge |
| `aircraft {lat, lon, radius_nm}` | `api/adsb.js`, `api/route.js` (`?city=<id>`, validated against these files) |
| `weather {lat, lon}` | Open-Meteo, sun position |
| `traffic {car_free, axes_bbox, axes_base}` | `life.js` car-free zones, `fetch-traffic-axes` |
| `nature {hills}` | tree budget boost (`nature.js`), `fetch-nature` sanity |
| `start_view {landmark, narrow_landmark}` | phone home pose, `make-og` hero |
| `data_dir`, `landmarks_file` | every data path (`data/` for Braga, `data/<id>/` for the others) |
| `ms_centre` | `fetch-ms-buildings` centre bump (Braga: the Sé; default: origin) |
| `description {pt,en,ru}` (optional), `country {pt,en,ru}` (optional) | meta description, postcard subtitle (defaults: the Braga templates, "Португалия") |
| `landmark_candidates` | the landmark agents |

## Pipeline

`npm run city -- <id>` (`scripts/city.mjs`) runs terrain → buildings → ms-buildings → roads → nature → tiles → traffic-axes → gtfs with `--city <id>`, skips steps whose output exists (`--force`, `--from`, `--only`), and prints the next manual steps. `--dry-run` prints the plan only. Every fetcher and check takes `--city <id>` (default braga) and `--dry-run` where it fetches; `scripts/city-lib.mjs` loads the config and `geo-lib.mjs` derives `BBOX`, `ORIGIN`, `TILE_GRID`, `TERRAIN_LATTICE`, `DATA_DIR` from it.

Per-city code: models in `src/models/<id>/` registered by `src/models/index.<id>.js` (`{ builders, specs }`; Braga's stay in `src/models.js`); landmark texts in `src/locales/{en,pt}.<id>.js` (Braga keeps `en.js` / `pt.js`).

## Deploy

One Vercel project per city, same repo. Set the environment variable `VITE_CITY=<id>` in each project (Braga's project may leave it unset: the hostname map resolves it). `vercel.json` ships `cities/*.json` with the API functions (`includeFiles`); the page calls `/api/adsb?city=<id>` and `/api/route?…&city=<id>` for every city but Braga, whose cache keys stay as they were. `public/` (manifest, icons, share pages, og images) is still one set per repo: a second deployed city needs its own `public/` or a per-city `make-og` target.

## Why Guimarães before Porto

Guimarães is Braga-sized, 22 km away, its wide bbox overlaps Braga's, and it proves the multi-city pipeline cheaply. Porto is ~4× the data, with the Douro and six real bridges, and benefits from a pipeline that already works.
