// Lists ALL content problems at once (tests/data.test.js stops at the first). Run: node scripts/check-content.mjs [de|it|es]
// TARGET=30/30 node scripts/check-content.mjs de   → also require that many words/sentences per unit (default 15/20).
import { tokens } from '../src/core/text.js';

const POS = ['noun', 'verb', 'adj', 'adv', 'phrase', 'pron', 'num', 'prep', 'conj', 'other'];
const [MIN_WORDS, MIN_SENTENCES] = (process.env.TARGET ?? '15/20').split('/').map(Number);
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['de', 'it', 'es'];
let total = 0;
for (const lang of langs) {
  const { units } = (await import(`../src/data/${lang}.js`)).default;
  const problems = [];
  const seenSentence = new Map();
  const seenWord = new Map();
  for (const u of units) {
    if (u.words.length < MIN_WORDS || u.sentences.length < MIN_SENTENCES) problems.push(`${u.id}: ${u.words.length} words / ${u.sentences.length} sentences (want ${MIN_WORDS}/${MIN_SENTENCES})`);
    for (const col of [1, 2]) {
      const vals = u.words.map((w) => w[col].toLocaleLowerCase());
      const d = vals.filter((v, i) => vals.indexOf(v) !== i);
      if (d.length) problems.push(`${u.id}: duplicate ${col === 1 ? 'Turkish' : 'English'} meaning: ${d.join(', ')}`);
    }
    for (const [target, tr, en, pos] of u.words) {
      if (!target || !tr || !en) problems.push(`${u.id}: incomplete word ${target}`);
      if (!POS.includes(pos)) problems.push(`${u.id}: "${target}" bad pos "${pos}"`);
      const k = target.toLocaleLowerCase();
      if (seenWord.has(k)) problems.push(`${u.id}: word "${target}" already in ${seenWord.get(k)}`);
      else seenWord.set(k, u.id);
    }
    for (const [target, tr, en, cloze] of u.sentences) {
      if (!target || !tr || !en) problems.push(`${u.id}: incomplete sentence "${target}"`);
      const k = target.toLocaleLowerCase();
      if (seenSentence.has(k)) problems.push(`${u.id}: duplicate sentence "${target}" (also ${seenSentence.get(k)})`);
      else seenSentence.set(k, u.id);
      const { blank, options } = cloze ?? {};
      if (!blank || !tokens(target).includes(blank)) problems.push(`${u.id}: cloze blank "${blank}" not a word of "${target}"`);
      const all = [blank, ...(options ?? [])].map((w) => String(w).toLocaleLowerCase());
      if (options?.length !== 3 || new Set(all).size !== 4) problems.push(`${u.id}: cloze options invalid for "${target}"`);
    }
  }
  // Level vocabulary decks: complete entries, valid pos, no word already taught in a unit or another deck.
  const decks = (await import(`../src/data/vocab/${lang}.js`)).default;
  for (const [level, deck] of Object.entries(decks)) {
    for (const entry of deck) {
      const [target, tr, en, pos, ex, exTr, exEn] = entry;
      if (entry.length !== 7 || ![target, tr, en, ex, exTr, exEn].every((v) => typeof v === 'string' && v.trim())) problems.push(`deck ${level}: incomplete entry "${target}"`);
      if (!POS.includes(pos)) problems.push(`deck ${level}: "${target}" bad pos "${pos}"`);
      const k = String(target).toLocaleLowerCase();
      if (seenWord.has(k)) problems.push(`deck ${level}: word "${target}" already in ${seenWord.get(k)}`);
      else seenWord.set(k, `deck ${level}`);
    }
  }
  const readings = (await import(`../src/data/readings/${lang}.js`)).default;
  const rIds = readings.map((r) => r.id);
  for (const id of rIds.filter((id, i) => rIds.indexOf(id) !== i)) problems.push(`reading id "${id}" duplicated`);
  for (const r of readings) {
    if (!r.questions || r.questions.length < 3) problems.push(`${r.id}: needs ≥3 questions`);
    for (const q of r.questions ?? []) {
      if (q.options?.length !== 4 || !(q.answer >= 0 && q.answer < 4)) problems.push(`${r.id}: question needs 4 options and answer 0–3`);
      for (const k of ['tr', 'en']) if (new Set((q.options ?? []).map((o) => o[k])).size !== 4) problems.push(`${r.id}: duplicate ${k} option`);
    }
  }
  total += problems.length;
  console.log(`${lang}: ${problems.length} problems`);
  for (const p of problems) console.log(`  ${p}`);
}
process.exitCode = total ? 1 : 0;
