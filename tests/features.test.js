import assert from 'node:assert/strict';
import { streakWithFreeze, recordLesson, MAX_FREEZES } from '../src/core/progress.js';
import { buildConjugation, PRONOUNS } from '../src/core/conjugation.js';
import { buildReading } from '../src/core/readings.js';
import { earnedBadges } from '../src/core/badges.js';
import { splitArticle } from '../src/core/exercises.js';
import { setLocale } from '../src/i18n.js';

// Streak freezes: one missed day is bridged by a freeze; every 7th day earns one (capped).
assert.deepEqual(streakWithFreeze({ count: 5, last: '2026-11-04' }, 1, '2026-11-06'), { streak: { count: 6, last: '2026-11-06' }, freezes: 0 });
assert.deepEqual(streakWithFreeze({ count: 5, last: '2026-11-04' }, 0, '2026-11-06').streak, { count: 1, last: '2026-11-06' });
assert.equal(streakWithFreeze({ count: 6, last: '2026-11-05' }, 0, '2026-11-06').freezes, 1);
assert.equal(streakWithFreeze({ count: 13, last: '2026-11-05' }, MAX_FREEZES, '2026-11-06').freezes, MAX_FREEZES);
assert.equal(streakWithFreeze({ count: 7, last: '2026-11-06' }, 0, '2026-11-06').freezes, 0); // same day: nothing earned twice

const s = recordLesson({ lang: 'de', xp: 0, streak: { count: 0, last: null }, daily: {}, courses: {} }, { lang: 'de', results: [], xp: 15, perfect: true, today: '2026-11-06' });
assert.deepEqual([s.stats, s.bestStreak], [{ lessons: 1, perfect: 1 }, 1]);
assert.ok(earnedBadges(s).find((b) => b.id === 'first').has);
assert.ok(!earnedBadges(s).find((b) => b.id === 'streak7').has);

// Articles
assert.deepEqual(splitArticle('de', 'der Apfel'), ['der', 'Apfel']);
assert.deepEqual(splitArticle('it', "l'acqua"), ["l'", 'acqua']);
assert.deepEqual(splitArticle('es', 'las manos'), ['las', 'manos']);
assert.equal(splitArticle('de', 'gehen'), null);

// Conjugation drill respects level and pronoun order
const verbs = [
  { verb: 'sein', tr: 'olmak', en: 'to be', level: 'A1', present: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'] },
  { verb: 'erörtern', tr: 'ele almak', en: 'to discuss', level: 'B2', present: ['erörtere', 'erörterst', 'erörtert', 'erörtern', 'erörtert', 'erörtern'] },
];
const drill = buildConjugation('de', verbs, 'A2', () => 0.4);
assert.equal(drill.length, 1);
assert.equal(drill[0].pronoun, PRONOUNS.de[2]);
assert.equal(drill[0].answer, 'ist');

// Reading questions follow the chosen explanation language
const reading = { id: 'x-r-1', level: 'A1', title: { tr: 'Not', en: 'Note' }, text: 'Hallo!', questions: [
  { q: { tr: 'Ne?', en: 'What?' }, options: [{ tr: 'a', en: 'A' }, { tr: 'b', en: 'B' }, { tr: 'c', en: 'C' }, { tr: 'd', en: 'D' }], answer: 2 },
] };
setLocale('en');
assert.deepEqual([buildReading(reading)[0].question, buildReading(reading)[0].answer], ['What?', 'C']);
setLocale('tr');
assert.equal(buildReading(reading)[0].answer, 'c');
console.log('features: all checks passed');
