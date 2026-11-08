// All progress lives in this browser's localStorage. Pure state helpers + thin load/save.
import { review } from './srs.js';
import { t } from '../i18n.js';

// Exercise type → skill category (kept here to avoid an import cycle with insights.js).
const CATEGORY = {
  article: 'article', conjugate: 'conjugation', build: 'order', cloze: 'grammar', type: 'spelling',
  'listen-type': 'listening', 'listen-choice': 'listening', speak: 'pronunciation',
  choice: 'vocab', reverse: 'vocab', match: 'vocab', read: 'reading', comprehend: 'reading',
};

const KEY = 'dilbaz:v1';
export const DAILY_GOAL = 30;
export const GOALS = [10, 20, 30, 50];
export const MAX_FREEZES = 2; // one streak freeze is earned every 7 streak days
export const LESSONS_PER_UNIT = 10;
const OLD_LESSONS_PER_UNIT = 3;
export const TEST_PASS = 80; // % first-try accuracy needed to skip a level

const empty = () => ({
  lang: 'de', meaning: 'tr', xp: 0, streak: { count: 0, last: null }, daily: {}, courses: {},
  goal: DAILY_GOAL, freezes: 0, bestStreak: 0, stats: { lessons: 0, perfect: 0 },
  voice: { rate: 1, voices: {} }, reminder: { on: false, time: '20:00' }, custom: {},
  onboarded: true, theme: 'system', fontSize: 'M', effects: true, lessonsPerUnit: LESSONS_PER_UNIT,
});

// Units used to have 3 lessons; keep units finished under that scheme finished (partial progress carries over as is).
export function migrate(state) {
  if (state.lessonsPerUnit === LESSONS_PER_UNIT) return state;
  const courses = Object.fromEntries(Object.entries(state.courses ?? {}).map(([lang, course]) => [lang, {
    ...course,
    units: Object.fromEntries(Object.entries(course.units ?? {}).map(([id, n]) => [id, n >= OLD_LESSONS_PER_UNIT ? LESSONS_PER_UNIT : n])),
  }]));
  return { ...state, courses, lessonsPerUnit: LESSONS_PER_UNIT };
}

export function load() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved ? migrate({ ...empty(), ...JSON.parse(saved) }) : { ...empty(), onboarded: false }; // first visit → setup screen
  } catch {
    return empty();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // private mode / storage full: app keeps working for this session
  }
}

// Validates an imported backup; throws a user-facing (localized) error for anything that isn't one.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t('backup.badJson'));
  }
  const valid = data && typeof data === 'object' && Number.isFinite(data.xp)
    && data.courses && typeof data.courses === 'object' && data.streak && typeof data.streak === 'object';
  if (!valid) throw new Error(t('backup.notBackup'));
  return migrate({ ...empty(), ...data });
}

export const backupName = (today = dayKey()) => `dilbaz-yedek-${today}.json`;

export const courseState = (state, lang) => state.courses[lang] ?? { units: {}, cards: {}, mistakes: {} };

export const dayKey = (d = new Date()) => d.toLocaleDateString('sv-SE'); // YYYY-MM-DD, local time

export function nextStreak({ count, last }, today) {
  if (last === today) return { count, last };
  const yesterday = new Date(`${today}T12:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  return { count: last === dayKey(yesterday) ? count + 1 : 1, last: today };
}

// results: [{ key, correct }] in answer order. advance: this lesson unlocks the next one in the unit.
const shiftDay = (day, n) => {
  const d = new Date(`${day}T12:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

// Missing exactly one day spends a freeze instead of resetting the streak; every 7th day earns one.
export function streakWithFreeze(streak, freezes, today) {
  if (streak.last === shiftDay(today, -2) && freezes > 0) {
    return { streak: { count: streak.count + 1, last: today }, freezes: freezes - 1 };
  }
  const next = nextStreak(streak, today);
  const earned = next.count !== streak.count && next.count % 7 === 0;
  return { streak: next, freezes: Math.min(MAX_FREEZES, freezes + (earned ? 1 : 0)) };
}

// attempts: every answer incl. reading/verb ones (feeds skill stats); results: only SRS-tracked items.
// isReview: this session was a review/quick review (counts toward review quests).
export function recordLesson(state, { lang, unitId = null, advance = false, results, attempts = results, xp, today = dayKey(), now = Date.now(), perfect = false, isReview = false }) {
  const course = courseState(state, lang);
  const cards = { ...course.cards };
  const mistakes = { ...course.mistakes };
  for (const { key, correct } of results) {
    cards[key] = review(cards[key], correct, now);
    const count = (mistakes[key] ?? 0) + (correct ? -1 : 1);
    if (count > 0) mistakes[key] = count;
    else delete mistakes[key];
  }
  const units = advance && unitId
    ? { ...course.units, [unitId]: Math.min(LESSONS_PER_UNIT, (course.units[unitId] ?? 0) + 1) }
    : course.units;
  const newWords = results.filter((r) => !course.cards[r.key]).map((r) => r.key);
  const skills = { ...(state.skills ?? {}) };
  for (const { type, correct } of attempts) {
    const cat = CATEGORY[type];
    if (!cat) continue;
    const prev = skills[cat] ?? { right: 0, wrong: 0 };
    skills[cat] = correct ? { ...prev, right: prev.right + 1 } : { ...prev, wrong: prev.wrong + 1 };
  }
  const day = state.days?.[today] ?? { lessons: 0, perfect: 0, reviews: 0, newWords: 0 };
  const days = { ...state.days, [today]: { lessons: day.lessons + 1, perfect: day.perfect + (perfect ? 1 : 0), reviews: day.reviews + (isReview ? 1 : 0), newWords: day.newWords + new Set(newWords).size } };
  const { streak, freezes } = streakWithFreeze(state.streak, state.freezes ?? 0, today);
  const stats = state.stats ?? { lessons: 0, perfect: 0 };
  return {
    ...state,
    xp: state.xp + xp,
    streak,
    freezes,
    bestStreak: Math.max(state.bestStreak ?? 0, streak.count),
    stats: { lessons: stats.lessons + 1, perfect: stats.perfect + (perfect ? 1 : 0) },
    skills,
    days,
    daily: { ...state.daily, [today]: (state.daily[today] ?? 0) + xp },
    courses: { ...state.courses, [lang]: { units, cards, mistakes } },
  };
}

// Passing a level test marks every unit of that level as finished (earlier levels stay as they are).
export function completeUnits(state, lang, unitIds) {
  const course = courseState(state, lang);
  const units = { ...course.units, ...Object.fromEntries(unitIds.map((id) => [id, LESSONS_PER_UNIT])) };
  return { ...state, courses: { ...state.courses, [lang]: { ...course, units } } };
}

// done: finished-lesson count per unit, in course order. Unit n opens once unit n-1 has one finished lesson.
export function unitStatus(done, index) {
  if (done[index] >= LESSONS_PER_UNIT) return 'done';
  if (index === 0 || done[index - 1] > 0) return 'active';
  return 'locked';
}
