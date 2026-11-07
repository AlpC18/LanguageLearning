import de from './data/de.js';
import it from './data/it.js';
import es from './data/es.js';
import verbsDe from './data/verbs/de.js';
import verbsIt from './data/verbs/it.js';
import verbsEs from './data/verbs/es.js';
import readingsDe from './data/readings/de.js';
import readingsIt from './data/readings/it.js';
import readingsEs from './data/readings/es.js';
import { load, save, courseState, recordLesson, unitStatus, dayKey, parseBackup, backupName, completeUnits, LESSONS_PER_UNIT, TEST_PASS, DAILY_GOAL } from './core/progress.js';
import { buildLesson, buildReview, buildTest, buildDictation, buildFocus, unitItems } from './core/exercises.js';
import { questsFor, questProgress, weeklyRecord, weakestKeys } from './core/insights.js';
import { askTutor } from './core/tutor-api.js';
import { renderPage } from './ui/page.js';
import { storyHtml, handleStoryClick } from './ui/story.js';
import { buildConjugation } from './core/conjugation.js';
import { buildReading } from './core/readings.js';
import { isDue } from './core/srs.js';
import { setVoicePrefs, loadClips } from './core/speech.js';
import { whisperReady } from './core/pronounce.js';
import { loadAi, saveAi } from './core/chat-api.js';
import { renderHome } from './ui/home.js';
import { runLesson } from './ui/lesson.js';
import { renderResults, firstTryAccuracy } from './ui/results.js';
import { renderStats } from './ui/stats.js';
import { renderNotebook } from './ui/notebook.js';
import { renderReadingList } from './ui/reading.js';
import { renderChat } from './ui/chat.js';
import { renderSettings } from './ui/settings.js';
import { renderOnboarding } from './ui/onboarding.js';
import { renderTutor } from './ui/tutor.js';
import { setEffects } from './core/effects.js';
import { LEVELS } from './components/search-filter.js';
import { t, setLocale, locale, unitTip, unitTitle } from './i18n.js';

const COURSES = { de, it, es };
const VERBS = { de: verbsDe, it: verbsIt, es: verbsEs };
const READINGS = { de: readingsDe, it: readingsIt, es: readingsEs };
const LESSON_XP = 10;
const PERFECT_BONUS = 5;
const DISTRACTOR_UNITS = 2;
const TEST_XP = 20;
const REMINDER_CHECK_MS = 60_000;
const QUICK_SIZE = 10;
const STORY_CACHE = 'dilbaz:stories';
const FONT_SIZES = { S: '14px', M: '16px', L: '18px' };

const root = document.getElementById('app');
let state = load();
let ai = loadAi();

const course = () => COURSES[state.lang] ?? de;
const meaningOf = (tr, en) => (locale() === 'en' && en) || tr;
const myItems = (lang = state.lang) => (state.custom?.[lang] ?? []).map((w) => ({
  key: `${lang}-my:${w.id}`, id: w.id, kind: 'word', mine: true, target: w.target, tr: w.tr, en: w.en, meaning: meaningOf(w.tr, w.en),
}));
const allItems = () => [...course().units.flatMap(unitItems), ...myItems()];
const itemsByKey = () => new Map(allItems().map((i) => [i.key, i]));

function decoratedUnits() {
  const c = course();
  const cs = courseState(state, c.lang);
  const done = c.units.map((u) => cs.units[u.id] ?? 0);
  return c.units.map((u, i) => ({ ...u, language: c.lang, done: done[i], status: unitStatus(done, i), keywords: [...u.words.flat(), u.titleEn ?? ''] }));
}

const unlockedItems = () => [...decoratedUnits().filter((u) => u.status !== 'locked').flatMap(unitItems), ...myItems()];
const explainLang = () => (locale() === 'en' ? 'English' : 'Turkish');

// Highest level reached in this course; drives verb drills and the chat level.
const currentLevel = () => decoratedUnits().filter((u) => u.status !== 'locked').map((u) => u.level).pop() ?? 'A1';

