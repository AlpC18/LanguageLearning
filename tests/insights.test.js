import assert from 'node:assert/strict';
import { weakSpots, weeklyRecord, weekStart, questsFor, questProgress, weakestKeys, wordDiff } from '../src/core/insights.js';
import { recordLesson } from '../src/core/progress.js';
import { buildDictation, buildFocus, unitItems } from '../src/core/exercises.js';
import de from '../src/data/de.js';

// Skills & days are tracked per lesson
const s0 = { lang: 'de', xp: 0, streak: { count: 0, last: null }, daily: {}, courses: {} };
const s1 = recordLesson(s0, {
  lang: 'de', xp: 10, today: '2026-11-04', isReview: true,
  results: [{ key: 'de-01:w0', correct: true, type: 'type' }],
  attempts: [{ key: 'de-01:w0', correct: true, type: 'type' }, { key: 'x', correct: false, type: 'type' }, { key: 'y', correct: false, type: 'article' }],
});
assert.deepEqual(s1.skills, { spelling: { right: 1, wrong: 1 }, article: { right: 0, wrong: 1 } });
assert.deepEqual(s1.days['2026-11-04'], { lessons: 1, perfect: 0, reviews: 1, newWords: 1 });
const s2 = recordLesson(s1, { lang: 'de', xp: 10, today: '2026-11-04', results: [{ key: 'de-01:w0', correct: true, type: 'type' }] });
assert.equal(s2.days['2026-11-04'].newWords, 1); // already-known card is not new

assert.deepEqual(weakSpots({ a: { right: 1, wrong: 1 } }), []); // too few attempts
assert.deepEqual(weakSpots({ a: { right: 8, wrong: 2 }, b: { right: 2, wrong: 3 } }).map((w) => w.cat), ['b', 'a']);

// Weeks start on Monday
assert.equal(weekStart('2026-11-08'), '2026-11-02'); // Sunday → previous Monday
assert.equal(weekStart('2026-11-02'), '2026-11-02');
assert.deepEqual(weeklyRecord({ '2026-10-27': 40, '2026-11-03': 15, '2026-11-05': 10 }, '2026-11-06'), { current: 25, last: 40, best: 40 });

// Quests: 3 daily (stable per date, unique) + 1 weekly; progress and claim keys
const q = questsFor('2026-11-06');
assert.equal(q.length, 4);
assert.deepEqual(questsFor('2026-11-06'), q);
assert.equal(new Set(q.map((x) => x.id)).size, 4);
const weekly = q.find((x) => x.weekly);
const prog = questProgress(weekly, { days: { '2026-11-03': { newWords: 30 }, '2026-11-05': { newWords: 25 } }, claimed: {} }, '2026-11-06');
assert.deepEqual([prog.value, prog.done, prog.claimed, prog.claimKey], [50, true, false, '2026-11-02:weekWords50']);

assert.deepEqual(weakestKeys({ a: { ease: 2.5, interval: 3 }, b: { ease: 1.3, interval: 1 }, c: { ease: 2.5, interval: 1 } }, { c: 2 }, () => true, 2), ['c', 'b']);

// Pronunciation diff marks missing words
assert.deepEqual(wordDiff('Ich wohne in Berlin.', 'ich wohne berlin').map((w) => w.ok), [true, true, false, true]);

// Dictation prefers long sentences; focus builds the right exercise type
const items = de.units.slice(0, 6).flatMap(unitItems);
const dict = buildDictation(items, () => 0.3, 5);
assert.ok(dict.every((e) => e.type === 'listen-type' && e.item.kind === 'sentence') && dict.length === 5);
assert.ok(buildFocus('article', items, items, () => 0.3).every((e) => e.type === 'article'));
assert.ok(buildFocus('order', items, items, () => 0.3).every((e) => e.type === 'build'));
assert.deepEqual(buildFocus('reading', items, items), []);
console.log('insights: all checks passed');
