import assert from 'node:assert/strict';
import { audioKey } from '../src/core/audio-key.js';
import { wordFeedback } from '../src/core/pronounce.js';
import { wordDiff } from '../src/core/insights.js';
import { tokensToWords } from '../scripts/transcribe.mjs';

// Clip names must be stable (they are file names on disk) and whitespace-insensitive.
assert.equal(audioKey('Guten Tag!'), audioKey('  Guten   Tag! '));
assert.notEqual(audioKey('Guten Tag!'), audioKey('Guten Tag?'));
assert.match(audioKey('¿Dónde está?'), /^[0-9a-f]{8}$/);

// Whisper tokens → words with the weakest token's confidence.
const words = tokensToWords([
  { text: '[_BEG_]', p: 1 }, { text: ' Ich', p: 0.9 }, { text: ' K', p: 0.4 }, { text: 'ino', p: 0.95 }, { text: '.', p: 0.8 },
]);
assert.deepEqual(words, [{ word: 'Ich', p: 0.9 }, { word: 'Kino', p: 0.4 }]);

// ok / unclear (low confidence) / missed.
const marks = wordFeedback(wordDiff('Ich gehe ins Kino.', 'ich ins Kino'), words);
assert.deepEqual(marks.map((m) => m.status), ['ok', 'missed', 'ok', 'unclear']);
console.log('speech: all checks passed');