// Grammar note of the unit an item belongs to ("de-07:w3" → unit de-07).
const tipFor = (key) => {
  const unit = course().units.find((u) => u.id === key.split(':')[0]);
  return unit ? unitTip(unit) : '';
};

function applyLook() {
  const html = document.documentElement;
  if (state.theme === 'light' || state.theme === 'dark') html.dataset.theme = state.theme;
  else delete html.dataset.theme;
  html.style.fontSize = FONT_SIZES[state.fontSize] ?? FONT_SIZES.M;
  setEffects(state.effects);
  setVoicePrefs(state.voice);
}

function commit(next) {
  state = next;
  return save(state);
}

function home(notice = '') {
  whisperReady();
  loadClips(state.lang); // warm the clip index so the first tap plays instantly (iOS needs play() close to the tap)
  const cs = courseState(state, state.lang);
  const now = Date.now();
  const lookup = itemsByKey();
  const due = Object.entries(cs.cards).filter(([key, card]) => lookup.has(key) && isDue(card, now)).map(([key]) => key);
  const mistakes = Object.keys(cs.mistakes).filter((key) => lookup.has(key));
  const quick = weakestKeys(cs.cards, cs.mistakes, (key) => lookup.has(key), QUICK_SIZE);
  const today = dayKey();

  renderHome(root, {
    state, courses: COURSES, units: decoratedUnits(), today: state.daily[dayKey()] ?? 0,
    dueCount: due.length, mistakeCount: mistakes.length, notice,
    quests: questsFor(today).map((quest) => ({ quest, ...questProgress(quest, state, today) })),
    week: weeklyRecord(state.daily, today), quickCount: quick.length,
    onQuick: () => startReview(quick),
    onDictation: () => play(buildDictation(unlockedItems()), {}),
    onClaim: (key, reward) => {
      commit({ ...state, xp: state.xp + reward, daily: { ...state.daily, [today]: (state.daily[today] ?? 0) + reward }, claimed: { ...state.claimed, [key]: true } });
      home();
    },
    onStory: (unit) => showStory(unit),
    onLang: (lang) => { commit({ ...state, lang }); home(); },
    onMeaning: (meaning) => { setLocale(meaning); commit({ ...state, meaning }); home(); },
    onLesson: (unit, advance) => startUnit(unit, advance),
    onReview: () => startReview(due),
    onMistakes: () => startReview(mistakes),
    onExport: exportBackup,
    onImport: importBackup,
    onTest: startTest,
    onPage: (page) => PAGES[page](),
  });
}

