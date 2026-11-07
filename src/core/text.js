import { normalize } from '../components/search-filter.js';

// Accent/case/punctuation-insensitive form used for answer comparison.
export const clean = (s) => normalize(s).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();

export const tokens = (s) => s.split(/\s+/).map((w) => w.replace(/[.,!?;:]+$/, '')).filter(Boolean);

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function levenshtein(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a, b) {
  const x = clean(a);
  const y = clean(b);
  if (!x && !y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

// 'exact' | 'accent' (only accents/case/punctuation differ) | 'typo' (one small slip) | 'wrong'
export function gradeText(input, expected) {
  const strip = (s) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  if (strip(input) === strip(expected)) return 'exact';
  if (clean(input) === clean(expected)) return 'accent';
  const target = clean(expected);
  if (target.length >= 6 && levenshtein(clean(input), target) <= 1) return 'typo';
  return 'wrong';
}
