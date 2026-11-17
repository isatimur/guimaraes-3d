// History routes (#quest): accuracy and wiring checks for data/quest.json.
// Every history line, every answer basis, every dated sequence quote and
// every visit line of every route must be a verbatim excerpt of the
// landmark's own text in the same language (ru: data/landmarks.json; en and
// pt: src/locales/<lang>.guimaraes.js), so a route never says more than the
// sourced place cards do.
//
// Ported from porto-3d (main 7be3158), itself a port of braga-3d. Guimarães
// ships data/quest.json, so nothing here is skipped: a missing file fails
// the run. Guimarães never had an older save, so there are no migration
// tests. Stricter here than Porto: an answer basis may not be a sentence the
// card presents as legend or tradition, and no choice task's own history
// lines may contain its answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { messages } from '../src/locales/ui.js';
import { createQuestProgress, questSummary, stopResult, readProgress, KEY } from '../src/quest-progress.js';
import { TASK_TYPES, answerKey, taskErrors, questErrors } from '../src/quest-tasks.js';

const root = new URL('../', import.meta.url);
const quest = JSON.parse(readFileSync(new URL('data/quest.json', root), 'utf8'));
const ROUTES = quest.routes || [];
const STOPS = ROUTES.flatMap((r) => r.stops.map((s) => ({ ...s, route: r.id })));
const LM = JSON.parse(readFileSync(new URL('data/landmarks.json', root), 'utf8'));
const EN = (await import('../src/locales/en.guimaraes.js')).landmarks;
const PT = (await import('../src/locales/pt.guimaraes.js')).landmarks;
const byId = new Map(LM.map((l) => [l.id, l]));
const LANGS = ['ru', 'en', 'pt'];
const CYRILLIC = /[А-Яа-яЁё]/;
const tag = (s) => `${s.route}/${s.id}`;
const of = (type) => STOPS.filter((s) => s.task.type === type);
const CHOICE = STOPS.filter((s) => s.task.type === 'multiple_choice' || s.task.type === 'visual_detail');
// the keys src/quest.js frame() reads from a view
const VIEW_KEYS = ['az', 'elev', 'k', 'mk'];
// the place-card fields an answer may rest on (all of them carry the card's sources)
const BASIS_FIELDS = ['history', 'facts', 'long'];
// a sentence the card itself marks as legend or tradition: never an answer
const LEGEND = /legend|tradition|is said|lenda|tradição|terá |segundo se diz|предани|легенд|будто бы|как считается/i;

// the texts a stop may quote, per language and field
function sourceText(id, lang) {
  const l = byId.get(id);
  if (lang === 'ru') return { history: l.history_ru, facts: (l.facts_ru || []).join('\n'), tip: l.tip_ru, long: l.long_ru };
  const tr = (lang === 'en' ? EN : PT)[id] || {};
  return { history: tr.history, facts: (tr.facts || []).join('\n'), tip: tr.tip, long: tr.long };
}
const inAny = (line, src, fields) => fields.some((f) => typeof src[f] === 'string' && typeof line === 'string' && line.length > 0 && src[f].includes(line));
// the whole sentence of the card that holds `quote` (to read what surrounds it)
function sentenceOf(quote, src) {
  for (const f of BASIS_FIELDS) {
    const text = src[f];
    const at = typeof text === 'string' ? text.indexOf(quote) : -1;
    if (at < 0) continue;
    const from = Math.max(text.lastIndexOf('. ', at), text.lastIndexOf('\n', at)) + 1;
    const dot = text.slice(at + quote.length).search(/[.!?](\s|$)/);
    return text.slice(from, dot < 0 ? undefined : at + quote.length + dot + 1).trim();
  }
  return '';
}
// every { ru, en, pt } text inside a value, for one language
function texts(v, lang, out = []) {
  if (Array.isArray(v)) for (const x of v) texts(x, lang, out);
  else if (v && typeof v === 'object') {
    if (typeof v[lang] === 'string') out.push(v[lang]);
    for (const [k, x] of Object.entries(v)) if (!LANGS.includes(k)) texts(x, lang, out);
  }
  return out;
}
const checkView = (where, view) => {
  for (const [k, v] of Object.entries(view || {})) assert.ok(VIEW_KEYS.includes(k) && Number.isFinite(v), `${where}: view.${k}`);
};