const PAGES = {
  stats: () => renderStats(root, {
    state, courses: COURSES, lookup: itemsByKey(), onBack: () => home(),
    onFocus: (cat) => {
      if (cat === 'conjugation') return play(buildConjugation(state.lang, VERBS[state.lang], currentLevel()), {});
      if (cat === 'reading') return PAGES.reading();
      return play(buildFocus(cat, unlockedItems(), allItems()), {});
    },
  }),
  notebook: (notice = '') => {
    const unlocked = decoratedUnits().filter((u) => u.status !== 'locked');
    renderNotebook(root, {
      lang: state.lang, cards: courseState(state, state.lang).cards, notice, onBack: () => home(),
      items: [...myItems(), ...unlocked.flatMap(unitItems).filter((i) => i.kind === 'word')],
      onAdd: addWord,
      onDelete: (id) => {
        const list = (state.custom?.[state.lang] ?? []).filter((w) => w.id !== id);
        commit({ ...state, custom: { ...state.custom, [state.lang]: list } });
        PAGES.notebook();
      },
      onPractice: () => play(buildReview(myItems(), allItems()), {}),
    });
  },
  reading: () => renderReadingList(root, {
    readings: READINGS[state.lang] ?? [], verbsCount: (VERBS[state.lang] ?? []).length, onBack: () => home(),
    onRead: (id) => play(buildReading(READINGS[state.lang].find((r) => r.id === id)), { retry: false }),
    onVerbs: () => play(buildConjugation(state.lang, VERBS[state.lang], currentLevel()), {}),
  }),
  tutor: () => renderTutor(root, {
    lang: state.lang, ai, level: currentLevel(), explain: explainLang(), onBack: () => home(),
    onAddCards: addCards,
  }),
  chat: () => renderChat(root, { lang: state.lang, ai, defaultLevel: currentLevel(), onBack: () => home() }),
  settings: (notice = '') => renderSettings(root, {
    state, ai, langs: Object.keys(COURSES), notice, onBack: () => home(),
    onSave: (patch) => {
      const saved = commit({ ...state, ...patch });
      applyLook();
      PAGES.settings(saved ? t('set.saved') : t('res.notSaved'));
    },
    onSaveAi: (next) => { ai = next; saveAi(ai); PAGES.settings(t('set.saved')); },
    onReminder: async (reminder) => {
      if (reminder.on && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
      commit({ ...state, reminder: { ...state.reminder, ...reminder } });
      PAGES.settings(t('set.saved'));
    },
  }),
};

// Flashcards → the learner's own words (skips ones already in the list). Returns how many were added.
function addCards(cards) {
  const mine = state.custom?.[state.lang] ?? [];
  const have = new Set(mine.map((w) => w.target.toLowerCase()));
  const stamp = Date.now().toString(36);
  const fresh = cards
    .filter((c) => c.word && c.tr && !have.has(c.word.toLowerCase()))
    .map((c, i) => ({ id: `${stamp}${i}`, target: c.word, tr: c.tr, en: c.en ?? '' }));
  commit({ ...state, custom: { ...state.custom, [state.lang]: [...mine, ...fresh] } });
  return fresh.length;
}

function addWord({ target, tr, en }) {
  if (!target || !tr) return PAGES.notebook(t('nb.invalid'));
  const word = { id: Date.now().toString(36), target, tr, en };
  commit({ ...state, custom: { ...state.custom, [state.lang]: [...(state.custom?.[state.lang] ?? []), word] } });
  return PAGES.notebook(t('set.saved'));
}

function exportBackup() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  Object.assign(document.createElement('a'), { href: url, download: backupName() }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importBackup(file) {
  try {
    state = parseBackup(await file.text());
  } catch (err) {
    return home(t('backup.failed', { msg: err.message }));
  }
  setLocale(state.meaning);
  applyLook();
  return home(t(save(state) ? 'backup.loaded' : 'backup.notSaved'));
}

function startUnit(unit, advance) {
  const units = course().units;
  const index = units.findIndex((u) => u.id === unit.id); // home passes a decorated copy, not the original object
  const done = courseState(state, state.lang).units[unit.id] ?? 0;
  const extra = units.slice(Math.max(0, index - DISTRACTOR_UNITS), index).flatMap(unitItems);
  play(buildLesson(unit, advance ? done : LESSONS_PER_UNIT - 1, extra), { unitId: unit.id, advance });
}

function startTest(level) {
  const lang = state.lang;
  const units = course().units.filter((u) => u.level === level);
  runLesson(root, {
    lang, retry: false, tipFor, exercises: buildTest(units.flatMap(unitItems), allItems()), onExit: () => home(),
    onFinish: ({ results }) => {
      const accuracy = firstTryAccuracy(results);
      const passed = accuracy >= TEST_PASS;
      const xp = passed ? TEST_XP : LESSON_XP;
      let next = recordLesson(state, { lang, results, xp, perfect: accuracy === 100 });
      if (passed) next = completeUnits(next, lang, units.map((u) => u.id));
      renderResults(root, {
        lang, xp, results, streak: next.streak.count, itemsByKey: itemsByKey(), saved: commit(next), onContinue: () => home(),
        heading: passed ? t('test.passed', { level }) : t('test.failed'),
        message: passed ? t('test.passedMsg', { acc: accuracy, level }) : t('test.failedMsg', { acc: accuracy, pass: TEST_PASS }),
      });
    },
  });
}

function startReview(keys) {
  const lookup = itemsByKey();
  const items = keys.map((k) => lookup.get(k)).filter(Boolean);
  if (!items.length) return home();
  return play(buildReview(items, allItems()), { isReview: true });
}

// Only course and custom items feed spaced repetition; reading and verb answers just earn XP.
function play(exercises, { retry = true, ...meta }) {
  const lang = state.lang;
  if (!exercises.length) return home();
  return runLesson(root, {
    lang, exercises, retry, tipFor, onFlag: flagItem, onExit: () => home(),
    onFinish: ({ results }) => {
      const lookup = itemsByKey();
      const perfect = results.every((r) => r.correct);
      const xp = results.length ? LESSON_XP + (perfect ? PERFECT_BONUS : 0) : 0;
      const saved = commit(recordLesson(state, { lang, ...meta, results: results.filter((r) => lookup.has(r.key)), attempts: results, xp, perfect }));
      renderResults(root, { lang, xp, results, streak: state.streak.count, itemsByKey: lookup, saved, onContinue: () => home() });
    },
  });
}

function flagItem(item) {
  const flag = { key: item.key, target: item.target || item.meaning, meaning: item.meaning, date: dayKey() };
  commit({ ...state, flags: [...(state.flags ?? []).filter((f) => f.key !== item.key), flag] });
}

// AI story for a unit, using its words; cached per unit and explanation language.
async function showStory(unit, fresh = false) {
  const cacheKey = `${unit.id}:${locale()}`;
  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(STORY_CACHE) ?? '{}'); } catch { /* unreadable cache: regenerate */ }
  const draw = (body, story = null) => renderPage(root, {
    title: `${t('story.title')} · ${unitTitle(unit)}`, body, onBack: () => home(),
    onClick: (el, d) => {
      if (story && handleStoryClick(root, el, story, state.lang, addCards)) return;
      if (d.act === 'regen') showStory(unit, true);
    },
  });
  if (!ai.apiKey) return draw(`<section class="card"><p>${t('chat.needKey')}</p></section>`);
  let story = fresh ? null : cache[cacheKey];
  if (!story) {
    draw(`<p class="notice">${t('tutor.loading')}</p>`);
    try {
      story = await askTutor('story', ai, { lang: state.lang, level: unit.level, explain: explainLang(), topic: unitTitle(unit), words: unit.words.map((w) => w[0]) });
      cache = { ...cache, [cacheKey]: story };
      try { localStorage.setItem(STORY_CACHE, JSON.stringify(cache)); } catch { /* cache is optional */ }
    } catch (err) {
      return draw(`<p class="notice">${err instanceof SyntaxError ? t('tutor.badReply') : t('chat.error', { msg: err.message })}</p>`);
    }
  }
  return draw(`${storyHtml(story, state.lang)}<button class="btn" data-act="regen">${t('story.regen')}</button>`, story);
}

