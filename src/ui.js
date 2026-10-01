import { t, language, locale } from './i18n.js';
// DOM side of the app: side column (places, routes), detail panel with tabs,
// route itinerary, legend, toast, loader, counter.
import { assetUrl } from './data.js';
import { createLightbox, renderGallery, creditNode } from './gallery.js';
import { renderVideos } from './video.js';
import { panoramaThumbUrl } from './panorama.js';
import { MODE_RU, MODE_STYLE } from './routes.js';

const CATEGORY_RU = {
  religious: t('Храмы'),
  religion: t('Храмы'),
  church: t('Храмы'),
  civic: t('Город'),
  city: t('Город'),
  park: t('Сады'),
  garden: t('Сады'),
  museum: t('Музеи'),
  education: t('Образование'),
  university: t('Образование'),
  sport: t('Спорт'),
  archaeology: t('Археология'),
  street: t('Улицы'),
  monument: t('Памятники'),
  palace: t('Дворцы'),
  nature: t('Природа'),
  other: t('Разное'),
};
export const categoryLabel = (c) => t(CATEGORY_RU[String(c).toLowerCase()] ?? c);

// 1 место, 2–4 места, 5+ мест (with 11–14 as мест)
export function placesWord(n) {
  if (language === 'pt') return n === 1 ? 'local' : 'locais';
  if (language === 'en') return n === 1 ? 'place' : 'places';
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'место';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'места';
  return 'мест';
}

