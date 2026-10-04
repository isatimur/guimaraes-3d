# guimaraes-3d — план и статус

Цель: отдельный проект `~/Dev/guimaraes-3d`, свой репозиторий `isatimur/guimaraes-3d`, свой проект Vercel, домен по выбору (конфиг ждёт `guimaraes-3d.com`). Тот же движок, что у braga-3d, но данные, модели, тексты и «характер» города свои.

## Статус (обновлено 2026-10-04)

Готово: раунды 1–4. Репозиторий живёт отдельно, движок скопирован (base
`1784ff3`), данные, модели, тексты и локали Гимарайнша свои. `npm run verify`
зелёный (7/7).

| Раунд | Что | Статус |
|---|---|---|
| 1 | Скелет, конфиг, оболочка, зелёная сборка | готово (`gui-001`) |
| 2 | Геоданные и контент: рельеф, здания, дороги, тайлы, MS-здания, 18 мест RU/EN/PT, фото, 3 маршрута, история 10 глав | готово (`gui-002`…`gui-008`) |
| 3 | 18 моделей 1:1 на реальных контурах, ≈174.6k треугольников | готово (`gui-009`) |
| 4 | «Характер» города: палитра, метка-замок, рассвет, кино, сезоны, мобильный вид, шаринг `/og` и `/p/<id>/`, README | готово (`gui-010`, `gui-011`) |
| 5 | Деплой на Vercel и домен | **осталось** (`gui-012`) |

Открытые пункты:

- **Деплой (раунд 5)**: `vercel link`, `vercel --prod`, домен (ждёт
  `guimaraes-3d.com`), проверка `/p/castelo/`, `/og/`, `/api/adsb`.
- **GTFS**: фида для Гимарайнша нет (`data/gtfs/` отсутствует), автобусный слой
  выключен. Искать фид TUG на dados.gov.pt / NAP; иначе — расписание только до
  Пеньи плюс канатная дорога.
- **Панорамы 360°**: `check:data` видит 0 панорам — ни одного проверенного
  `projectionType`; галереи и видео для всех мест есть.
- **Теги дорог в кольцевых тайлах** (мосты/тоннели за ядром) — не сделаны и в
  Браге (наследуется).
- **Синхронизация движка** с braga-3d: механизм есть (`scripts/sync-engine.sh`),
  регулярных переносов пока не было.
- **Доступность**: базовый аудит сделан (имена, фокус, reduced-motion,
  high-contrast; `scripts/a11y-check.mjs`); остаётся проверить экранным
  диктором на реальном устройстве.

## 0. Что уже есть (лежит в `~/Dev/braga-3d`, коммит `c2f746e`)

| Что | Где | Состояние |
|---|---|---|
| Конфиг города | `cities/guimaraes.json` | готов: центр, ядро 41.41–41.475 × −8.34…−8.24, кольцо 41.36–41.53 × −8.42…−8.16, Пенья как холм, 18 кандидатов |
| Контуры OSM + размеры | `data/guimaraes/footprints.json`, `dimensions.json`, `new/*.osm.json` | готово для всех 18, со ссылками; канатная дорога как `cable` + 14 опор + 2 станции |
| Рельеф EU-DEM | `data/guimaraes/terrain.json` | готов (центр 190 м, замок 229 м, Пенья 555 м) |
| Здания OSM ядра | `data/guimaraes/buildings.json` | 3 831 (OSM в Гимарайнше редкий; Microsoft-слой дольёт) |
| Дороги ядра с тегами, зелень | `roads.json`, `nature.json` | готово |
| Кольцевые тайлы | `data/guimaraes/tiles/` | готовы: 362 тайла (Overpass оказался быстрее прогноза) |
| Microsoft-здания | `data/guimaraes/buildings-ms.json`, `tiles-ms/` | готовы, ядро и кольцо |
| Оси трафика | `data/guimaraes/traffic-axes.json` | готовы |
| Фото Commons | `assets/img/guimaraes/` | 108 файлов, проверены, ≤ 600 КБ |
| Тексты RU/EN/PT | `data/guimaraes/new/` | готовы 3 из 18: oliveira, paco-duques, sao-tiago |
| Временный список мест | `data/guimaraes/landmarks.json` | заглушки с `_provisional: true`, чтобы модели рендерились |
| Модели | `src/models/guimaraes/` | нет ни одной; реестр `src/models/index.guimaraes.js` пустой |
| Многогородской движок | `src/city.js`, `--city` во всех скриптах | готов, Брага не изменилась |