// Fires once a day while the app is open, if the daily goal isn't met by the chosen time.
function checkReminder() {
  const { on, time, lastSent } = state.reminder ?? {};
  if (!on || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const today = dayKey(now);
  const left = (state.goal ?? DAILY_GOAL) - (state.daily[today] ?? 0);
  if (left <= 0 || lastSent === today || now.toTimeString().slice(0, 5) < time) return;
  new Notification('Dilbaz', { body: t('remind.body', { n: left }), icon: 'icon.svg' });
  commit({ ...state, reminder: { ...state.reminder, lastSent: today } });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is optional */ });
window.speechSynthesis?.getVoices(); // voices load async in some browsers
// First visit: choose course, explanation language, goal and starting level.
function onboard() {
  renderOnboarding(root, {
    courses: COURSES,
    onDone: ({ lang, meaning, goal, level }) => {
      setLocale(meaning);
      const below = COURSES[lang].units.filter((u) => LEVELS.indexOf(u.level) < LEVELS.indexOf(level)).map((u) => u.id);
      commit(completeUnits({ ...state, lang, meaning, goal, onboarded: true }, lang, below));
      home();
    },
  });
}

setLocale(state.meaning);
applyLook();
setInterval(checkReminder, REMINDER_CHECK_MS);
if (state.onboarded === false) onboard();
else home();