// 1 остановка, 2–4 остановки, 5+ остановок; same rule as placesWord
const stopsWord = (n) => language === 'pt' ? (n === 1 ? 'paragem' : 'paragens') : language === 'en' ? (n === 1 ? 'stop' : 'stops') : ({ место: 'остановка', места: 'остановки', мест: 'остановок' })[placesWord(n)];
const nf1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
export const fmtDistance = (m) => (m == null ? '' : m < 1000 ? `${Math.round(m / 10) * 10} ${language === 'ru' ? 'м' : 'm'}` : `${nf1.format(m / 1000)} ${language === 'ru' ? 'км' : 'km'}`);
export const fmtKm = (km) => (km == null ? '' : `${nf1.format(km)} ${language === 'ru' ? 'км' : 'km'}`);
export function fmtMinutes(min) {
  if (min == null || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} ${language === 'ru' ? 'мин' : 'min'}`;
  return m ? `${h} ${language === 'ru' ? 'ч' : 'h'} ${m} ${language === 'ru' ? 'мин' : 'min'}` : `${h} ${language === 'ru' ? 'ч' : 'h'}`;
}

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// A line sample in the route colour with the mode's dash pattern.
function modeSwatch(mode, color) {
  const st = MODE_STYLE[mode] || MODE_STYLE.foot;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 8');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('swatch-line');
  const line = document.createElementNS(ns, 'line');
  Object.entries({ x1: 2, y1: 4, x2: 22, y2: 4, stroke: color, 'stroke-width': mode === 'funicular' ? 3 : 2.6, 'stroke-linecap': st.svg ? 'butt' : 'round' }).forEach(([k, v]) => line.setAttribute(k, v));
  if (mode === 'funicular') line.setAttribute('stroke-linecap', 'round');
  if (st.svg) line.setAttribute('stroke-dasharray', st.svg);
  svg.append(line);
  return svg;
}

// ARIA tabs: roving tabindex, arrows/Home/End move and activate.
function wireTablist(list, onPick) {
  list.addEventListener('keydown', (e) => {
    const tabs = [...list.querySelectorAll('[role="tab"]:not([hidden])')];
    const cur = tabs.indexOf(document.activeElement);
    if (cur < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (cur + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (cur - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    e.stopPropagation();
    tabs[next].focus();
    onPick(tabs[next]);
  });
  list.addEventListener('click', (e) => {
    const t = e.target.closest('[role="tab"]');
    if (t) onPick(t);
  });
}
function setSelected(list, tab) {
  for (const t of list.querySelectorAll('[role="tab"]')) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  }
}

export function createUI(landmarks, routes, h) {
  const listEl = $('#place-list');
  const chipsEl = $('#chips');
  const countEl = $('#count');
  const panel = $('#detail');
  const img = $('#detail-img');
  const fig = $('#detail-figure');
  const tabsEl = $('#detail-tabs');
  const body = $('#detail-body');
  const routePanel = $('#route-panel');
  const hidden = new Set();
  const lightbox = createLightbox();

  // ------------------------------------------------------------ side: places
  const cats = [...new Set(landmarks.map((l) => l.category))];
  for (const c of cats) {
    const b = el('button', 'chip', categoryLabel(c));
    b.type = 'button';
    b.setAttribute('aria-pressed', 'true');
    b.addEventListener('click', () => {
      if (hidden.has(c)) hidden.delete(c);
      else hidden.add(c);
      b.setAttribute('aria-pressed', String(!hidden.has(c)));
      refreshFilter();
      h.onFilter(hidden);
    });
    chipsEl.append(b);
  }

  const rows = landmarks.map((l, i) => {
    const li = el('li');
    const b = el('button', 'place');
    b.type = 'button';
    b.append(el('span', 'place-name', l.name), el('span', 'place-tag', categoryLabel(l.category)));
    b.addEventListener('click', () => h.onSelect(i));
    li.append(b);
    listEl.append(li);
    return { li, b, l };
  });

  function refreshFilter() {
    let n = 0;
    for (const r of rows) {
      const off = hidden.has(r.l.category);
      r.li.hidden = off;
      if (!off) n++;
    }
    // a city with no landmark list yet says so instead of "0 мест"
    countEl.textContent = rows.length ? `${n} ${placesWord(n)}` : t('пока без достопримечательностей');
  }
  refreshFilter();

  // ------------------------------------------------------------ side: routes
  const sw = $('#side-switch');
  const viewPlaces = $('#view-places');
  const viewRoutes = $('#view-routes');
  const routeRows = new Map();
  if (routes.length) {
    sw.hidden = false;
    for (const r of routes) {
      const li = el('li');
      const b = el('button', 'route-item');
      b.type = 'button';
      b.style.setProperty('--c', r.color);
      const sws = el('span', 'route-swatch');
      sws.setAttribute('aria-hidden', 'true');
      const text = el('span', 'route-text');
      text.append(el('span', 'route-name', r.name));
      const meta = [r.duration, fmtKm(r.distance_km), `${r.stops.length} ${stopsWord(r.stops.length)}`].filter(Boolean).join(' · ');
      text.append(el('span', 'route-meta', meta));
      if (r.subtitle) text.append(el('span', 'route-sub', r.subtitle));
      b.append(sws, text);
      b.addEventListener('click', () => h.onRouteSelect(r.id));
      li.append(b);
      $('#route-list').append(li);
      routeRows.set(r.id, b);
    }
  }
  let view = 'places';
  function setView(v) {
    view = v;
    const tab = v === 'routes' ? $('#tab-routes') : $('#tab-places');
    setSelected(sw, tab);
    viewPlaces.hidden = v !== 'places';
    viewRoutes.hidden = v !== 'routes';
  }
  wireTablist(sw, (t) => setView(t.id === 'tab-routes' ? 'routes' : 'places'));

  // ------------------------------------------------------------ detail panel
  $('#detail-close').addEventListener('click', () => h.onClose());
  $('#detail-back').addEventListener('click', () => h.onBack());
  $('#detail-prev').addEventListener('click', () => h.onStep(-1));
  $('#detail-next').addEventListener('click', () => h.onStep(1));
  img.addEventListener('error', () => fig.classList.add('is-missing'));
  img.addEventListener('load', () => fig.classList.remove('is-missing'));

  const TABS = ['overview', 'history', 'gallery', 'video', 'pano'];
  let current = null; // landmark shown
  let tab = 'overview';

  // Leaving a tab with a live YouTube iframe: re-render its cards, which
  // removes the iframe and stops playback. `next` null means "panel closes".
  function stopPlayback(next = null) {
    if (!current) return;
    if (tab === 'video' && next !== 'video') renderVideos($('#panel-video'), current.videos);
    if (tab === 'pano' && next !== 'pano' && current.panorama?.type === 'youtube') fillPanoVideo(current.panorama);
  }

  function selectTab(name) {
    if (name === tab && !$(`#panel-${name}`).hidden) return;
    stopPlayback(name);
    tab = name;
    setSelected(tabsEl, $(`#tab-${name}`));
    for (const t of TABS) $(`#panel-${t}`).hidden = t !== name;
    if (name === 'pano' && current?.panorama?.type === 'image') {
      const th = $('#pano-thumb');
      if (!th.dataset.for || th.dataset.for !== current.id) {
        th.src = panoramaThumbUrl(current.panorama);
        th.dataset.for = current.id;
      }
    }
    body.scrollTop = 0;
  }
  wireTablist(tabsEl, (t) => selectTab(t.dataset.tab));
  $('#pano-open').addEventListener('click', (e) => current?.panorama?.type === 'image' && h.onPanorama(current.panorama, e.currentTarget));

  function fillOverview(l) {
    fig.classList.remove('is-missing');
    fig.classList.add('is-loading');
    img.onload = () => fig.classList.remove('is-loading');
    img.alt = l.name;
    if (l.image) img.src = assetUrl(l.image);
    else fig.classList.add('is-missing');
    $('#detail-short').textContent = l.short || '';
    $('#detail-long').textContent = l.long || '';
    $('#detail-tip').hidden = !l.tip;
    $('#detail-tip-text').textContent = l.tip;
    const facts = $('#detail-facts');
    facts.replaceChildren(...l.facts.map((f) => el('li', '', f)));
    facts.hidden = !l.facts.length;

    const credit = $('#detail-credit');
    const c = l.image_credit;
    if (c && (c.author || c.license)) {
      credit.hidden = false;
      const a = credit.querySelector('a');
      a.textContent = `${t('Фото')}: ${[c.author, c.license].filter(Boolean).join(', ')}`;
      if (/^https?:\/\//.test(c.source_url || '')) a.href = c.source_url;
      else a.removeAttribute('href');
    } else {
      credit.hidden = true;
    }
  }

  function fillHistory(l) {
    const host = $('#detail-history');
    host.replaceChildren(...l.history.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => el('p', '', p)));
    const src = $('#detail-sources');
    src.hidden = !l.sources.length;
    $('#detail-sources-list').replaceChildren(
      ...l.sources.map((s) => {
        const li = el('li');
        const a = el('a', '', s.title.replace('официальный сайт', t('официальный сайт')));
        Object.assign(a, { href: s.url, target: '_blank', rel: 'noopener noreferrer' });
        li.append(a);
        return li;
      }),
    );
  }

  function fillPanoVideo(p) {
    renderVideos($('#pano-video-card'), [{ youtube_id: p.youtube_id, title: p.title || t('Видео 360°'), channel: p.channel, lang: '' }]);
  }

  function fillPano(l) {
    const p = l.panorama;
    if (!p) return;
    const video = p.type === 'youtube';
    $('#pano-image').hidden = video;
    $('#pano-video').hidden = !video;
    if (video) {
      fillPanoVideo(p);
      $('#pano-video-cap').replaceChildren(...[p.caption ? el('span', '', p.caption) : null, creditNode(p.credit, t('Видео'))].filter(Boolean));
      return;
    }
    $('#pano-card-cap').replaceChildren(...[p.caption ? el('span', '', p.caption) : null, creditNode(p.credit, t('Панорама'))].filter(Boolean));
    $('#pano-thumb').removeAttribute('src');
    delete $('#pano-thumb').dataset.for;
  }

  function reveal(p) {
    p.hidden = false;
    cancelAnimationFrame(p._raf || 0);
    p._raf = requestAnimationFrame(() => p.classList.add('is-open'));
  }
  function conceal(p) {
    cancelAnimationFrame(p._raf || 0); // a pending open must not undo this close
    p.classList.remove('is-open');
    // wait for the slide-out before removing it from the a11y tree
    setTimeout(() => {
      if (!p.classList.contains('is-open')) p.hidden = true;
    }, 260);
  }

  // opts: { pos: '2 / 7', back: 'Маршрут «…»' | null }
  function show(i, opts = {}) {
    const l = landmarks[i];
    const same = current === l;
    current = l;
    rows.forEach((r, k) => {
      r.b.classList.toggle('is-active', k === i);
      r.b.setAttribute('aria-current', k === i ? 'true' : 'false');
    });
    if (view === 'places') rows[i].b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    $('#detail-meta').textContent = [categoryLabel(l.category), l.year].filter(Boolean).join(' · ');
    $('#detail-title').textContent = l.name;
    $('#detail-pt').textContent = l.name_pt;
    $('#detail-pt').hidden = l.name === l.name_pt;
    $('#detail-lang-note').hidden = !l.textFallback;
    const back = $('#detail-back');
    back.hidden = !opts.back;
    back.textContent = opts.back ? `← ${opts.back}` : '';

    const has = {
      overview: true,
      history: !!(l.history || l.sources.length),
      gallery: l.gallery.length > 0,
      video: l.videos.length > 0,
      pano: !!l.panorama,
    };
    let n = 0;
    for (const t of TABS) {
      $(`#tab-${t}`).hidden = !has[t];
      if (has[t]) n++;
    }
    tabsEl.hidden = n < 2;
    if (!same) {
      fillOverview(l);
      fillHistory(l);
      renderGallery($('#panel-gallery'), l.gallery, lightbox);
      renderVideos($('#panel-video'), l.videos);
      fillPano(l);
      tab = null;
      selectTab('overview');
    }

    $('#detail-pos').textContent = opts.pos || '';
    conceal(routePanel);
    reveal(panel);
  }

  function hide() {
    stopPlayback();
    conceal(panel);
    rows.forEach((r) => {
      r.b.classList.remove('is-active');
      r.b.setAttribute('aria-current', 'false');
    });
  }

  function visibleIndices() {
    return landmarks.map((l, i) => (hidden.has(l.category) ? -1 : i)).filter((i) => i >= 0);
  }

  // ------------------------------------------------------------ route panel
  $('#route-close').addEventListener('click', () => h.onRouteClose());
  $('#route-play').addEventListener('click', () => h.onPlayToggle());
  let stopRows = [];
  let routeShown = null;

  function showRoute(r, plan) {
    routeShown = r;
    for (const [id, b] of routeRows) {
      b.classList.toggle('is-active', id === r.id);
      b.setAttribute('aria-current', id === r.id ? 'true' : 'false');
    }
    routePanel.style.setProperty('--c', r.color);
    $('#route-meta').textContent = [t('Маршрут'), r.duration, fmtKm(r.distance_km), r.walk_km != null ? `${t('пешком')} ${fmtKm(r.walk_km)}` : ''].filter(Boolean).join(' · ');
    $('#route-attr').textContent = r.attribution;
    $('#route-attr').hidden = !r.attribution;
    $('#route-title').textContent = r.name;
    $('#route-sub').textContent = r.subtitle;
    $('#route-desc').textContent = r.description;
    $('#route-desc').hidden = !r.description;
    setPlaying(false);

    const byId = new Map(landmarks.map((l) => [l.id, l]));
    const list = $('#itinerary');
    list.replaceChildren();
    stopRows = [];
    const legRow = (leg) => {
      const li = el('li', 'leg');
      li.append(modeSwatch(leg.mode, r.color));
      const parts = [MODE_RU[leg.mode], fmtDistance(leg.distance_m), fmtMinutes(leg.duration_min)].filter(Boolean);
      li.append(el('span', 'leg-text', parts.join(' · ')));
      if (leg.note) li.append(el('span', 'leg-note', leg.note));
      return li;
    };
    r.stops.forEach((s, k) => {
      const l = byId.get(s.landmark_id);
      const li = el('li', 'stop');
      const b = el('button', 'stop-btn');
      b.type = 'button';
      const num = el('span', 'stop-num', String(k + 1));
      num.setAttribute('aria-hidden', 'true');
      const main = el('span', 'stop-main');
      const top = el('span', 'stop-top');
      if (s.time) top.append(el('span', 'stop-time', s.time));
      const stay = fmtMinutes(s.stay_min);
      if (stay) top.append(el('span', 'stop-stay', stay));
      main.append(el('span', 'stop-name', l.name), top);
      b.append(num, main);
      b.setAttribute('aria-label', `${k + 1}. ${l.name}${s.time ? `, ${s.time}` : ''}${stay ? `, ${stay}` : ''}`);
      b.addEventListener('click', () => h.onStopClick(k));
      li.append(b);
      if (s.note) li.append(el('p', 'stop-note', s.note));
      list.append(li);
      stopRows.push(li);
      if (k < plan.hops.length) for (const leg of plan.hops[k]) if (!leg.synthetic) list.append(legRow(leg));
    });
    for (const leg of plan.tail) list.append(legRow(leg));

    conceal(panel);
    reveal(routePanel);
    routePanel.querySelector('.detail-body').scrollTop = 0;
  }

  function hideRoute() {
    routeShown = null;
    for (const b of routeRows.values()) {
      b.classList.remove('is-active');
      b.setAttribute('aria-current', 'false');
    }
    conceal(routePanel);
  }

  function reopenRoute() {
    if (!routeShown) return;
    conceal(panel);
    reveal(routePanel);
  }

  function setStopActive(k) {
    stopRows.forEach((li, i) => li.classList.toggle('is-current', i === k));
    if (k >= 0) stopRows[k]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function setPlaying(on) {
    const b = $('#route-play');
    b.textContent = on ? t('Стоп') : t('Начать облёт');
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('is-playing', on);
    if (!on) setStopActive(-1);
  }

  // ------------------------------------------------------------ header
  const legendBtn = $('#legend-toggle');
  const legend = $('#legend');
  legendBtn.addEventListener('click', () => setLegend(legend.hidden));
  function setLegend(open) {
    legend.hidden = !open;
    legendBtn.setAttribute('aria-expanded', String(open));
    // in the phone's tools sheet the legend opens inline: bring it into view
    if (open && legend.closest('.tools-sheet.is-open')) legend.scrollIntoView({ block: 'nearest' });
  }
  $('#share').addEventListener('click', () => h.onShare());
  const tools = toolsSheet();

  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    requestAnimationFrame(() => toastEl.classList.add('is-on'));
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('is-on');
      setTimeout(() => (toastEl.hidden = true), 250);
    }, ms);
  }

  return {
    show,
    hide,
    visibleIndices,
    isOpen: () => panel.classList.contains('is-open'),
    showRoute,
    hideRoute,
    reopenRoute,
    routeOpen: () => routePanel.classList.contains('is-open'),
    setStopActive,
    setPlaying,
    setView,
    setLegend,
    tools,
    toast,
    lightbox,
    selectTab,
  };
}