## 1. Решение по структуре: отдельная папка, движок копией

Два варианта, рекомендую первый.

**A. Шаблон-форк (быстро, рекомендуется сейчас).** `guimaraes-3d` = клон braga-3d, из которого убраны брагские данные, модели, локали и `public/`. Движок дублируется. Обновления движка переносятся cherry-pick'ом (за ним следит `scripts/sync-engine.sh`, см. 2.1). Цена: 1 раунд, ~100k токенов.

**B. Общий движок как пакет.** Вынести `src/` (кроме `models/<город>/`, `locales/*.<город>.js`) и `scripts/` в `~/Dev/city-3d` и подключать как git-зависимость. Правильно на трёх и более городах. Цена: 2–3 раунда, риск сломать Брагу. Делать после Порту.

Структура `guimaraes-3d` при варианте A:

```
guimaraes-3d/
  city.json                 ← из cities/guimaraes.json (единственный город, VITE_CITY не нужен)
  src/                      ← движок как есть; src/models/guimaraes/*.js; src/models.js регистрирует только их
  src/locales/{ui,en,pt}.js ← ui общий; en/pt только тексты Гимарайнша
  data/                     ← бывший data/guimaraes/* (плоско, как у Браги)
  assets/img/               ← бывший assets/img/guimaraes/*
  public/                   ← свои иконки, manifest, og/, p/ (make-og генерирует)
  scripts/                  ← как есть; дефолт города = guimaraes
  cities/guimaraes.json     ← та же копия (скрипты читают отсюда)
  vercel.json, .vercelignore, .gitignore
```

## 2. Раунды

Токены: оценки по фактическим расходам Браги. Модель для агентов: `general-purpose` без override (Fable) или `model: "sonnet"`; `deep-reasoner` закреплён за Opus и упирается в лимит. Один сеанс = один раунд; коммит-чекпоинт перед каждым раундом; агенты не коммитят.

### Раунд 1 — скелет проекта (1 агент, ~100k) — ✅ готово
1. `git clone ~/Dev/braga-3d ~/Dev/guimaraes-3d`, новая история (`rm -rf .git && git init`), origin → `isatimur/guimaraes-3d` (создать на GitHub пустым, публичный/приватный по желанию).
2. Убрать Брагу: `data/{landmarks,footprints,dimensions,roads,buildings*,nature,terrain,routes,story,life,traffic-axes}.json`, `data/tiles*`, `data/gtfs`, `assets/img/*.jpg` (кроме папки guimaraes), `src/models/*.js` брагских билдеров (оставить kit/parts/drape/geom/metric и папку guimaraes), `src/locales/en.js`/`pt.js` содержимое, `public/og`, `public/p`, `cities/braga.json`, `cities/porto.json`, `docs/`, `videos/`.
3. Перенести Гимарайнш наверх: `data/guimaraes/*` → `data/`, `assets/img/guimaraes/*` → `assets/img/`, пути в `landmarks.json`/фрагментах поправить (`assets/img/guimaraes/` → `assets/img/`), `cities/guimaraes.json` `data_dir: "data"`, `landmarks_file: "data/landmarks.json"`; в `src/city.js` дефолт `guimaraes`; `src/models.js` → импорт только `index.guimaraes.js`.
4. `index.html`: статичная шапка/OG под Гимарайнш; `public/manifest.webmanifest`, иконки (make-og `--icons` рисует стилизованный замок вместо лестницы: поправить SVG), `public/sw.js` VERSION `guimaraes-v1`.
5. `scripts/sync-engine.sh`: список файлов движка + `git -C ../braga-3d log` для ручного cherry-pick; README раздел «Движок общий с braga-3d».
6. Проверки: `npm run build`, `check-geo`, `check-dimensions`, `?intro=0` показывает рельеф, дороги, 3,8k зданий и 18 заглушек; консоль без ошибок. Коммит.