test('routes: stable unique ids', () => {
  assert.equal(ROUTES.length, 2, 'two routes (update this count with the data)');
  assert.equal(STOPS.length, 10, 'two routes of five stops (update this count with the data)');
  const ids = ROUTES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'route ids are unique');
  for (const id of ids) {
    // the id is a URL path (public/route/<id>/) and a hash value: kebab case,
    // and never a language folder of the text pages
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `route id «${id}»`);
    assert.ok(!['en', 'ru', 'pt'].includes(id), `route id «${id}» clashes with a language folder`);
  }
  for (const r of ROUTES) {
    for (const k of ['title', 'intro', 'end_lead']) for (const lang of LANGS) assert.ok(r[k]?.[lang]?.trim(), `${r.id}: ${k}.${lang}`);
    assert.equal(r.stops.length, 5, `${r.id}: five stops`);
    assert.equal(new Set(r.stops.map((s) => s.id)).size, r.stops.length, `${r.id}: a stop appears once`);
    // a stop's camera and a find-on-map view: only the keys frame() reads, as numbers
    for (const s of r.stops) {
      checkView(`${r.id}/${s.id}`, s.view);
      checkView(`${r.id}/${s.id} task`, s.task?.view);
    }
    for (const id of r.overview || []) assert.ok(r.stops.some((s) => s.id === id), `${r.id}: overview ${id} is not a stop`);
  }
});

test('each stop is a known landmark with its sources', () => {
  for (const s of STOPS) {
    const l = byId.get(s.id);
    assert.ok(l, `${tag(s)}: not in data/landmarks.json`);
    assert.ok(l.sources?.length >= 2, `${tag(s)}: needs at least two sources`);
    assert.ok(l.image && l.image_credit, `${tag(s)}: needs a credited photo`);
    assert.ok(existsSync(new URL(l.image.replace(/^\/+/, ''), root)), `${tag(s)}: ${l.image} is missing`);
    assert.deepEqual([...s.sources].sort(), l.sources.map((q) => q.url).sort(), `${tag(s)}: sources differ from the landmark`);
    // `from` names the place-card fields each part quotes (for review; the
    // quote checks below are what holds them to it)
    for (const [k, v] of Object.entries(s.from || {})) for (const f of v.split(/,\s*/)) assert.ok(['history', 'facts', 'long', 'tip'].includes(f), `${tag(s)}: from.${k} names «${f}»`);
    assert.ok(s.from?.text && s.from?.visit && (s.from.basis || s.from.items), `${tag(s)}: from.text, from.visit and from.basis or from.items`);
  }
});

test('history lines are verbatim excerpts of the place card, in every language', () => {
  for (const s of STOPS) {
    for (const lang of LANGS) {
      const lines = s.text[lang];
      assert.ok(Array.isArray(lines) && lines.length >= 2 && lines.length <= 4, `${tag(s)}/${lang}: 2-4 lines`);
      const src = sourceText(s.id, lang);
      for (const line of lines) assert.ok(inAny(line, src, ['history', 'facts', 'long']), `${tag(s)}/${lang}: not in the place card: «${line}»`);
    }
  }
});

test('the same history lines in every language: the same years', () => {
  // a translation that drifted would show here first (ru history was cut
  // shorter than en and pt in places)
  const years = (lines) => lines.join(' ').match(/\b1\d{3}\b|\b20\d\d\b/g)?.sort().join(',') || '';
  for (const s of STOPS) for (const lang of ['en', 'pt']) assert.equal(years(s.text[lang]), years(s.text.ru), `${tag(s)}/${lang}: years differ from ru`);
});

// ------------------------------------------------ the task model
test('task shape: every stop has a known type and stable ids; the file passes the check', () => {
  assert.deepEqual(questErrors(quest), []);
  for (const s of STOPS) assert.ok(TASK_TYPES.includes(s.task.type), `${tag(s)}: ${s.task.type}`);
  for (const s of STOPS) assert.ok(answerKey(s.task), `${tag(s)}: no answer key`);
  for (const s of STOPS) for (const k of ['question', 'options', 'answer', 'basis']) assert.ok(!(k in s), `${tag(s)}: a «${k}» outside the task`);
});

