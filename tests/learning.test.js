import assert from 'node:assert/strict';
import { deckItems, deckStats, buildDeckSession, NEW_PER_SESSION } from '../src/core/decks.js';
import { buildReading } from '../src/core/readings.js';
import { PROMPTS } from '../src/core/tutor-api.js';
import { listenSources } from '../src/ui/listen.js';
import de from '../src/data/de.js';
import readingsDe from '../src/data/readings/de.js';

const deck = Array.from({ length: 20 }, (_, i) => [`das Wort${i}`, `kelime${i}`, `word${i}`, 'noun', `Das ist Wort${i}.`, `Bu kelime${i}.`, `This is word${i}.`]);
const items = deckItems('de', { B1: deck });
assert.equal(items[0].key, 'de-deck:das Wort0');
assert.equal(items[0].example, 'Das ist Wort0.');

// New learner: only new words, capped; once practised and due they come back first.
const fresh = buildDeckSession(items, {}, items, () => 0.1);
assert.equal(fresh.length, NEW_PER_SESSION);
assert.ok(fresh.every((e) => ['choice', 'listen-choice'].includes(e.type) && e.options.includes(e.answer)));
const cards = { [items[0].key]: { due: 0, interval: 1, ease: 2.5, reps: 1 } };
const later = buildDeckSession(items, cards, items, () => 0.1, 1000);
assert.ok(later.some((e) => e.item.key === items[0].key && ['reverse', 'type'].includes(e.type)));
assert.deepEqual(deckStats(items, cards, 1000).B1, { total: 20, learned: 1, due: 1 });

// Listening comprehension hides the text; reading keeps it.
const r = readingsDe[0];
assert.ok(buildReading(r, { listen: true }).every((e) => e.listen === true));
assert.ok(buildReading(r).every((e) => e.listen === false));
assert.ok(readingsDe.every((x, i, all) => i === 0 || 'A1A2B1B2C1C2'.indexOf(all[i - 1].level) <= 'A1A2B1B2C1C2'.indexOf(x.level)), 'readings ordered A1 → C2');

// Writing correction asks for the learner's text and the structured feedback.
const w = PROMPTS.writing({ lang: 'it', level: 'B2', explain: 'Turkish', task: 'Weekend', text: 'Io ho andato' });
assert.ok(w.user.includes('«Io ho andato»') && w.user.includes('"errors"') && w.system.includes('B2'));

// Listening sources: units (sentences then words) and whole reading texts.
const sources = listenSources(de.units.slice(0, 1), readingsDe.slice(0, 1));
assert.equal(sources[0].entries.length, de.units[0].sentences.length + de.units[0].words.length);
assert.equal(sources[1].entries[0].target, readingsDe[0].text);
console.log('learning: all checks passed');