### Раунд 2 — данные до конца (2–3 агента параллельно, ~600–900k) — ✅ готово
- **Тексты**: 15 оставшихся мест по методу Браги (RU native → EN/PT native, источники, факты, совет, галерея ≥ 1 интерьер, видео через oEmbed, 360° только с проверенным projectionType). Фото уже скачаны: агенты пишут только фрагменты. Два агента по 7–8 мест, затем слияние в `data/landmarks.json` + локали (третий агент или сам).
- **Тайлы + Microsoft**: уже готовы (см. раздел 0); ничего качать не нужно. Порог `check-geo` для зданий уже 3000.
- **Маршруты**: 3 маршрута в `scripts/fetch-routes.mjs` (таблица по городу): «UNESCO-ядро за полдня» (Toural → Oliveira → São Tiago → Santa Maria → замок → Paço → São Miguel), «Пенья и монастыри» (Santos Passos → teleférico → Penha → Santa Marinha пешком вниз), «Два дня» (всё + Briteiros на такси + стадион + Azurém). OSRM foot через routing.openstreetmap.de.
- **История** `data/story.json`, 10 глав со ссылками: Бритейруш (железный век) → римская Vimaranes → графиня Мумадона и монастырь 950-х → замок → Афонсу Энрикеш и битва при Сан-Мамеде 1128 → Оливейра и Падран-ду-Саладу 1340 → Паçу герцогов XV в. → кожевники Коуруш и текстиль XIX в. → Витория 1922 и стадион Евро-2004 → UNESCO 2001 и столица культуры 2012. Камеры в `src/story.js` таблицей по городу.
- **GTFS**: искать фид TUG на dados.gov.pt / NAP; если нет, автобус по расписанию только до Пеньи + канатная дорога.

### Раунд 3 — модели 1:1 (3 агента по 6 мест, ~450k каждый) — ✅ готово
Как в Браге: авторинг в метрах на контурах OSM, `check-fit --city guimaraes` с правилом «не меньше 97%», `count-tris`, скриншоты рядом с фото, итерации. Группы и опорные брагские билдеры:
- A: castelo (`torre.js` + стены), paco-duques (`raio.js`, 4 угловые башни, цилиндрические трубы, шиферные крыши), sao-miguel-castelo, oliveira (`populo.js`; башня 1513 и Падран), sao-tiago, toural (`praca.js`).
- B: penha (`bomjesus.js`: святилище 1947 из гранита с башней, парк по склону, канатная дорога: тросы, 14 опор, 2 станции, кабины `cabin-N` с `userData.setT`), santos-passos (`congregados.js`), sao-francisco (`populo.js` + клуатр), alberto-sampaio, muralha (`arco.js`), plataforma-artes (`forum.js`, чёрная металлическая сетка).
- C: couros (`termas.js`), santa-marinha (`tibaes.js`), estadio (`estadio.js`, 4 трибуны), uminho-azurem (`uminho.js`), briteiros (круглые дома с соломенными конусами на холме, `drape.js`), vila-flor (`biscainhos.js` + залы 2005).
Скиллы для качества: `3d-high-poly-models`, `3d-high-resolution-textures`, `threejs-towers` (башни замка), `no-ai-design-slop`.

