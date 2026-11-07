// Spaced repetition: every word/sentence is a card that comes back right before you'd forget it.
// ponytail: SM-2-lite (ease + interval); swap in FSRS if review timing feels off.
const DAY = 864e5;

export function review(card = { interval: 0, ease: 2.5, due: 0, reps: 0 }, correct, now = Date.now()) {
  const ease = correct ? Math.min(3, card.ease + 0.1) : Math.max(1.3, card.ease - 0.2);
  const interval = correct ? (card.interval < 1 ? 1 : Math.round(card.interval * ease)) : 0;
  return { interval, ease, due: now + interval * DAY, reps: (card.reps ?? 0) + 1 };
}

export const isDue = (card, now = Date.now()) => card.due <= now;