// ------------------------------------------------------------ header tools
// One DOM for both layouts (index.html #tools-sheet):
//   desktop: .tools-sheet and .tools-group are display: contents, so every
//            tool sits in the header row in DOM order (group by group);
//   <= 900 px: the header keeps «Кино» and «Меню»; the sheet slides up from
//            the bottom, one row per group, never taller than the places
//            sheet (36vh), so the compass and scale bar stay free.
// Groups, in header order: modes, language, legend, share, sky, display.
export const TOOL_GROUPS = ['modes', 'language', 'legend', 'share', 'sky', 'display'];
const NARROW = '(max-width: 900px)';
let sheet = null;

// Put a JS-created header control into its group; it shows in the header
// row on desktop and in the sheet on phones. opts.closes: a click on it
// closes the sheet first (it opens a mode or a popover). Returns the node.
export function mountTool(node, group = 'display', { closes = false } = {}) {
  toolsSheet();
  let g = document.querySelector(`#tools-sheet .tools-group[data-group="${group}"]`);
  if (!g) {
    console.warn(`[braga] mountTool: no tools group "${group}", using "display"`);
    g = document.querySelector('#tools-sheet .tools-group[data-group="display"]');
  }
  if (closes) node.setAttribute('data-closes-tools', '');
  if (g) g.append(node);
  else document.querySelector('.topbar')?.append(node);
  return node;
}

