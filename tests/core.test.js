import assert from 'node:assert/strict';
import de from '../src/data/de.js';
import it from '../src/data/it.js';
import { clean, gradeText, similarity, tokens } from '../src/core/text.js';
import { review, isDue } from '../src/core/srs.js';
import { recordLesson, nextStreak, unitStatus, courseState, parseBackup, backupName, completeUnits } from '../src/core/progress.js';
import { LEVELS } from '../src/components/search-filter.js';
import { buildLesson, buildReview, buildTest, unitItems, planFor, BLANK } from '../src/core/exercises.js';
import { firstTryAccuracy } from '../src/ui/results.js';

// Seeded RNG so lesson building is reproducible.
const seeded = (s = 42) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

// --- course data sanity
for (const course of [de, it]) {
  const ids = course.units.map((u) => u.id);
  assert.equal(new Set(ids).size, ids.length, `${course.lang}: duplicate unit ids`);
  for (const u of course.units) {
    assert.ok(u.words.length >= 8 && u.sentences.length >= 4, `${u.id}: too little content`);
    const trs = u.words.map(([, tr]) => tr);
    assert.equal(new Set(trs).size, trs.length, `${u.id}: duplicate Turkish word (breaks matching)`);
    assert.ok(u.titleEn && u.tipEn, `${u.id}: missing English title/tip`);
    for (const [target, tr, en] of [...u.words, ...u.sentences]) assert.ok(tr && en, `${u.id}: "${target}" needs Turkish and English`);
    const ens = u.words.map(([, , en]) => en);
    assert.equal(new Set(ens).size, ens.length, `${u.id}: duplicate English word (breaks matching)`);
    assert.ok(u.tip && u.title && LEVELS.includes(u.level), `${u.id}: missing meta`);
  }
  const order = course.units.map((u) => LEVELS.indexOf(u.level));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), `${course.lang}: units must go A1 → C2 in order`);
}

// --- backup
const backup = parseBackup(JSON.stringify({ lang: 'it', xp: 120, streak: { count: 3, last: '2026-11-06' }, daily: {}, courses: { it: { units: { 'it-01': 2 }, cards: {}, mistakes: {} } } }));
assert.equal(backup.xp, 120);
assert.equal(backup.lang, 'it');
assert.throws(() => parseBackup('not json'), /geçerli bir JSON değil/);
assert.throws(() => parseBackup('{"hello":1}'), /Dilbaz yedeği değil/);
assert.throws(() => parseBackup('null'), /Dilbaz yedeği değil/);
assert.deepEqual(parseBackup('{"xp":0,"streak":{},"courses":{}}').daily, {}); // missing fields get defaults
assert.equal(backupName('2026-11-06'), 'dilbaz-yedek-2026-11-06.json');

// --- text
assert.equal(clean("Dov'è la stazione?"), 'dove la stazione');
assert.equal(gradeText('Ich heiße Ali.', 'ich heiße ali'), 'exact');
assert.equal(gradeText('ich heisse ali', 'Ich heiße Ali.'), 'accent');
assert.equal(gradeText('die Schwster', 'die Schwester'), 'typo');
assert.equal(gradeText('Brot', 'das Brot'), 'wrong'); // article is part of the answer
assert.equal(gradeText('', 'das Brot'), 'wrong');
assert.ok(similarity('ich wohne in berlin', 'Ich wohne in Berlin.') === 1);
assert.ok(similarity('ich wohne berlin', 'Ich wohne in Berlin.') > 0.75);
assert.deepEqual(tokens('Hallo, wie geht es dir?'), ['Hallo', 'wie', 'geht', 'es', 'dir']);

// --- srs
const now = Date.UTC(2026, 10, 6);
let card = review(undefined, true, now);
assert.equal(card.interval, 1);
card = review(card, true, now);
assert.ok(card.interval >= 2);
const failed = review(card, false, now);
assert.equal(failed.interval, 0);
assert.ok(isDue(failed, now) && !isDue(card, now));

// --- streak & progress
assert.deepEqual(nextStreak({ count: 4, last: '2026-11-05' }, '2026-11-06'), { count: 5, last: '2026-11-06' });
assert.deepEqual(nextStreak({ count: 4, last: '2026-11-03' }, '2026-11-06'), { count: 1, last: '2026-11-06' });
assert.deepEqual(nextStreak({ count: 4, last: '2026-11-06' }, '2026-11-06'), { count: 4, last: '2026-11-06' });
assert.deepEqual(nextStreak({ count: 0, last: null }, '2026-01-01'), { count: 1, last: '2026-01-01' });

