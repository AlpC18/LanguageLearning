// Derived learning insights: skill categories, weekly records, quests and weakest items.
import { dayKey } from './progress.js';
import { clean, tokens, similarity } from './text.js';

const MIN_ATTEMPTS = 5;

// skills: { category: { right, wrong } } → weakest first (only categories with enough data).
export function weakSpots(skills = {}) {
  return Object.entries(skills)
    .map(([cat, { right = 0, wrong = 0 }]) => ({ cat, total: right + wrong, rate: wrong / Math.max(1, right + wrong) }))
    .filter((s) => s.total >= MIN_ATTEMPTS)
    .sort((a, b) => b.rate - a.rate);
}

const shift = (day, n) => { const d = new Date(`${day}T12:00`); d.setDate(d.getDate() + n); return dayKey(d); };
export const weekStart = (day = dayKey()) => { const d = new Date(`${day}T12:00`); return shift(day, -((d.getDay() + 6) % 7)); }; // Monday

export function weekXp(daily = {}, start) {
  return Array.from({ length: 7 }, (_, i) => daily[shift(start, i)] ?? 0).reduce((a, b) => a + b, 0);
}

export function weeklyRecord(daily = {}, today = dayKey()) {
  const thisWeek = weekStart(today);
  const starts = new Set(Object.keys(daily).map(weekStart));
  const best = Math.max(0, ...[...starts].filter((s) => s !== thisWeek).map((s) => weekXp(daily, s)));
  return { current: weekXp(daily, thisWeek), last: weekXp(daily, shift(thisWeek, -7)), best };
}

// Quests: 3 daily ones picked deterministically from the date, plus one weekly.
const DAILY = [
  { id: 'lessons3', metric: 'lessons', goal: 3, reward: 15 },
  { id: 'perfect1', metric: 'perfect', goal: 1, reward: 10 },
  { id: 'perfect3', metric: 'perfect', goal: 3, reward: 25 },
  { id: 'xp50', metric: 'xp', goal: 50, reward: 15 },
  { id: 'review1', metric: 'reviews', goal: 1, reward: 10 },
  { id: 'words10', metric: 'newWords', goal: 10, reward: 15 },
];
export const WEEKLY = { id: 'weekWords50', metric: 'newWords', goal: 50, reward: 50, weekly: true };

export function questsFor(day = dayKey()) {
  const seed = [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pool = [...DAILY];
  const picked = [];
  for (let i = 0, s = seed; i < 3; i++, s = (s * 1103515245 + 12345) >>> 0) picked.push(pool.splice(s % pool.length, 1)[0]);
  return [...picked, WEEKLY];
}

export function questProgress(quest, state, day = dayKey()) {
  const days = state.days ?? {};
  const dayValue = (d) => (quest.metric === 'xp' ? state.daily?.[d] ?? 0 : days[d]?.[quest.metric] ?? 0);
  const value = quest.weekly
    ? Array.from({ length: 7 }, (_, i) => dayValue(shift(weekStart(day), i))).reduce((a, b) => a + b, 0)
    : dayValue(day);
  const claimKey = quest.weekly ? `${weekStart(day)}:${quest.id}` : `${day}:${quest.id}`;
  return { value: Math.min(value, quest.goal), done: value >= quest.goal, claimed: Boolean(state.claimed?.[claimKey]), claimKey };
}

// Weakest items: most mistakes, then lowest ease, then shortest interval.
export function weakestKeys(cards = {}, mistakes = {}, has = () => true, n = 10) {
  return Object.entries(cards)
    .filter(([key]) => has(key))
    .sort(([a, ca], [b, cb]) => (mistakes[b] ?? 0) - (mistakes[a] ?? 0) || ca.ease - cb.ease || ca.interval - cb.interval)
    .slice(0, n)
    .map(([key]) => key);
}

// Pronunciation: which words of the target were heard (exactly or with one small slip).
export function wordDiff(target, heard) {
  const said = tokens(heard).map(clean);
  return tokens(target).map((word) => {
    const w = clean(word);
    return { word, ok: said.includes(w) || (w.length > 3 && said.some((s) => similarity(s, w) >= 0.75)) };
  });
}
