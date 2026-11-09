// Reading-comprehension questions for one text, in the chosen explanation language.
// listen: the text is hidden and only played (listening comprehension); it can be revealed after answering.
import { locale } from '../i18n.js';

export function buildReading(reading, { listen = false } = {}) {
  const pick = (o) => (locale() === 'en' ? o.en : o.tr);
  return reading.questions.map((q, i) => {
    const options = q.options.map(pick);
    const right = q.options[q.answer];
    return {
      type: 'comprehend', listen, passage: [reading.text], question: pick(q.q), options, answer: options[q.answer],
      item: { key: `${reading.id}:q${i}`, target: '', meaning: pick(right), tr: right.tr, en: right.en },
    };
  });
}