const s0 = { lang: 'de', xp: 0, streak: { count: 0, last: null }, daily: {}, courses: {} };
const s1 = recordLesson(s0, {
  lang: 'de', unitId: 'de-01', advance: true, xp: 10, today: '2026-11-06', now,
  results: [{ key: 'de-01:w0', correct: false }, { key: 'de-01:w1', correct: true }, { key: 'de-01:w0', correct: true }],
});
assert.equal(s1.xp, 10);
assert.equal(s1.daily['2026-11-06'], 10);
assert.equal(courseState(s1, 'de').units['de-01'], 1);
assert.deepEqual(courseState(s1, 'de').mistakes, {}); // corrected later in the same lesson
assert.deepEqual(s0.courses, {}); // input not mutated
const s2 = recordLesson(s1, { lang: 'de', unitId: 'de-01', advance: false, xp: 10, today: '2026-11-06', now, results: [{ key: 'de-01:s0', correct: false }] });
assert.equal(courseState(s2, 'de').units['de-01'], 1); // practice doesn't advance
assert.equal(courseState(s2, 'de').mistakes['de-01:s0'], 1);

assert.deepEqual([0, 1, 2].map((i) => unitStatus([0, 0, 0], i)), ['active', 'locked', 'locked']);
assert.deepEqual([0, 1, 2].map((i) => unitStatus([3, 1, 0], i)), ['done', 'active', 'active']);

// --- exercises: every lesson of every unit builds and is answerable
for (const course of [de, it]) {
  course.units.forEach((unit, idx) => {
    const extra = course.units.slice(Math.max(0, idx - 2), idx).flatMap(unitItems);
    planFor(unit).forEach((plan, lessonIndex) => {
      const lesson = buildLesson(unit, lessonIndex, extra, seeded(idx + lessonIndex));
      assert.equal(lesson.length, plan.length);
      for (const ex of lesson) {
        if (ex.type === 'match') {
          assert.equal(ex.pairs.length, 4);
          continue;
        }
        assert.ok(ex.item && ex.answer, `${unit.id}: empty ${ex.type}`);
        if (ex.type === 'article') {
          assert.ok(ex.options.includes(ex.answer) && ex.item.target.endsWith(ex.noun));
          continue;
        }
        if (ex.options) {
          assert.equal(ex.options.length, 4, `${unit.id}: ${ex.type} needs 4 options`);
          assert.ok(ex.options.includes(ex.answer));
          assert.equal(new Set(ex.options).size, 4);
        }
        if (ex.type === 'cloze') {
          assert.equal(ex.blanked.split(BLANK).length, 2, `${unit.id}: cloze needs exactly one blank`);
          assert.equal(clean(ex.blanked.replace(BLANK, ex.answer)), clean(ex.item.target), `${unit.id}: cloze must rebuild the sentence`);
        }
        if (ex.type === 'read') {
          assert.equal(ex.passage.length, 3, `${unit.id}: passage needs 3 sentences`);
          assert.ok(ex.passage.includes(ex.item.target), `${unit.id}: answer sentence must be in the passage`);
        }
        if (ex.tiles) {
          const left = [...ex.tiles];
          for (const t of tokens(ex.answer)) left.splice(left.indexOf(t), 1);
          assert.ok(left.length <= 3, `${unit.id}: answer must be buildable from tiles`);
        }
      }
    });
  });
}
const b1 = de.units.find((u) => u.level === 'B1');
assert.ok(planFor(b1).flat().includes('read') && !planFor(de.units[0]).flat().includes('read'), 'reading starts at B1');

const c2Items = de.units.filter((u) => u.level === 'C2').flatMap(unitItems);
const test = buildTest(c2Items, de.units.flatMap(unitItems), seeded(7));
assert.equal(test.length, 15);
assert.ok(test.every((ex) => ['reverse', 'type', 'build', 'cloze', 'listen-type'].includes(ex.type)), 'test has no match/speak');

const skipped = completeUnits(s0, 'de', ['de-07', 'de-08']);
assert.deepEqual(courseState(skipped, 'de').units, { 'de-07': 3, 'de-08': 3 });
assert.deepEqual(s0.courses, {}); // input not mutated

const review12 = buildReview(unitItems(de.units[0]), unitItems(de.units[0]), seeded());
assert.equal(review12.length, 12);

// --- results
assert.equal(firstTryAccuracy([{ key: 'a', correct: false }, { key: 'b', correct: true }, { key: 'a', correct: true }]), 50);
assert.equal(firstTryAccuracy([]), 0);

console.log('core: all checks passed');