// The sheet controller, created once: { open, set(on, { focus }) }.
export function toolsSheet() {
  if (sheet) return sheet;
  const root = document.getElementById('tools-sheet');
  const toggle = document.getElementById('tools-toggle');
  const bar = document.querySelector('.topbar');
  let open = false;
  let mq = null; // set once the markup is there
  sheet = {
    get open() {
      return open;
    },
    set,
  };
  if (!root || !toggle || !bar) return sheet;
  mq = window.matchMedia(NARROW);
  function set(on, { focus = true } = {}) {
    on = !!on && !!mq?.matches;
    if (on === open) return;
    open = on;
    root.classList.toggle('is-open', on);
    toggle.setAttribute('aria-expanded', String(on));
    document.body.classList.toggle('is-tools-open', on);
    if (!focus) return;
    if (on) root.querySelector('.tools-group button, .tools-group select')?.focus({ preventScroll: true });
    else if (root.contains(document.activeElement) || document.activeElement === document.body) toggle.focus({ preventScroll: true });
  }
  toggle.addEventListener('click', () => set(!open));
  root.querySelector('#tools-close')?.addEventListener('click', () => set(false));
  // tools that start something else (a mode, the share popover) close the
  // sheet; window capture runs before share.js' document capture listener
  window.addEventListener(
    'click',
    (e) => {
      if (open && e.target.closest?.('#tools-sheet [data-closes-tools]')) set(false, { focus: false });
    },
    true,
  );
  // a tap on the map closes it
  document.addEventListener('pointerdown', (e) => {
    if (open && !root.contains(e.target) && !toggle.contains(e.target) && !e.target.closest?.('.share-pop')) set(false, { focus: false });
  });
  mq.addEventListener?.('change', () => mq.matches || set(false, { focus: false }));
  // a control appended straight to .topbar would land in the phone's top
  // row: move it into the sheet (the documented path is mountTool)
  const keep = (n) => n === root || n === toggle || n.matches?.('.modes, .life-break, .life-badge');
  new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && n.parentNode === bar && !keep(n)) mountTool(n, 'display');
  }).observe(bar, { childList: true });
  // and the ones added before the sheet existed
  for (const n of [...bar.children]) if (!keep(n)) mountTool(n, 'display');
  return sheet;
}

