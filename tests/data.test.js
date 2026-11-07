// Validates all course content. `node tests/data.test.js [lang]` checks one language;
// STRICT=1 also fails on missing part-of-speech tags (set once tagging is finished).
import assert from 'node:assert/strict';
import { LEVELS } from '../src/components/search-filter.js';
import { tokens, clean } from '../src/core/text.js';

export const POS = ['noun', 'verb', 'adj', 'adv', 'phrase', 'pron', 'num', 'prep', 'conj', 'other'];
const only = process.argv[2];
const strict = process.env.STRICT === '1';
const langs = ['de', 'it', 'es'].filter((l) => !only || l === only);
const missingPos = [];
const missingCloze = [];

for (const lang of langs) {
  const course = (await import(`../src/data/${lang}.js`)).default;
  const ids = course.units.map((u) => u.id);
  assert.equal(new Set(ids).size, ids.length, `${lang}: duplicate unit ids`);
  const order = course.units.map((u) => LEVELS.indexOf(u.level));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), `${lang}: units must go A1 → C2 in order`);
  for (const u of course.units) {
    assert.ok(LEVELS.includes(u.level), `${u.id}: bad level`);
    assert.ok(u.title && u.titleEn && u.tip && u.tipEn, `${u.id}: needs title, titleEn, tip, tipEn`);
    assert.ok(u.words.length >= 8 && u.sentences.length >= 4, `${u.id}: needs ≥8 words and ≥4 sentences`);
    for (const [target, tr, en, pos] of u.words) {
      assert.ok(target && tr && en, `${u.id}: word "${target}" needs target, Turkish and English`);
      if (pos === undefined) missingPos.push(`${u.id}:${target}`);
      else assert.ok(POS.includes(pos), `${u.id}: "${target}" has unknown pos "${pos}" (use ${POS.join('|')})`);
    }
    for (const [target, tr, en, cloze] of u.sentences) {
      assert.ok(target && tr && en, `${u.id}: sentence "${target}" needs all three`);
      if (cloze === undefined) { missingCloze.push(`${u.id}:${target}`); continue; }
      const { blank, options } = cloze;
      assert.ok(tokens(target).includes(blank), `${u.id}: cloze blank "${blank}" must be one word of "${target}" exactly as written`);
      assert.ok(Array.isArray(options) && options.length === 3, `${u.id}: cloze for "${target}" needs exactly 3 distractors`);
      const all = [blank, ...options].map(clean);
      assert.equal(new Set(all).size, 4, `${u.id}: cloze options for "${target}" must differ from each other and from the answer`);
    }
    for (const col of [1, 2]) {
      const vals = u.words.map((w) => w[col]);
      assert.equal(new Set(vals).size, vals.length, `${u.id}: duplicate ${col === 1 ? 'Turkish' : 'English'} word meaning`);
    }
  }

  const verbs = (await import(`../src/data/verbs/${lang}.js`)).default;
  for (const v of verbs) {
    assert.ok(v.verb && v.tr && v.en && LEVELS.includes(v.level), `verbs/${lang}: "${v.verb}" needs verb, tr, en, level`);
    assert.ok(Array.isArray(v.present) && v.present.length === 6 && v.present.every(Boolean), `verbs/${lang}: "${v.verb}" needs 6 present forms`);
  }
  assert.equal(new Set(verbs.map((v) => v.verb)).size, verbs.length, `verbs/${lang}: duplicate verb`);

  const readings = (await import(`../src/data/readings/${lang}.js`)).default;
  assert.equal(new Set(readings.map((r) => r.id)).size, readings.length, `readings/${lang}: duplicate id`);
  for (const r of readings) {
    assert.ok(r.id && LEVELS.includes(r.level) && r.title?.tr && r.title?.en && r.text, `readings/${lang}: "${r.id}" incomplete`);
    assert.ok(r.questions.length >= 3, `${r.id}: needs ≥3 questions`);
    for (const q of r.questions) {
      assert.ok(q.q?.tr && q.q?.en, `${r.id}: question needs tr and en`);
      assert.equal(q.options.length, 4, `${r.id}: 4 options per question`);
      assert.ok(q.options.every((o) => o.tr && o.en), `${r.id}: every option needs tr and en`);
      for (const k of ['tr', 'en']) assert.equal(new Set(q.options.map((o) => o[k])).size, 4, `${r.id}: duplicate ${k} option`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, `${r.id}: answer must be 0–3`);
    }
  }
  console.log(`data ${lang}: ${course.units.length} units, ${verbs.length} verbs, ${readings.length} readings`);
}
if (missingCloze.length) console.log(`note: ${missingCloze.length} sentences without hand-picked cloze`);
if (missingPos.length) {
  const msg = `${missingPos.length} words without pos (e.g. ${missingPos.slice(0, 3).join(', ')})`;
  if (strict) assert.fail(msg);
  else console.log(`note: ${msg}`);
}
console.log('data: all checks passed');