test('task shape: an unknown type, a missing id or a duplicate id fails', () => {
  const mc = { id: 'x-task', type: 'multiple_choice', options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], answer: 'b' };
  assert.deepEqual(taskErrors(mc), []);
  assert.match(taskErrors({ ...mc, type: 'essay' }).join(), /unknown task type/);
  assert.match(taskErrors({ ...mc, id: undefined }).join(), /task id/);
  assert.match(taskErrors({ ...mc, options: [{ id: 'a' }, { ru: 'b' }, { id: 'c' }] }).join(), /option id is missing/);
  assert.match(taskErrors({ ...mc, options: [{ id: 'a' }, { id: 'a' }, { id: 'b' }] }).join(), /duplicate option id/);
  assert.match(taskErrors({ ...mc, answer: 'z' }).join(), /answer is not an option/);
  assert.match(taskErrors({ id: 't', type: 'true_false', answer: 'yes' }).join(), /true or false/);
  const find = { id: 'f', type: 'find_on_map', target: 'a', candidates: ['a', 'b', 'c'] };
  assert.deepEqual(taskErrors(find), []);
  assert.match(taskErrors({ ...find, candidates: ['a', 'b', 'b'] }).join(), /duplicate candidate/);
  assert.match(taskErrors({ ...find, target: 'z' }).join(), /not a candidate/);
  const items = [{ id: 'a', year: 1 }, { id: 'b', year: 2 }, { id: 'c', year: 3 }];
  const seq = { id: 's', type: 'sequence', items, start: ['c', 'a', 'b'] };
  assert.deepEqual(taskErrors(seq), []);
  assert.match(taskErrors({ ...seq, items: [items[0], { ...items[1], id: 'a' }, items[2]] }).join(), /duplicate item id/);
  assert.match(taskErrors({ ...seq, start: ['a', 'b', 'c'] }).join(), /already the right order/);
  assert.match(taskErrors({ ...seq, items: [items[1], items[0], items[2]], start: ['c', 'a', 'b'] }).join(), /rising order/);
  // a duplicate task id across routes
  const two = { routes: [{ id: 'r1', stops: [{ id: 'p', task: mc }] }, { id: 'r2', stops: [{ id: 'q', task: mc }] }] };
  assert.match(questErrors(two).join(), /duplicate task id/);
});

test('each route mixes task types; at least one task makes the visitor act on the map', () => {
  for (const r of ROUTES) {
    const types = r.stops.map((s) => s.task.type);
    assert.ok(new Set(types).size >= 4, `${r.id}: at least four task types (${types})`);
    assert.ok(types.includes('find_on_map'), `${r.id}: a find-on-map task`);
    assert.ok(types.includes('sequence'), `${r.id}: a sequence task`);
    assert.ok(types.includes('true_false'), `${r.id}: a true/false task`);
  }
});

test('an answer never rests on a legend or a tradition, and every basis is the card in that language', () => {
  for (const s of STOPS) {
    const t = s.task;
    const quotes = t.type === 'sequence' ? t.items.map((it) => it.quote) : [t.basis];
    for (const q of quotes) {
      for (const lang of LANGS) {
        const src = sourceText(s.id, lang);
        assert.ok(inAny(q?.[lang], src, BASIS_FIELDS), `${tag(s)}/${lang}: basis not in the place card: «${q?.[lang]}»`);
        const whole = sentenceOf(q[lang], src);
        assert.doesNotMatch(whole, LEGEND, `${tag(s)}/${lang}: the answer rests on a legend: «${whole}»`);
      }
    }
  }
});

test('choice tasks: each right answer rests on a verbatim fact in every language', () => {
  for (const s of CHOICE) {
    const t = s.task;
    assert.equal(t.options.length, 3, `${tag(s)}: three options`);
    for (const lang of LANGS) {
      assert.ok(t.question[lang]?.trim(), `${tag(s)}/${lang}: question`);
      for (const o of t.options) assert.ok(o[lang]?.trim(), `${tag(s)}/${lang}: option text`);
      assert.equal(new Set(t.options.map((o) => o[lang])).size, 3, `${tag(s)}/${lang}: three different options`);
      assert.ok(inAny(t.basis[lang], sourceText(s.id, lang), BASIS_FIELDS), `${tag(s)}/${lang}: basis not in the place card: «${t.basis[lang]}»`);
      // the stop's own lines do not give the answer before the visitor picks
      for (const line of s.text[lang]) assert.ok(!t.basis[lang].includes(line) && !line.includes(t.basis[lang]), `${tag(s)}/${lang}: a history line gives the answer away`);
    }
  }
  // the right option is not always in the same place
  assert.ok(new Set(CHOICE.map((s) => s.task.options.findIndex((o) => o.id === s.task.answer))).size >= 2, 'answer positions vary');
});

test('visual detail: the model builds the detail the quote names', () => {
  // model_check names the builder and a word for the detail in its code
  // (Guimarães: the keep in src/models/guimaraes/castelo.js); the detail
  // itself was checked by eye in a phone and a desktop screenshot
  for (const s of of('visual_detail')) {
    const { file, word } = s.task.model_check || {};
    assert.ok(file && word, `${tag(s)}: model_check { file, word }`);
    assert.ok(existsSync(new URL(file, root)), `${tag(s)}: ${file} is missing`);
    assert.ok(readFileSync(new URL(file, root), 'utf8').toLowerCase().includes(word.toLowerCase()), `${tag(s)}: ${file} never mentions ${word}`);
    for (const lang of LANGS) assert.ok(inAny(s.task.basis[lang], sourceText(s.id, lang), BASIS_FIELDS), `${tag(s)}/${lang}: basis`);
  }
});

