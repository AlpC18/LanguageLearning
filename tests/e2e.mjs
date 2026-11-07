// End-to-end tests in a real headless Chromium/Chrome (no npm dependencies).
// Run: npm run e2e   (set CHROME=/path/to/chrome if it isn't found automatically)
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PORT = 5199;
const CDP = 9399;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const CANDIDATES = [process.env.CHROME, '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- infrastructure ---------------------------------------------------------
const server = createServer(async (req, res) => {
  const path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(PORT);

const chromePath = CANDIDATES.find((p) => p && existsSync(p));
if (!chromePath) throw new Error('No Chrome/Chromium found; set CHROME=/path/to/browser');
const profile = await mkdtemp(join(tmpdir(), 'dilbaz-e2e-'));
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) {
  await sleep(250);
  wsUrl = await fetch(`http://127.0.0.1:${CDP}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')?.webSocketDebuggerUrl).catch(() => null);
}
const ws = new WebSocket(wsUrl);
let seq = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text);
};
await new Promise((r) => { ws.onopen = r; });
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.result?.value;
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.click()`);
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 900, deviceScaleFactor: 1, mobile: false });

async function fresh(state, ai = null) {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  await sleep(500);
  await ev(`localStorage.clear(); ${state ? `localStorage.setItem('dilbaz:v1', ${JSON.stringify(JSON.stringify(state))});` : ''}
    ${ai ? `localStorage.setItem('dilbaz:ai', ${JSON.stringify(JSON.stringify(ai))});` : ''} location.reload()`);
  await sleep(900);
}

// Answers whatever is on screen (not necessarily correctly) until the results screen appears.
async function playThrough(maxSteps = 80) {
  for (let i = 0; i < maxSteps; i++) {
    if (await ev("!!document.querySelector('.results')")) return true;
    await ev(`(() => { const q = (s) => document.querySelector(s);
      if (q('[data-act="skip"]')) return q('[data-act="skip"]').click();
      if (q('.match')) for (const l of document.querySelectorAll('[data-left]')) { l.click(); document.querySelector('[data-right="' + l.dataset.left + '"]').click(); }
      else if (q('[data-opt]')) q('[data-opt="0"]').click();
      else if (q('.answer')) { q('.answer').value = 'x'; q('.answer').dispatchEvent(new Event('input', { bubbles: true })); }
      else if (q('[data-tile]:not([disabled])')) q('[data-tile]:not([disabled])').click();
      const b = q('[data-act="next"]'); if (b && !b.hidden && !b.disabled) b.click(); })()`);
    await sleep(60);
    await ev("document.querySelector('.lesson-foot.ok [data-act=\"next\"], .lesson-foot.bad [data-act=\"next\"]')?.click()"); // feedback shown → continue
    await sleep(60);
  }
  return false;
}

const BASE = { lang: 'de', meaning: 'tr', xp: 0, streak: { count: 0, last: null }, daily: {}, courses: {}, onboarded: true };
const results = [];
async function scenario(name, fn) {
  const before = errors.length;
  try {
    await fn();
    assert.equal(errors.length, before, `page errors: ${errors.slice(before).join(' | ')}`);
    results.push(`✓ ${name}`);
  } catch (err) {
    results.push(`✗ ${name}: ${err.message}`);
  }
}

// --- scenarios --------------------------------------------------------------
await scenario('onboarding sets course, language, goal and level', async () => {
  await fresh(null);
  assert.ok(await ev("!!document.querySelector('.onboarding')"));
  for (const sel of ['[data-lang=it]', '[data-meaning=en]', '[data-goal="20"]', '[data-level=A2]', '[data-act=start]']) { await click(sel); await sleep(80); }
  const s = JSON.parse(await ev("localStorage.getItem('dilbaz:v1')"));
  assert.deepEqual([s.lang, s.meaning, s.goal, s.onboarded, s.courses.it.units['it-01']], ['it', 'en', 20, true, 3]);
  assert.equal(await ev("document.querySelector('.goal-row span').textContent"), 'Daily goal');
});

await scenario('first lesson can be played to the end and saves XP', async () => {
  await fresh(BASE);
  await click('.continue [data-lesson]');
  await sleep(200);
  assert.ok(await playThrough());
  const s = JSON.parse(await ev("localStorage.getItem('dilbaz:v1')"));
  assert.ok(s.xp >= 10 && s.courses.de.units['de-01'] === 1 && s.stats.lessons === 1);
});

await scenario('every secondary page opens and returns home', async () => {
  await fresh(BASE);
  for (const page of ['stats', 'notebook', 'reading', 'tutor', 'chat', 'settings']) {
    await click(`[data-page=${page}]`);
    await sleep(120);
    assert.ok(await ev("!!document.querySelector('.page h1')"), `${page} did not render`);
    await click('[data-act=back]');
    await sleep(120);
    assert.ok(await ev("!!document.querySelector('.home')"), `back from ${page}`);
  }
});

await scenario('reading text and verb drill run to the results screen', async () => {
  await fresh({ ...BASE, lang: 'es' });
  await click('[data-page=reading]');
  await sleep(150);
  await click('[data-read]');
  assert.ok(await playThrough());
  await click('[data-act=continue]');
  await click('[data-page=reading]');
  await sleep(150);
  await click('[data-act=verbs]');
  assert.ok(await playThrough());
});

await scenario('quick review and dictation start; quests are listed', async () => {
  await fresh(BASE);
  await click('.continue [data-lesson]');
  await playThrough();
  await click('[data-act=continue]');
  await sleep(150);
  assert.equal(await ev("document.querySelectorAll('.quests li').length"), 4);
  await click('[data-act=quick]');
  await sleep(150);
  assert.ok(await ev("!!document.querySelector('.lesson')"), 'quick review');
  await click('[data-act=exit]');
  await click('[data-act=leave]');
  await sleep(150);
  await click('[data-act=dictation]');
  await sleep(150);
  assert.equal(await ev("document.querySelector('.ex-title').textContent"), 'Duyduğunu yaz');
});

await scenario('AI tutor and unit story render (Claude API mocked)', async () => {
  await fresh({ ...BASE, lang: 'it' }, { apiKey: 'test', model: 'claude-sonnet-5-5' });
  await ev(`window.fetch = async (url, opts) => { const u = JSON.parse(opts.body).messages.at(-1).content;
    const json = u.includes('30-minute') ? { title: 'Lezione', sections: [{ heading: 'A', body: 'b', examples: [] }], exercises: [], quiz: [{ q: 'q', options: ['a', 'b', 'c', 'd'], answer: 2 }] }
      : { title: 'Una storia', text: 'Il cane dorme.\\nIl gatto mangia.', glossary: [{ word: 'cane', lemma: 'il cane', tr: 'köpek', en: 'dog' }] };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(json) }] })); };`);
  await click('[data-page=tutor]');
  await sleep(100);
  await ev("document.querySelector('[data-role=form]').requestSubmit()");
  await sleep(300);
  assert.equal(await ev("document.querySelector('.tutor-output h2')?.textContent"), 'Lezione');
  await click('[data-act=back]');
  await sleep(100);
  await click('[data-story]');
  await sleep(400);
  await click('.story [data-w="cane"]');
  await sleep(100);
  assert.ok((await ev("document.querySelector('.gloss').textContent")).includes('köpek'));
  await click('[data-add-gloss]');
  const s = JSON.parse(await ev("localStorage.getItem('dilbaz:v1')"));
  assert.equal(s.custom.it[0].target, 'il cane');
});

// --- teardown ---------------------------------------------------------------
ws.close();
chrome.kill();
server.close();
await rm(profile, { recursive: true, force: true });
console.log(results.join('\n'));
if (results.some((r) => r.startsWith('✗'))) process.exit(1);
console.log('e2e: all scenarios passed');
