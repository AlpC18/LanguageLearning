import assert from 'node:assert/strict';
import { filterItems, normalize } from '../src/components/search-filter.js';

const items = [
  { id: 1, title: 'Begrüßungen', language: 'de', level: 'A1', status: 'done', keywords: ['Hallo', 'Tschüss'] },
  { id: 2, title: 'In der Straße', language: 'de', level: 'A2', status: 'active' },
  { id: 3, title: 'In città', language: 'it', level: 'A1', status: 'locked', keywords: ['piazza'] },
  { id: 4, title: 'Il caffè', language: 'it', level: 'A2', status: 'active' },
];
const ids = (r) => r.map((i) => i.id);

assert.equal(normalize('Straße'), 'strasse');
assert.equal(normalize('İSTANBUL'), 'istanbul');
assert.deepEqual(ids(filterItems(items, {})), [1, 2, 3, 4]);
assert.deepEqual(ids(filterItems(items, { query: 'strasse' })), [2]);
assert.deepEqual(ids(filterItems(items, { query: 'CITTA' })), [3]);
assert.deepEqual(ids(filterItems(items, { query: 'tschuss' })), [1]); // keywords searched
assert.deepEqual(ids(filterItems(items, { query: 'in a1' })), []);   // all terms must match title/keywords
assert.deepEqual(ids(filterItems(items, { language: 'it', status: 'active' })), [4]);
assert.deepEqual(ids(filterItems(items, { level: 'A1' })), [1, 3]);

const before = JSON.stringify(items);
filterItems(items, { query: 'x' });
assert.equal(JSON.stringify(items), before); // input not mutated

console.log('search-filter: all checks passed');
