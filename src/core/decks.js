// Level vocabulary decks (src/data/vocab): items for spaced repetition and the deck study session.
import { locale } from '../i18n.js';
import { makeExercise } from './exercises.js';
import { shuffle } from './text.js';
import { isDue } from './srs.js';

export const NEW_PER_SESSION = 8;
const SESSION_SIZE = 12;

// Keys use the word itself so progress survives reordering of the deck files.
export function deckItems(lang, decks) {
  const en = locale() === 'en';
  return Object.entries(decks).flatMap(([level, deck]) => deck.map(([target, tr, enMeaning, pos, example, exampleTr, exampleEn]) => ({
    key: `${lang}-deck:${target}`, kind: 'word', deck: level, level, target, tr, en: enMeaning, pos,
    meaning: (en && enMeaning) || tr, example, exampleMeaning: (en && exampleEn) || exampleTr,
  })));
}

// Per level: total words, how many were practised, how many are due for review.
export function deckStats(items, cards, now = Date.now()) {
  const stats = {};
  for (const item of items) {
    const s = (stats[item.level] ??= { total: 0, learned: 0, due: 0 });
    s.total += 1;
    if (cards[item.key]) {
      s.learned += 1;
      if (isDue(cards[item.key], now)) s.due += 1;
    }
  }
  return stats;
}

// Due reviews first, then up to NEW_PER_SESSION new words. New words are recognised (choice), known ones recalled.
export function buildDeckSession(items, cards, pool, rnd = Math.random, now = Date.now()) {
  const due = shuffle(items.filter((i) => cards[i.key] && isDue(cards[i.key], now)), rnd);
  const fresh = items.filter((i) => !cards[i.key]).slice(0, NEW_PER_SESSION);
  const picked = [...due.slice(0, SESSION_SIZE - Math.min(fresh.length, NEW_PER_SESSION)), ...fresh].slice(0, SESSION_SIZE);
  return shuffle(picked, rnd).map((item) => {
    const type = !cards[item.key] ? (rnd() < 0.5 ? 'choice' : 'listen-choice') : (rnd() < 0.5 ? 'reverse' : 'type');
    return makeExercise(type, item, pool, rnd);
  });
}