test('true/false: a statement and a quote that settles it, in every language', () => {
  assert.ok(of('true_false').length >= 1);
  for (const s of of('true_false')) {
    const t = s.task;
    for (const lang of LANGS) {
      assert.ok(t.statement[lang]?.trim(), `${tag(s)}/${lang}: statement`);
      assert.ok(inAny(t.basis[lang], sourceText(s.id, lang), BASIS_FIELDS), `${tag(s)}/${lang}: basis not in the place card: «${t.basis[lang]}»`);
      // a false statement is not a changed number: any number in it must be
      // one the quote does not have
      if (t.answer === false) for (const n of t.statement[lang].match(/\d+/g) || []) assert.ok(!t.basis[lang].includes(n), `${tag(s)}/${lang}: a false statement that only changes ${n}`);
      // the stop's own lines do not settle it before the visitor answers
      for (const line of s.text[lang]) assert.ok(!t.basis[lang].includes(line) && !line.includes(t.basis[lang]), `${tag(s)}/${lang}: a history line gives the answer away`);
    }
  }
});

test('find on the map: the stop itself among real landmarks with coordinates, far enough apart to pick', () => {
  assert.ok(of('find_on_map').length >= 1);
  // metres between two landmarks (equirectangular, fine at this scale)
  const metres = (a, b) => Math.hypot((a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180), (a.lat - b.lat) * 110540);
  for (const s of of('find_on_map')) {
    const t = s.task;
    assert.equal(t.target, s.id, `${tag(s)}: the target is the stop's own landmark`);
    assert.ok(t.candidates.length >= 5 && t.candidates.length <= 8, `${tag(s)}: five to eight candidates`);
    for (const id of t.candidates) {
      const l = byId.get(id);
      assert.ok(l, `${tag(s)}: candidate ${id} is not a landmark`);
      assert.ok(Number.isFinite(l.lat) && Number.isFinite(l.lon), `${tag(s)}: candidate ${id} has no coordinates`);
      assert.ok(l.model, `${tag(s)}: candidate ${id} has no 3D model to pick`);
      assert.ok(EN[id]?.name && PT[id]?.name, `${tag(s)}: candidate ${id} has no en/pt name`);
    }
    // two markers closer than this overlap on a phone: never both candidates
    for (const a of t.candidates) for (const b of t.candidates) if (a < b) assert.ok(metres(byId.get(a), byId.get(b)) >= 150, `${tag(s)}: ${a} and ${b} are under 150 m apart`);
    // (a non-candidate may stand near the target: São Tiago's marker sits
    // beside Oliveira's model; a click on a non-candidate does nothing)
    for (const lang of LANGS) assert.ok(inAny(t.basis[lang], sourceText(s.id, lang), BASIS_FIELDS), `${tag(s)}/${lang}: basis not in the place card: «${t.basis[lang]}»`);
  }
});

test('sequence: each event has its own quote holding its year, in every language', () => {
  assert.ok(of('sequence').length >= 1);
  for (const s of of('sequence')) {
    const t = s.task;
    for (const it of t.items) {
      for (const lang of LANGS) {
        const where = `${tag(s)}/${it.id}/${lang}`;
        assert.ok(it.label[lang]?.trim(), `${where}: label`);
        // the label gives no date and no order away
        assert.doesNotMatch(it.label[lang], /\d|first|later|new\b|old\b|primeir|depois|nov[oa]\b|antig|перв|поздн|нов(ый|ая|ую)|стар/i, `${where}: the label gives the order away: «${it.label[lang]}»`);
        assert.ok(inAny(it.quote[lang], sourceText(s.id, lang), BASIS_FIELDS), `${where}: quote not in the place card: «${it.quote[lang]}»`);
        assert.ok(it.quote[lang].includes(String(it.year)), `${where}: the quote does not hold ${it.year}`);
      }
    }
    // the stop's own lines and visit lines do not give the dates away before the task
    for (const lang of LANGS) for (const it of t.items) for (const line of [...s.text[lang], ...s.visit[lang]]) assert.ok(!line.includes(String(it.year)), `${tag(s)}/${lang}: a line gives away ${it.year}`);
  }
  // the place's own year waits until the order is right (src/quest.js)
  const code = readFileSync(new URL('src/quest.js', root), 'utf8');
  assert.match(code, /year\.hidden = task\.type === 'sequence' && !S\.done/, 'src/quest.js hides the year of an open sequence stop');
  assert.match(code, /st\.task\.type === 'sequence' && !rp\.stamp\(st\.id\) \? ''/, 'src/quest.js keeps that year out of the route plan too');
});

