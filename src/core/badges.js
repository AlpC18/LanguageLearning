// Achievements are derived from saved progress, so nothing extra has to be stored.
const totalCards = (state) => Object.values(state.courses).reduce((n, c) => n + Object.keys(c.cards ?? {}).length, 0);

export const BADGES = [
  { id: 'first', icon: '🌱', earned: (s) => (s.stats?.lessons ?? 0) >= 1 },
  { id: 'lessons50', icon: '📘', earned: (s) => (s.stats?.lessons ?? 0) >= 50 },
  { id: 'perfect5', icon: '💯', earned: (s) => (s.stats?.perfect ?? 0) >= 5 },
  { id: 'streak7', icon: '🔥', earned: (s) => (s.bestStreak ?? 0) >= 7 },
  { id: 'streak30', icon: '🏆', earned: (s) => (s.bestStreak ?? 0) >= 30 },
  { id: 'xp1000', icon: '⭐', earned: (s) => s.xp >= 1000 },
  { id: 'words100', icon: '🧠', earned: (s) => totalCards(s) >= 100 },
  { id: 'words500', icon: '🎓', earned: (s) => totalCards(s) >= 500 },
  { id: 'polyglot', icon: '🌍', earned: (s) => Object.values(s.courses).filter((c) => Object.keys(c.units ?? {}).length).length >= 2 },
];

export const earnedBadges = (state) => BADGES.map((b) => ({ ...b, has: b.earned(state) }));
