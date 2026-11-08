// Builds exercises from plain course data, so adding a unit = adding words and sentences only.
import { shuffle, tokens, clean } from './text.js';
import { LEVELS } from '../components/search-filter.js';
import { locale } from '../i18n.js';

const WORD_ONLY = new Set(['choice', 'reverse', 'type', 'listen-choice']);
const SENTENCE_ONLY = new Set(['build', 'cloze', 'read']);
export const BLANK = '____';
const PASSAGE_SIZE = 3;
const TEST_SIZE = 15;

export const ARTICLES = { de: ['der', 'die', 'das'], it: ['il', 'lo', 'la', "l'", 'i', 'gli', 'le'], es: ['el', 'la', 'los', 'las'] };

// "der Apfel" → ['der', 'Apfel']; null when the word has no leading article.
export function splitArticle(lang, target) {
  if (lang === 'it' && /^l'/i.test(target)) return ["l'", target.slice(2)];
  const [first, ...rest] = target.split(' ');
  return (ARTICLES[lang] ?? []).includes(first) && rest.length ? [first, rest.join(' ')] : null;
}
const langOf = (item) => item.key.slice(0, 2);

// One plan per lesson in a unit: lesson 1 recognition, lesson 2 production, lesson 3 recall + speaking.
export const PLANS = [
  ['choice', 'choice', 'reverse', 'match', 'listen-choice', 'article', 'reverse', 'speak', 'match', 'reverse'],
  ['build', 'choice', 'build', 'listen-type', 'reverse', 'speak', 'build', 'match', 'type', 'build'],
  ['type', 'build', 'listen-type', 'speak', 'type', 'build', 'speak', 'match', 'type', 'listen-type'],
];
// B1 and up: grammar gaps (cloze) and short reading passages replace part of the word drills.
export const ADVANCED_PLANS = [
  ['choice', 'reverse', 'match', 'cloze', 'listen-choice', 'build', 'article', 'speak', 'match', 'cloze'],
  ['build', 'cloze', 'read', 'listen-type', 'type', 'speak', 'build', 'cloze', 'match', 'build'],
  ['read', 'type', 'cloze', 'listen-type', 'speak', 'build', 'read', 'type', 'cloze', 'listen-type'],
];

export const isAdvanced = (unit) => LEVELS.indexOf(unit.level) >= LEVELS.indexOf('B1');
export const planFor = (unit) => (isAdvanced(unit) ? ADVANCED_PLANS : PLANS);
// 10 lessons per unit walk through the 3 plan stages: recognise words → use them in sentences → produce.
const STAGES = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];
export const planForLesson = (unit, lessonIndex) => planFor(unit)[STAGES[Math.min(lessonIndex, STAGES.length - 1)]];

// Not-yet-practised items first (in random order), then the rest — so every word and sentence of a unit comes up.
const unseenFirst = (items, seen, rnd) => [...shuffle(items.filter((i) => !seen.has(i.key)), rnd), ...shuffle(items.filter((i) => seen.has(i.key)), rnd)];

// meaning: what the learner sees as the translation (English when chosen and available, else Turkish).
export function unitItems(unit) {
  const item = (kind, i) => ([target, tr, en, pos]) => ({ key: `${unit.id}:${kind[0]}${i}`, kind, target, tr, en, pos, meaning: (locale() === 'en' && en) || tr });
  return [
    ...unit.words.map((pair, i) => item('word', i)(pair)),
    ...unit.sentences.map((s, i) => ({ ...item('sentence', i)(s), pos: undefined, cloze: s[3] })),
  ];
}

function options(answer, candidates, rnd) {
  const others = [...new Set(candidates)].filter((v) => clean(v) !== clean(answer));
  return shuffle([answer, ...shuffle(others, rnd).slice(0, 3)], rnd);
}

// Blank a word whose part of speech we know (from the unit's word list) and offer same-POS distractors;
// otherwise fall back to capitalisation as a rough proxy (works for German nouns).
function cloze(item, pool, rnd) {
  const words = tokens(item.target);
  if (item.cloze) { // hand-picked blank + distractors from the course data
    const index = words.indexOf(item.cloze.blank);
    return {
      type: 'cloze', item, answer: item.cloze.blank,
      blanked: words.map((w, i) => (i === index ? BLANK : w)).join(' '),
      options: shuffle([item.cloze.blank, ...item.cloze.options], rnd),
    };
  }
  const baseOf = (w) => clean(splitArticle(langOf(w), w.target)?.[1] ?? w.target);
  const known = pool.filter((i) => i.kind === 'word' && i.pos && !baseOf(i).includes(' '));
  const posOf = new Map(known.map((i) => [baseOf(i), i.pos]));
  const candidates = words.map((w, i) => [w, i]).filter(([w, i]) => i > 0 && w.length >= 3);
  const tagged = candidates.filter(([w]) => posOf.has(clean(w)));
  const from = tagged.length ? tagged : candidates;
  const [answer, index] = from.length ? from[Math.floor(rnd() * from.length)] : [words[0], 0];
  const blanked = words.map((w, i) => (i === index ? BLANK : w)).join(' ');

  const pos = posOf.get(clean(answer));
  const samePos = pos ? [...new Set(known.filter((i) => i.pos === pos).map((i) => splitArticle(langOf(i), i.target)?.[1] ?? i.target))] : [];
  if (new Set(samePos.map(clean).filter((w) => w !== clean(answer))).size >= 3) {
    return { type: 'cloze', item, answer, blanked, options: options(answer, samePos, rnd) };
  }
  const others = pool
    .filter((i) => i.kind === 'sentence' && i.key !== item.key)
    .flatMap((i) => tokens(i.target).slice(1)) // skip sentence-initial words: their capital letter says nothing
    .filter((w) => w.length >= 3);
  // ponytail: capitalisation as a cheap part-of-speech proxy; only used when the word isn't in any word list.
  const upper = (w) => w[0] !== w[0].toLowerCase();
  const sameShape = others.filter((w) => upper(w) === upper(answer));
  return { type: 'cloze', item, answer, blanked, options: options(answer, new Set(sameShape.map(clean)).size >= 4 ? sameShape : others, rnd) };
}