### Раунд 4 — интеграция и «характер» города (2 агента, ~300k) — ✅ готово
- `CINEMA_ORDER` на 18 глав (утро в замке → центр → закат на Пенье с канатной дорогой → ночь над стадионом), `cinema.audit()`.
- Живой город: анимация кабин канатной дороги в `life.js` по именам объектов (как фуникулёр Браги), автобус до Пеньи, трафик по часам (оси: N101/N206, Avenida D. Afonso Henriques), самолёты и погода уже читают конфиг.
- Сезоны: Пенья зимой в снегу выше 500 м; осенние каштаны в центре.
- Шаринг: `make-og --city guimaraes` (сначала починить чёрные рендеры, см. риски), 18 страниц `/p/<id>/`, иконка-замок, открытка с подписью домена.
- Мобильный стартовый вид: замок с Пеньей на фоне.
- README на русском по образцу braga-3d.

### Раунд 5 — деплой (сам, ~20k) — ⏳ осталось
`vercel link --project guimaraes-3d`, `vercel --prod --yes`, домен, проверка `/p/castelo/`, `/og/`, `/api/adsb?city=guimaraes`. Пуш через `!` (хук блокирует push из Claude).

## 3. Чем Гимарайнш должен отличаться от Браги
- Канатная дорога на Пенью как главный «живой» объект (1 700 м, подъём 400 м, кабины ходят).
- История начинается не с Рима, а с «Aqui nasceu Portugal»: замок, Афонсу Энрикеш, 1128.
- Ситания-де-Бритейруш как археологическая глава с круглыми домами.
- Кожевенные баки Коуруш: вода в баках по сезонам.
- Гуалтерианаш (первые выходные августа): режим праздника ночью с гирляндами на Largo do Toural как опция «Событие».
- Стадион Витории и Евро-2004 в главе XX века.

## 4. Риски (исторический список; почти всё закрыто — см. «Статус» выше)
1. **make-og чёрные рендеры** после мультигородского рефакторинга в braga-3d: агент был прерван на диагностике (`window.__braga.ready`/`?ui=0`/тайминг). Чинить в braga-3d, затем перенести.
2. **Бюджет треугольников** общего вида Браги (2,6–3,2 млн против 2,4): тот же LOD-проход нужен и здесь; агент был прерван.
3. **Overpass**: кольцевые тайлы качаются часами; запускать ночью, `--dry-run` показывает план; `city.mjs` порядок шагов: ms-buildings только после tiles.
4. **Лимиты моделей**: за сутки упирались в Opus, Sonnet и Fable по очереди. Раунд = 3–4 агента максимум; чекпоинт-коммит перед раундом; в брифах «RESUME: проверь, что на диске».
5. **Теги дорог в кольцевых тайлах** (мосты/тоннели за ядром) не сделаны и в Браге.
6. **OSM в Гимарайнше редкий**: без Microsoft-слоя окраины пустые.
7. **Автор коммитов**: в braga-3d старые коммиты с почтой swiirl; переписать при чистом дереве (`filter-branch` + force push) до форка, чтобы форк не унаследовал.

## 5. Порту потом
Тот же рецепт, `cities/porto.json` уже есть (20 кандидатов, ядро 41.12–41.19 × −8.68…−8.55). Особенности: Дору с шестью реальными мостами (мосты/тоннели уже умеет), вода по скиллу `3d-ultra-realistic-water` на реку и океан у Фожа, GTFS STCP + метро (два фида), в 4 раза больше данных (тайлы качать ночь-две), модели самые дорогие: Клеригуш, Сан-Бенту с азулежу, Болса, Лелло, Каза-да-Музика.

## 6. Шпаргалка команд
```
# в braga-3d, пока Гимарайнш живёт там
node scripts/city.mjs guimaraes --dry-run
node scripts/city.mjs guimaraes --from tiles          # ночью, run_in_background
node scripts/city.mjs guimaraes --only ms-buildings
node scripts/check-geo.mjs --city guimaraes
node scripts/check-dimensions.mjs --city guimaraes
node scripts/check-fit.mjs --city guimaraes
node scripts/count-tris.mjs --city guimaraes
node scripts/make-og.mjs --city guimaraes --pages --og --icons
http://localhost:5173/?city=guimaraes&intro=0
```
