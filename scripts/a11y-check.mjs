#!/usr/bin/env node
// Accessibility assertion for a running dev server (default :5181).
//
//   npm run dev -- --port 5181
//   node scripts/a11y-check.mjs [url]
//
// Asserts every visible button / link / tab / select / combobox has a
// non-empty accessible name, and that every control reached by the Tab key
// shows a focus ring. Exits 1 on a violation or a page error.
//
// Playwright is a dev-only dependency of the harness, not the project, so the
// module is located from PLAYWRIGHT_MODULE, a bare `playwright` install, or the
// Playwright CLI bundle. CHROME_PATH overrides the browser binary.
import os from 'node:os';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.argv[2] || process.env.BASE || 'http://localhost:5181/';
const CHROME = process.env.CHROME_PATH || findChrome();

// The bundled Playwright may expect a browser build that is not cached; fall
// back to whichever Chromium the ms-playwright cache actually holds.
function findChrome() {
  const cache = join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!existsSync(cache)) return undefined;
  const dirs = readdirSync(cache).sort().reverse();
  for (const d of dirs.filter((x) => x.startsWith('chromium-'))) {
    const p = join(cache, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
    if (existsSync(p)) return p;
  }
  for (const d of dirs.filter((x) => x.startsWith('chromium_headless_shell-'))) {
    const p = join(cache, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell');
    if (existsSync(p)) return p;
  }
  return undefined;
}

async function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    join(os.homedir(), '.nvm/versions/node/v22.22.0/lib/node_modules/@playwright/cli/node_modules/playwright/index.mjs'),
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return await import(c);
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error('Playwright not found — set PLAYWRIGHT_MODULE to its index.mjs');
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

// ---- 1. accessible names -------------------------------------------------
const controls = await page.evaluate(() => {
  const nodes = [
    ...document.querySelectorAll('button, a[href], select, input, [role="tab"], [role="option"], [role="button"], [role="link"]'),
  ];
  const visible = nodes.filter((n) => {
    if (n.closest('[hidden]')) return false;
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = n.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const nameOf = (n) => {
    const al = n.getAttribute('aria-label');
    if (al && al.trim()) return al.trim();
    const lb = n.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim() || '').join(' ').trim();
      if (t) return t;
    }
    const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) return t;
    const img = n.querySelector?.('img[alt]');
    if (img?.alt?.trim()) return img.alt.trim();
    return (n.getAttribute('title') || n.getAttribute('placeholder') || '').trim();
  };
  return visible.map((n) => ({
    tag: n.tagName.toLowerCase(),
    id: n.id || null,
    role: n.getAttribute('role') || null,
    name: nameOf(n),
  }));
});
const unnamed = controls.filter((c) => !c.name);

// ---- 2. focus rings (real Tab traversal) ---------------------------------
await page.evaluate(() => {
  let i = 0;
  for (const n of document.querySelectorAll('button, a[href], select, input, [role="tab"], [role="option"], [tabindex]')) {
    if (n.__a11yKey === undefined) n.__a11yKey = 'e' + i++;
  }
});
const seen = new Map();
async function tabAudit() {
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('Tab');
  for (let i = 0; i < 160; i++) {
    const info = await page.evaluate(() => {
      const n = document.activeElement;
      if (!n || n === document.body || n === document.documentElement) return null;
      const hasRing = (el) => {
        const st = getComputedStyle(el);
        if (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) return true;
        return /0px 0px 0px [1-9]/.test(st.boxShadow);
      };
      let ring = hasRing(n);
      if (!ring) {
        for (let p = n.parentElement, d = 0; p && d < 3; p = p.parentElement, d++) {
          if (p.matches(':focus-within') && hasRing(p)) { ring = true; break; }
        }
      }
      return {
        key: n.__a11yKey || n.tagName + '#' + n.id,
        tag: n.tagName.toLowerCase(),
        id: n.id || null,
        ring,
      };
    });
    if (!info) break;
    if (!seen.has(info.key)) seen.set(info.key, info);
    await page.keyboard.press('Tab');
  }
}
await tabAudit();
await page.click('#tools-toggle').catch(() => {});
await page.waitForTimeout(400);
await tabAudit();
await page.click('#search-input').catch(() => {});
await page.keyboard.type('cas', { delay: 15 }).catch(() => {});
await page.waitForTimeout(800);
await tabAudit();
await page.keyboard.press('Escape').catch(() => {});
await page.click('#place-list .place').catch(() => {});
await page.waitForTimeout(600);
await page.click('#callout-more').catch(() => {});
await page.waitForTimeout(800);
await tabAudit();
await page.click('#tab-routes').catch(() => {});
await page.waitForTimeout(400);
await tabAudit();

const noRing = [...seen.values()].filter((d) => !d.ring);

console.log(`controls checked: ${controls.length}`);
console.log(`controls without an accessible name: ${unnamed.length}`);
for (const u of unnamed) console.log(`  ✗ ${u.tag}${u.id ? '#' + u.id : ''} role=${u.role}`);
console.log(`controls reached by Tab: ${seen.size}`);
console.log(`controls without a focus ring: ${noRing.length}`);
for (const d of noRing) console.log(`  ✗ ${d.tag}${d.id ? '#' + d.id : ''}`);
console.log(`page errors: ${errors.length}`);
for (const e of errors) console.log(`  ✗ ${e}`);

await browser.close();
const failed = unnamed.length + noRing.length + errors.length;
console.log(failed ? '\na11y: FAILED' : '\na11y: OK');
process.exit(failed ? 1 : 0);
