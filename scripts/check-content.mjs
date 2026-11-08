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
  total += problems.length;
  console.log(`${lang}: ${problems.length} problems`);
  for (const p of problems) console.log(`  ${p}`);
}
process.exitCode = total ? 1 : 0;
