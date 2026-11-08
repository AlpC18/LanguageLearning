// Reading texts for this course: the original set (base.js) plus extra B1–C2 texts, ordered A1 → C2.
import base from './it/base.js';
import b1 from './it/b1.js';
import b2 from './it/b2.js';
import c1 from './it/c1.js';
import c2 from './it/c2.js';

const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export default [...base, ...b1, ...b2, ...c1, ...c2].sort((a, b) => ORDER.indexOf(a.level) - ORDER.indexOf(b.level));