// Passage = the item's sentence plus siblings; the question asks which meaning appears in it.
function read(item, pool, rnd, siblings) {
  const passage = [item, ...shuffle(siblings.filter((s) => s.key !== item.key), rnd).slice(0, PASSAGE_SIZE - 1)];
  const inPassage = new Set(passage.map((s) => s.key));
  const outside = pool.filter((i) => i.kind === 'sentence' && !inPassage.has(i.key)).map((i) => i.meaning);
  return { type: 'read', item, answer: item.meaning, passage: shuffle(passage, rnd).map((s) => s.target), options: options(item.meaning, outside, rnd) };
}

export function makeExercise(type, item, pool, rnd = Math.random, siblings = []) {
  const words = pool.filter((i) => i.kind === 'word');
  switch (type) {
    case 'choice':
      return { type, item, answer: item.meaning, options: options(item.meaning, words.map((i) => i.meaning), rnd) };
    case 'reverse':
    case 'listen-choice':
      return { type, item, answer: item.target, options: options(item.target, words.map((i) => i.target), rnd) };
    case 'build': {
      const own = tokens(item.target);
      const extra = [...new Set(pool.flatMap((i) => tokens(i.target)))].filter((t) => !own.includes(t));
      return { type, item, answer: item.target, tiles: shuffle([...own, ...shuffle(extra, rnd).slice(0, 3)], rnd) };
    }
    case 'cloze':
      return cloze(item, pool, rnd);
    case 'article': {
      const lang = langOf(item);
      const [answer, noun] = splitArticle(lang, item.target);
      const others = ARTICLES[lang].filter((a) => a !== answer);
      return { type, item, answer, noun, options: shuffle([answer, ...shuffle(others, rnd).slice(0, 3)], rnd) };
    }
    case 'read':
      return read(item, pool, rnd, siblings);
    default: // type, listen-type, speak
      return { type, item, answer: item.target };
  }
}

// extraPool: items from earlier units, used only as distractors.
// seen: keys the learner has already practised (their SRS cards).
export function buildLesson(unit, lessonIndex, extraPool = [], rnd = Math.random, seen = new Set()) {
  const items = unitItems(unit);
  const words = unseenFirst(items.filter((i) => i.kind === 'word'), seen, rnd);
  const sentences = unseenFirst(items.filter((i) => i.kind === 'sentence'), seen, rnd);
  const pool = [...items, ...extraPool];
  const nouns = words.filter((i) => splitArticle(langOf(i), i.target));
  let w = 0;
  let s = 0;
  let n = 0;
  return planForLesson(unit, lessonIndex).map((planned) => {
    const type = planned === 'article' && !nouns.length ? 'choice' : planned;
    if (type === 'article') return makeExercise(type, nouns[n++ % nouns.length], pool, rnd);
    if (type === 'match') return { type, pairs: shuffle(words, rnd).slice(0, 4) };
    const useWord = WORD_ONLY.has(type) || (lessonIndex === 0 && !SENTENCE_ONLY.has(type));
    const item = useWord ? words[w++ % words.length] : sentences[s++ % sentences.length];
    return makeExercise(type, item, pool, rnd, sentences);
  });
}

// Review / mistake practice across units: words → recall, sentences → build.
export function buildReview(items, pool, rnd = Math.random, limit = 12) {
  return shuffle(items, rnd)
    .slice(0, limit)
    .map((item) => makeExercise(item.kind === 'word' ? (rnd() < 0.5 ? 'reverse' : 'type') : 'build', item, pool, rnd));
}

// Level placement test: no matching or speaking, so the score reflects recall and grammar only.
export function buildTest(items, pool, rnd = Math.random, size = TEST_SIZE) {
  const WORD_TYPES = ['reverse', 'type'];
  const SENTENCE_TYPES = ['build', 'cloze', 'listen-type'];
  return shuffle(items, rnd)
    .slice(0, size)
    .map((item, i) => {
      const types = item.kind === 'word' ? WORD_TYPES : SENTENCE_TYPES;
      return makeExercise(types[i % types.length], item, pool, rnd);
    });
}

// Dictation: the longest sentences first, typed after listening.
export function buildDictation(items, rnd = Math.random, size = 10) {
  const sentences = shuffle(items.filter((i) => i.kind === 'sentence'), rnd).sort((a, b) => b.target.length - a.target.length);
  return sentences.slice(0, size).map((item) => makeExercise('listen-type', item, items, rnd));
}

// Practice for one weak skill category (see insights.js). Conjugation and reading are handled by their own screens.
const FOCUS_TYPES = { article: 'article', order: 'build', spelling: 'type', listening: 'listen-type', pronunciation: 'speak', vocab: 'reverse', grammar: 'cloze' };
export function buildFocus(category, items, pool, rnd = Math.random, size = 10) {
  const type = FOCUS_TYPES[category];
  if (!type) return [];
  const fits = (i) => (type === 'article' ? i.kind === 'word' && splitArticle(langOf(i), i.target)
    : ['build', 'cloze', 'listen-type', 'speak'].includes(type) ? i.kind === 'sentence' : i.kind === 'word');
  return shuffle(items.filter(fits), rnd).slice(0, size).map((item) => makeExercise(type, item, pool, rnd));
}
