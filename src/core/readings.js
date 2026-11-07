// Reading-comprehension questions for one text, in the chosen explanation language.
import { locale } from '../i18n.js';

export function buildReading(reading) {
  const pick = (o) => (locale() === 'en' ? o.en : o.tr);
  return reading.questions.map((q, i) => {
    const options = q.options.map(pick);
    const right = q.options[q.answer];
    return {
      type: 'comprehend', passage: [reading.text], question: pick(q.q), options, answer: options[q.answer],
      item: { key: `${reading.id}:q${i}`, target: '', meaning: pick(right), tr: right.tr, en: right.en },
    };
  });
}
