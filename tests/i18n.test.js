import assert from 'node:assert/strict';
import { t, setLocale, keys, unitTitle } from '../src/i18n.js';
import { unitItems } from '../src/core/exercises.js';

// Both dictionaries define exactly the same keys and placeholders.
assert.deepEqual(keys('en').sort(), keys('tr').sort());
for (const key of keys('tr')) {
  setLocale('tr'); const tr = (t(key).match(/\{\w+\}/g) ?? []).sort();
  setLocale('en'); const en = (t(key).match(/\{\w+\}/g) ?? []).sort();
  assert.deepEqual(en, tr, `placeholders differ for ${key}`);
}

setLocale('en');
assert.equal(t('filter.count', { n: 3 }), '3 results');
const unit = { id: 'x-01', title: 'Selamlaşma', titleEn: 'Greetings', words: [['Hallo', 'merhaba', 'hello'], ['Tschüss', 'hoşça kal']], sentences: [] };
assert.equal(unitTitle(unit), 'Greetings');
assert.deepEqual(unitItems(unit).map((i) => i.meaning), ['hello', 'hoşça kal']); // missing English falls back to Turkish

setLocale('tr');
assert.equal(unitTitle(unit), 'Selamlaşma');
assert.deepEqual(unitItems(unit).map((i) => i.meaning), ['merhaba', 'hoşça kal']);
setLocale('xx'); // unknown locale → Turkish
assert.equal(t('ex.check'), 'Kontrol et');

console.log('i18n: all checks passed');

// Every lesson still builds cleanly when meanings are English.
import de from '../src/data/de.js';
import it from '../src/data/it.js';
import { buildLesson } from '../src/core/exercises.js';
import { LESSONS_PER_UNIT } from '../src/core/progress.js';
import { otherMeaning } from '../src/i18n.js';
setLocale('en');
for (const course of [de, it]) {
  course.units.forEach((unit, idx) => {
    const extra = course.units.slice(Math.max(0, idx - 2), idx).flatMap(unitItems);
    Array.from({ length: LESSONS_PER_UNIT }, (_, lessonIndex) => lessonIndex).forEach((lessonIndex) => {
      for (const ex of buildLesson(unit, lessonIndex, extra)) {
        if (!ex.options || ex.type === 'article') continue;
        assert.equal(new Set(ex.options).size, 4, `${unit.id}: ${ex.type} needs 4 distinct options in English`);
        assert.ok(ex.options.includes(ex.answer));
        if (['choice', 'read'].includes(ex.type)) assert.equal(ex.answer, ex.item.en, `${unit.id}: English answer expected`);
      }
    });
  });
}
assert.equal(otherMeaning({ tr: 'ekmek', en: 'bread' }), 'ekmek');
setLocale('tr');
assert.equal(otherMeaning({ tr: 'ekmek', en: 'bread' }), 'bread');
console.log('i18n (English lessons): all checks passed');
