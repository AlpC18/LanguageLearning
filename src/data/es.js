// Spanish course, A1 → C2. Each level is split in two files (5 units each) to keep files small.
import a1 from './es/a1.js';
import a1_2 from './es/a1-2.js';
import a2 from './es/a2.js';
import a2_2 from './es/a2-2.js';
import b1 from './es/b1.js';
import b1_2 from './es/b1-2.js';
import b2 from './es/b2.js';
import b2_2 from './es/b2-2.js';
import c1 from './es/c1.js';
import c1_2 from './es/c1-2.js';
import c2 from './es/c2.js';
import c2_2 from './es/c2-2.js';

export default {
  lang: "es",
  flag: "🇪🇸",
  units: [...a1, ...a1_2, ...a2, ...a2_2, ...b1, ...b1_2, ...b2, ...b2_2, ...c1, ...c1_2, ...c2, ...c2_2],
};