test('a stop shared by two routes sets a different task in each', (t) => {
  const seen = new Map();
  let shared = 0;
  for (const s of STOPS) {
    const prev = seen.get(s.id);
    if (prev) {
      shared++;
      assert.notEqual(s.task.id, prev.task.id, `${s.id}: same task in ${prev.route} and ${s.route}`);
      for (const lang of LANGS) {
        const a = texts(s.task, lang).join('|');
        const b = texts(prev.task, lang).join('|');
        assert.notEqual(a, b, `${s.id}/${lang}: same task text in ${prev.route} and ${s.route}`);
        if (s.task.basis && prev.task.basis) assert.notEqual(s.task.basis[lang], prev.task.basis[lang], `${s.id}/${lang}: same basis in ${prev.route} and ${s.route}`);
      }
    } else seen.set(s.id, s);
  }
  // Guimarães's two routes share no stop: say so rather than pass on nothing
  if (!shared) t.skip('the routes share no stop: nothing to compare');
});

test('the year shown on each stop agrees across languages', () => {
  const years = (s) => (String(s ?? '').match(/\d{4}/g) || []).join(',');
  for (const id of new Set(STOPS.map((s) => s.id))) {
    const ru = years(byId.get(id).year);
    for (const tr of [EN, PT]) if (tr[id]?.year != null) assert.equal(years(tr[id].year), ru, `${id}: year «${tr[id].year}» vs «${byId.get(id).year}»`);
  }
});

test('the menu label, its title, the load error and the no-WebGL link are translated', () => {
  const keys = ['Исторические маршруты', 'Откройте исторический Гимарайнш: маршруты с заданием на каждой остановке', 'Не удалось загрузить маршрут', 'Текстовая версия исторических маршрутов'];
  for (const k of keys) assert.ok(messages[k]?.[0] && messages[k]?.[1], `src/locales/ui.js: ${k}`);
  // the label and its title hold for one route or several: no count of
  // places or questions in them
  const NUMBER = /\d|two|three|four|five|dois|duas|três|quatro|cinco|два|две|три|четыре|пять/i;
  for (const k of keys.slice(0, 2)) for (const s of [k, ...messages[k]]) {
    assert.doesNotMatch(s, NUMBER, `a count in the menu text: «${s}»`);
    assert.doesNotMatch(s, /question|pergunta|вопрос/i, `the menu text names questions, the routes set tasks: «${s}»`);
  }
  const main = readFileSync(new URL('src/main.js', root), 'utf8');
  for (const k of keys) assert.ok(main.includes(`t('${k}')`), `src/main.js uses t('${k}')`);
});

test('visit lines quote the place card tip and carry no hours, prices or closures', () => {
  // these go stale: opening hours, prices, «closed on Mondays», «temporarily
  // closed», free entry, tickets, tour schedules, house rules
  const STALE = /\d{1,2}[:.h]\d{2}|\d+\s*(am|pm)\b|€|EUR|clos|encerra|fechad|fecho|закрыт|выходн|monday|tuesday|wednesday|thursday|friday|saturday|sunday|segunda|terça|quarta|quinta|sexta|sábado|domingo|понедельник|вторник|сред[ау]|четверг|пятниц|суббот|воскресень|\bfree\b|grát|gratuit|livre|бесплатн|свободн|opening|abertura|открыти|открыт|ticket|bilhete|билет|every \d|a cada \d|кажд\S* \d|photograph|fotograf|фотограф|tripod|tripé|штатив|queue|fila\b|очеред|book\b|reserv|брон|restor|restaur|ремонт|obras/i;
  for (const s of STOPS) {
    for (const lang of LANGS) {
      const src = sourceText(s.id, lang);
      assert.ok(s.visit[lang]?.length >= 1, `${tag(s)}/${lang}: visit line`);
      for (const line of s.visit[lang]) {
        assert.ok(inAny(line, src, ['tip']), `${tag(s)}/${lang}: not in the tip: «${line}»`);
        assert.doesNotMatch(line, STALE, `${tag(s)}/${lang}: hours, prices or closures go stale: «${line}»`);
      }
    }
  }
});

test('route texts state no walking time or distance of their own', () => {
  // only the quoted visit lines may (they come from the place cards)
  const DIST = /\d+\s*(min|мин|km|км|m\b|м\b)|minute|minuto|минут|metre|meter|metro|метр|walk (of|for)/i;
  for (const r of ROUTES) for (const k of ['title', 'intro', 'end_lead']) for (const lang of LANGS) assert.doesNotMatch(r[k][lang], DIST, `${r.id}: ${k}.${lang}`);
  for (const [k, v] of Object.entries(quest.ui)) for (const lang of LANGS) assert.doesNotMatch(v[lang], DIST, `ui.${k}.${lang}`);
});