// Compass rose and scale bar, bottom left of the map. The rose turns with
// the camera heading; a click swings the view back to north up. The bar
// shows a round length (5 m .. 5 km) at the orbit target's distance.
const NICE_M = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
export function createInstruments({ onNorth, metresPerUnit = 4 } = {}) {
  const rose = $('#compass-rose');
  const bar = $('#scalebar-bar');
  const label = $('#scalebar-label');
  $('#compass')?.addEventListener('click', () => onNorth?.());
  let lastAngle = NaN;
  let lastN = 0;
  let lastW = 0;
  return {
    update(camera, target, viewH) {
      if (!rose || !bar || !viewH) return;
      const fx = target.x - camera.position.x;
      const fz = target.z - camera.position.z;
      // heading: 0 looking north (-z), 90 looking east
      const heading = (Math.atan2(fx, -fz) * 180) / Math.PI;
      if (!(Math.abs(heading - lastAngle) < 0.25)) {
        lastAngle = heading;
        rose.style.transform = `rotate(${(-heading).toFixed(1)}deg)`;
      }
      const dist = camera.position.distanceTo(target);
      const mpp = ((2 * dist * Math.tan((camera.fov * Math.PI) / 360)) / viewH) * metresPerUnit;
      let n = NICE_M[0];
      for (const v of NICE_M) if (v / mpp <= 120) n = v;
      const w = Math.round(n / mpp);
      if (n !== lastN) {
        lastN = n;
        const km = language === 'ru' ? 'км' : 'km';
        const m = language === 'ru' ? 'м' : 'm';
        label.textContent = n >= 1000 ? `${n / 1000} ${km}` : `${n} ${m}`;
      }
      if (w !== lastW) {
        lastW = w;
        bar.style.width = `${w}px`;
      }
    },
  };
}

export function createLoader() {
  const root = $('#loader');
  const bar = $('#loader-bar');
  const text = $('#loader-text');
  return {
    set(p, label) {
      bar.style.transform = `scaleX(${p})`;
      root.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      if (label) text.textContent = label;
    },
    fail(msg) {
      text.textContent = msg;
      root.classList.add('is-error');
    },
    done() {
      root.classList.add('is-done');
      setTimeout(() => root.remove(), 700);
    },
  };
}
