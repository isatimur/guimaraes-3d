// History route progress (src/quest.js). A small localStorage save per city,
// with one record per route:
//
//   guimaraes-quests-<city> = { v: 3, last: <route id>, routes: { <route id>: {
//     visited: { <stop id>: 1 },
//     tries:   { <task id>: [token, ...] },   // every try, in order
//     stamps:  { <stop id>: 'gold' | 'plain' } // written once, when solved
//   } } }
//
// A token is what the visitor tried, by stable id, never by text: an option
// id (multiple_choice, visual_detail), 'true' or 'false' (true_false), a
// landmark id (find_on_map) or the item ids in the tried order, joined by
// commas (sequence). A wrong try stays in `tries` (so a reload never gives a
// fresh first try); the stop is done once its stamp is written. Right first
// time is a gold stamp, right after a retry a plain one. A stamp belongs to
// the stop, not to its task: a task replaced in the data keeps the stamp.
//
// Ported from porto-3d (src/quest-progress.js, main 7be3158). The save
// format is the same v3; Guimarães never had an older save, so there is no
// migration path: anything that is not a v3 save starts empty. Storage may
// be blocked; every access is guarded and falls back to an in-memory copy
// for the page.

export const KEY = (city) => `guimaraes-quests-${city || 'guimaraes'}`;
const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
// a token: ids in kebab case, a sequence joins them with commas
export const isToken = (t) => typeof t === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*(,[a-z0-9]+(-[a-z0-9]+)*)*$/.test(t) && t.length <= 240;
const STAMPS = new Set(['gold', 'plain']);
const blank = () => ({ visited: {}, tries: {}, stamps: {} });

function cleanRoute(r) {
  const out = blank();
  if (!isObj(r)) return out;
  if (isObj(r.visited)) for (const [id, v] of Object.entries(r.visited)) if (v) out.visited[id] = 1;
  if (isObj(r.tries)) {
    for (const [id, list] of Object.entries(r.tries)) {
      if (!Array.isArray(list)) continue;
      const tokens = [...new Set(list.filter(isToken))];
      if (tokens.length) out.tries[id] = tokens;
    }
  }
  if (isObj(r.stamps)) for (const [id, s] of Object.entries(r.stamps)) if (STAMPS.has(s)) out.stamps[id] = s;
  return out;
}

// the state of one task from its tries: done when the answer is among
// them; attempts = tries up to the right one; gold = right first time
export function stopResult(tries, answer) {
  const list = tries || [];
  const at = list.indexOf(answer);
  return { done: at >= 0, attempts: at >= 0 ? at + 1 : list.length, gold: at === 0 };
}

// raw: the parsed save, or null. Anything not a v3 save starts empty.
export function readProgress(raw) {
  const out = { v: 3, last: null, routes: {} };
  if (isObj(raw) && raw.v === 3 && isObj(raw.routes)) {
    for (const [id, r] of Object.entries(raw.routes)) out.routes[id] = cleanRoute(r);
    if (typeof raw.last === 'string') out.last = raw.last;
  }
  return out;
}

export function createQuestProgress(city) {
  let memory = null;
  function read() {
    if (memory) return memory;
    let raw = null;
    try {
      const s = localStorage.getItem(KEY(city));
      raw = s ? JSON.parse(s) : null;
    } catch {
      raw = null;
    }
    memory = readProgress(raw);
    return memory;
  }
  function write() {
    try {
      localStorage.setItem(KEY(city), JSON.stringify(memory));
    } catch {
      // storage blocked: memory keeps the session's progress
    }
  }
  function rec(route) {
    const m = read();
    return (m.routes[route] ||= blank());
  }
  return {
    get state() {
      return read();
    },
    // the route opened last, for #quest
    get last() {
      return read().last;
    },
    setLast(route) {
      if (read().last === route) return;
      memory.last = route;
      write();
    },
    // one route's record, with the same guards
    route(route) {
      return {
        visited: (stop) => !!read().routes[route]?.visited[stop],
        tries: (task) => [...(read().routes[route]?.tries[task] || [])],
        // 'gold' | 'plain' | null
        stamp: (stop) => read().routes[route]?.stamps[stop] || null,
        visit(stop) {
          const r = rec(route);
          if (r.visited[stop]) return;
          r.visited[stop] = 1;
          write();
        },
        // one try at a stop's task: 'right' | 'wrong', or null when ignored
        // (stop done, the same try again, not a token)
        submit(stop, task, token, answer) {
          if (!isToken(token) || !isToken(task)) return null;
          const r = rec(route);
          if (r.stamps[stop]) return null;
          const list = r.tries[task] || [];
          if (list.includes(token)) return null;
          r.tries[task] = [...list, token];
          if (token === answer) r.stamps[stop] = list.length ? 'plain' : 'gold';
          write();
          return token === answer ? 'right' : 'wrong';
        },
        reset() {
          read().routes[route] = blank();
          write();
        },
      };
    },
  };
}

// stops: [{ id, task: { id } }]; rp: progress.route(id). next: index of the
// first stop not done (stops.length when all are done).
export function questSummary(stops, rp) {
  let gold = 0;
  let done = 0;
  let visited = 0;
  let started = 0;
  let next = -1;
  stops.forEach((s, i) => {
    const tried = rp.tries(s.task?.id).length > 0;
    const stamp = rp.stamp(s.id);
    if (rp.visited(s.id) || tried || stamp) visited++;
    if (tried || stamp) started++;
    if (stamp === 'gold') gold++;
    if (stamp) done++;
    else if (next < 0) next = i;
  });
  return { gold, done, visited, started, total: stops.length, next: next < 0 ? stops.length : next };
}