test('English and Portuguese texts have no Russian left in them', () => {
  const strings = (lang) => [
    ...Object.values(quest.ui).map((v) => v[lang]),
    ...ROUTES.flatMap((r) => [r.title[lang], r.intro[lang], r.end_lead[lang]]),
    ...STOPS.flatMap((s) => [...s.text[lang], ...s.visit[lang], ...texts(s.task, lang)]),
    ...STOPS.flatMap((s) => [s.id, ...(s.task.candidates || [])]).map((id) => (lang === 'en' ? EN : PT)[id]?.name || byId.get(id).name_pt),
  ];
  for (const lang of ['en', 'pt']) {
    const list = strings(lang);
    // 60 ui strings, 6 route texts, 10 stops with their tasks and candidates
    assert.ok(list.length > 150, `${lang}: the task texts are collected (${list.length})`);
    for (const str of list) assert.doesNotMatch(str, CYRILLIC, `${lang}: «${str}»`);
  }
});

test('every interface string the module uses exists in all three languages', () => {
  for (const [k, v] of Object.entries(quest.ui)) for (const lang of LANGS) assert.ok(v[lang]?.trim(), `ui.${k}.${lang}`);
  const code = readFileSync(new URL('src/quest.js', root), 'utf8') + readFileSync(new URL('scripts/route-pages.mjs', root), 'utf8');
  const used = new Set([...code.matchAll(/\bs\('([a-z_]+)'/g)].map((m) => m[1]));
  assert.ok(used.size > 10, 'the module reads its strings through s()');
  // keys built or chosen at run time
  for (const k of ['correct_gold', 'correct_plain', 'stamp_gold', 'stamp_plain', 'stamp_seen', 'stamp_none', 'tf_is_true', 'tf_is_false']) used.add(k);
  for (const m of code.matchAll(/\bretryNode\('([a-z_]+)'/g)) used.add(m[1]);
  for (const k of used) assert.ok(quest.ui[k], `src/quest.js uses ui.${k}, missing in data/quest.json`);
  // no reconstruction is called historical; no feature is promised
  for (const v of Object.values(quest.ui)) for (const lang of LANGS) assert.doesNotMatch(v[lang], /reconstru|реконструк/i);
  // the routes set tasks now: no interface line says every stop asks a question
  for (const r of ROUTES) for (const lang of LANGS) assert.doesNotMatch(r.intro[lang], /question|pergunta|вопрос/i, `${r.id}: intro.${lang}`);
  // the city is Guimarães, not the city the module came from
  for (const v of Object.values(quest.ui)) for (const lang of LANGS) assert.doesNotMatch(v[lang], /porto|порту|braga|брага/i, `ui: «${v[lang]}»`);
});

test('text pages: committed, current with the data, readable without JavaScript, no tasks', async () => {
  const { loadInputs, renderRoutePages, routePagePaths } = await import('./route-pages.mjs');
  const inputs = await loadInputs();
  const pages = renderRoutePages(inputs);
  assert.equal(pages.length, (ROUTES.length + 1) * 3, 'a list and one page per route, in three languages');
  for (const { path, html } of pages) {
    const file = new URL(path, root);
    assert.ok(existsSync(file), `${path} is missing: run node scripts/route-pages.mjs`);
    assert.equal(readFileSync(file, 'utf8'), html, `${path} is stale: run node scripts/route-pages.mjs`);
    assert.doesNotMatch(html, /<script/i, `${path}: no script, no redirect`);
    assert.equal((html.match(/<h1>/g) || []).length, 1, `${path}: one h1`);
    assert.match(html, /<html lang="(pt-PT|en|ru)">/, `${path}: page language`);
    assert.match(html, /<nav aria-label="[^"]+"><ul>/, `${path}: language links`);
    assert.doesNotMatch(html, /\b20\d\d-\d\d-\d\d\b/, `${path}: no build date (the page changes only with the data)`);
    // every photo reserves its box (no layout shift while it loads)
    for (const img of html.match(/<img [^>]*>/g) || []) assert.match(img, /\swidth="\d+" height="\d+"/, `${path}: ${img}`);
    // en and pt pages carry no Russian outside the «Русский» language link
    if (!/\/ru\/index\.html$/.test(path)) assert.doesNotMatch(html.replace(/<a [^>]*lang="ru"[^>]*>Русский<\/a>/g, ''), CYRILLIC, `${path}: Russian text`);
    assert.doesNotMatch(html, /porto|braga-3d/i, `${path}: another city's name`);
  }
  const esc = (line) => line.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  for (const r of ROUTES) {
    for (const [lang, sub] of [['pt', ''], ['en', 'en/'], ['ru', 'ru/']]) {
      const html = pages.find((p) => p.path === `public/route/${r.id}/${sub}index.html`).html;
      assert.ok(html.includes(`href="/?lang=${lang}#quest=${r.id}"`), `${r.id}/${lang}: link to the route on the 3D map`);
      assert.equal((html.match(/<img /g) || []).length, r.stops.length, `${r.id}/${lang}: one photo per stop`);
      assert.doesNotMatch(html, /task|tarefa|задани/i, `${r.id}/${lang}: the text page names no tasks`);
      for (const s of r.stops) {
        assert.ok(html.includes(`<h2 id="stop-${s.id}">`), `${r.id}/${lang}: heading for ${s.id}`);
        for (const line of s.text[lang]) assert.ok(html.includes(esc(line)), `${r.id}/${lang}: history line of ${s.id}`);
        for (const url of s.sources) assert.ok(html.includes(`href="${url}"`), `${r.id}/${lang}: source ${url}`);
        // no question, statement, option or event label on the text page
        const own = [s.task.question?.[lang], s.task.statement?.[lang], ...(s.task.options || []).map((o) => o[lang]), ...(s.task.items || []).map((it) => it.label[lang])].filter(Boolean);
        for (const t of own) assert.ok(!html.includes(esc(t)), `${r.id}/${lang}: task text on the page: «${t}»`);
      }
    }
  }
  // the sitemap lists every page
  const sitemap = readFileSync(new URL('public/sitemap.xml', root), 'utf8');
  for (const p of routePagePaths(quest)) assert.ok(sitemap.includes(`${inputs.site}${p}</loc>`), `sitemap: ${p}`);
});

test('the route intro links to the text version of the open route', () => {
  const code = readFileSync(new URL('src/quest.js', root), 'utf8');
  assert.match(code, /`route\/\$\{id \? `\$\{id\}\/` : ''\}/, 'src/quest.js builds a route/<id>/ link');
});

test('the text pages are served as HTML and the verify gate checks they are current', () => {
  const vercel = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
  const rule = vercel.headers.find((h) => h.source === '/route/(.*)');
  assert.ok(rule, 'vercel.json: headers for /route/');
  assert.ok(rule.headers.some((h) => h.key === 'Content-Type' && /text\/html/.test(h.value)), 'vercel.json: /route/ is text/html');
  const verify = readFileSync(new URL('scripts/verify.mjs', root), 'utf8');
  assert.match(verify, /route-pages\.mjs', '--check'/, 'scripts/verify.mjs runs route-pages --check');
});

// ------------------------------------------------ progress
// a localStorage stand-in; returns its Map
function fakeStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), keys: () => store.keys() };
  return store;
}
const FIRST = ROUTES[0].stops;
const R1 = ROUTES[0].id;
// a wrong token for a stop's task
function wrongOf(s, n = 1) {
  const t = s.task;
  if (t.type === 'true_false') return String(!t.answer);
  if (t.type === 'find_on_map') return t.candidates.filter((c) => c !== t.target)[n - 1];
  if (t.type === 'sequence') return n === 1 ? t.start.join(',') : [...t.start].reverse().join(',');
  return t.options.filter((o) => o.id !== t.answer)[n - 1].id;
}
const sub = (rp, s, token) => rp.submit(s.id, s.task.id, token, answerKey(s.task));

test('retry: a wrong try is kept, the same try again is ignored, the right one stamps the stop', () => {
  fakeStorage();
  const stops = FIRST;
  const n = stops.length;
  const rp = createQuestProgress('guimaraes').route(R1);
  const [a, b] = stops;
  assert.deepEqual(questSummary(stops, rp), { gold: 0, done: 0, visited: 0, started: 0, total: n, next: 0 });
  rp.visit(a.id);
  assert.equal(rp.visited(a.id), true);
  // stop 1: right first time
  assert.equal(sub(rp, a, answerKey(a.task)), 'right');
  assert.equal(rp.stamp(a.id), 'gold');
  assert.equal(sub(rp, a, wrongOf(a)), null, 'a done stop takes no more tries');
  // stop 2: wrong, the same wrong again (ignored), not a token, then right
  assert.equal(sub(rp, b, wrongOf(b)), 'wrong');
  assert.deepEqual(stopResult(rp.tries(b.task.id), answerKey(b.task)), { done: false, attempts: 1, gold: false });
  assert.equal(sub(rp, b, wrongOf(b)), null, 'the same try again');
  assert.equal(sub(rp, b, 'Not A Token'), null, 'not a token');
  assert.equal(sub(rp, b, 3), null, 'an index is not a token');
  assert.deepEqual(questSummary(stops, rp), { gold: 1, done: 1, visited: 2, started: 2, total: n, next: 1 });
  assert.equal(sub(rp, b, answerKey(b.task)), 'right');
  assert.equal(rp.stamp(b.id), 'plain');
  assert.deepEqual(questSummary(stops, rp), { gold: 1, done: 2, visited: 2, started: 2, total: n, next: 2 });
  // a reload in the middle of a task does not give a fresh first try
  const c = stops[2];
  sub(rp, c, wrongOf(c));
  const again = createQuestProgress('guimaraes').route(R1);
  assert.deepEqual(again.tries(c.task.id), [wrongOf(c)]);
  assert.equal(sub(again, c, answerKey(c.task)), 'right');
  assert.equal(again.stamp(c.id), 'plain');
  again.reset();
  assert.deepEqual(questSummary(stops, createQuestProgress('guimaraes').route(R1)), { gold: 0, done: 0, visited: 0, started: 0, total: n, next: 0 });
  delete globalThis.localStorage;
});

test('retry: every task type takes its own tokens', () => {
  fakeStorage();
  const p = createQuestProgress('guimaraes');
  for (const type of TASK_TYPES) {
    const s = STOPS.find((x) => x.task.type === type);
    assert.ok(s, `Guimarães uses ${type}`);
    const rp = p.route(s.route);
    assert.equal(sub(rp, s, wrongOf(s)), 'wrong', `${type}: a wrong try`);
    if (type !== 'true_false') assert.equal(sub(rp, s, wrongOf(s, 2)), 'wrong', `${type}: a second wrong try`);
    assert.equal(sub(rp, s, answerKey(s.task)), 'right', `${type}: the right try`);
    assert.equal(rp.stamp(s.id), 'plain');
  }
  delete globalThis.localStorage;
});

test('progress: saved per route id; the last route is remembered', () => {
  fakeStorage();
  const [r1, r2] = ROUTES;
  const p = createQuestProgress('guimaraes');
  const a = r1.stops[0];
  sub(p.route(r1.id), a, answerKey(a.task));
  assert.equal(p.route(r2.id).stamp(a.id), null, 'a stamp belongs to its route');
  p.setLast(r2.id);
  assert.equal(createQuestProgress('guimaraes').last, r2.id);
  delete globalThis.localStorage;
});

test("progress: Guimarães's own storage key, one key, never Braga's or Porto's", () => {
  assert.equal(KEY('guimaraes'), 'guimaraes-quests-guimaraes');
  assert.equal(KEY(), 'guimaraes-quests-guimaraes');
  const foreign = JSON.stringify({ v: 3, last: 'x', routes: { x: { visited: { a: 1 } } } });
  const store = fakeStorage({ 'braga-quests-braga': foreign, 'porto-quests-porto': foreign });
  const p = createQuestProgress('guimaraes');
  assert.equal(p.last, null, 'another city save is not read');
  p.route(R1).visit(FIRST[0].id);
  assert.deepEqual([...store.keys()].sort(), ['braga-quests-braga', 'guimaraes-quests-guimaraes', 'porto-quests-porto']);
  const src = ['src/quest-progress.js', 'src/quest.js', 'src/quest-tasks.js'].map((f) => readFileSync(new URL(f, root), 'utf8')).join('\n');
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /braga|porto/i, 'no other city name in the route code');
  delete globalThis.localStorage;
});

test('progress: broken, older or foreign saves and blocked storage never throw', () => {
  const v3 = JSON.stringify({ v: 3, routes: { r: { visited: 5, tries: { s: 'x', t: ['a', 'a', 7, 'B', 'b,c', ''] }, stamps: { s: 'gold', u: 'silver' } } } });
  for (const raw of ['{not json', 'null', '[]', '42', '"x"', JSON.stringify({ visited: {}, answers: { s: 0 } }), JSON.stringify({ v: 2, routes: { r: { tries: { s: [0] } } } }), v3]) {
    fakeStorage({ [KEY('guimaraes')]: raw });
    const rp = createQuestProgress('guimaraes').route('r');
    assert.deepEqual(rp.tries('s'), []);
    if (raw === v3) {
      assert.deepEqual(rp.tries('t'), ['a', 'b,c'], 'only valid, unique tokens survive');
      assert.equal(rp.stamp('s'), 'gold');
      assert.equal(rp.stamp('u'), null);
      assert.equal(rp.submit('s', 's-task', 'a', 'a'), null, 'a stamped stop takes no tries');
    } else assert.equal(rp.submit('s', 's-task', 'a', 'b'), 'wrong');
  }
  assert.deepEqual(readProgress({ v: 2, routes: { r: { tries: { s: [0] } } } }), { v: 3, last: null, routes: {} }, 'a save that is not v3 starts empty');
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const blocked = createQuestProgress('guimaraes').route('r');
  blocked.visit('x');
  assert.equal(blocked.submit('x', 'x-task', 'a', 'a'), 'right');
  assert.deepEqual(blocked.tries('x-task'), ['a']);
  assert.equal(blocked.stamp('x'), 'gold');
  delete globalThis.localStorage;
});
