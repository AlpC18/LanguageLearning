// Present-tense conjugation drills built from src/data/verbs/<lang>.js.
import { shuffle } from './text.js';
import { locale } from '../i18n.js';
import { LEVELS } from '../components/search-filter.js';

export const PRONOUNS = {
  de: ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'],
  it: ['io', 'tu', 'lui/lei', 'noi', 'voi', 'loro'],
  es: ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ustedes'],
};

// verbs up to maxLevel; one random person per verb.
export function buildConjugation(lang, verbs, maxLevel = 'C2', rnd = Math.random, size = 10) {
  const allowed = verbs.filter((v) => LEVELS.indexOf(v.level) <= LEVELS.indexOf(maxLevel));
  return shuffle(allowed, rnd).slice(0, size).map((v) => {
    const person = Math.floor(rnd() * 6);
    const meaning = (locale() === 'en' && v.en) || v.tr;
    return {
      type: 'conjugate', pronoun: PRONOUNS[lang][person], verb: v.verb, answer: v.present[person],
      item: { key: `${lang}-verb:${v.verb}:${person}`, target: `${PRONOUNS[lang][person]} ${v.present[person]}`, meaning: `${v.verb} — ${meaning}`, tr: v.tr, en: v.en },
    };
  });
}
