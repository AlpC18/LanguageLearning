import { esc } from '../core/text.js';
import { t } from '../i18n.js';
import { dayKey, LESSONS_PER_UNIT } from '../core/progress.js';
import { LEVELS } from '../components/search-filter.js';
import { earnedBadges } from '../core/badges.js';
import { weakSpots } from '../core/insights.js';
import { renderPage } from './page.js';

const lastDays = (n) => Array.from({ length: n }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1 - i));
  return dayKey(d);
});

// courses: { lang: course }; lookup: Map(key → item) of the current course, for "hardest items".
export function renderStats(root, { state, courses, lookup, onBack, onFocus }) {
  const days = lastDays(14);
  const max = Math.max(state.goal ?? 30, ...days.map((d) => state.daily[d] ?? 0));
  const bars = days.map((d) => {
    const xp = state.daily[d] ?? 0;
    return `<div class="day" title="${d}: ${xp} XP"><div class="col"><div style="transform:scaleY(${xp / max})"></div></div><span>${d.slice(8)}</span></div>`;
  }).join('');
  const words = Object.values(state.courses).reduce((n, c) => n + Object.keys(c.cards ?? {}).length, 0);
  const progress = Object.values(courses).filter((c) => c.units.length).map((c) => {
    const done = state.courses[c.lang]?.units ?? {};
    const rows = LEVELS.map((level) => {
      const units = c.units.filter((u) => u.level === level);
      if (!units.length) return '';
      const pct = units.reduce((n, u) => n + (done[u.id] ?? 0), 0) / (units.length * LESSONS_PER_UNIT);
      return `<div class="prog-row"><span class="badge">${level}</span><div class="bar"><div style="transform:scaleX(${pct})"></div></div><b>${Math.round(pct * 100)}%</b></div>`;
    }).join('');
    return `<div><h3>${c.flag} ${t(`lang.${c.lang}`)}</h3>${rows}</div>`;
  }).join('');
  const mistakes = Object.entries(state.courses[state.lang]?.mistakes ?? {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([key, n]) => lookup.get(key) && `<li><b>${esc(lookup.get(key).target)}</b> — ${esc(lookup.get(key).meaning)} <span class="muted">×${n}</span></li>`)
    .filter(Boolean).join('');
  const badges = earnedBadges(state)
    .map((b) => `<li class="badge-item ${b.has ? 'has' : ''}" title="${t(`badge.${b.id}`)}"><span>${b.icon}</span>${t(`badge.${b.id}`)}</li>`).join('');

  const weak = weakSpots(state.skills);
  const weakHtml = weak.length ? `<ul class="words weak">${weak.map((w) => `<li><b>${t(`cat.${w.cat}`)}</b>
      <div class="bar"><div style="transform:scaleX(${w.rate})"></div></div><span class="muted">${t('weak.rate', { n: Math.round(w.rate * 100) })}</span>
      <button class="btn" data-focus="${w.cat}">${t('weak.practice')}</button></li>`).join('')}</ul>` : `<p class="muted">${t('weak.none')}</p>`;
  renderPage(root, {
    title: t('stats.title'), onBack, onClick: (el, d) => { if (d.focus) onFocus(d.focus); },
    body: `<section class="card"><h2>${t('stats.last14')}</h2><div class="chart">${bars}</div></section>
      <section class="result-stats">
        <div class="card"><span>${t('stats.lessons')}</span><b>${state.stats?.lessons ?? 0}</b></div>
        <div class="card"><span>${t('stats.perfect')}</span><b>${state.stats?.perfect ?? 0}</b></div>
        <div class="card"><span>${t('stats.best')}</span><b>🔥 ${state.bestStreak ?? 0}</b></div>
        <div class="card"><span>${t('stats.words')}</span><b>${words}</b></div>
        <div class="card"><span>XP</span><b>⭐ ${state.xp}</b></div>
        <div class="card"><span>${t('home.freezeTitle')}</span><b>🧊 ${state.freezes ?? 0}</b></div>
      </section>
      <section class="card"><h2>${t('weak.title')}</h2>${weakHtml}</section>
      <section class="card"><h2>${t('stats.badges')}</h2><ul class="badges">${badges}</ul></section>
      <section class="card"><h2>${t('stats.progress')}</h2>${progress}</section>
      ${mistakes ? `<section class="card"><h2>${t('stats.hardest')}</h2><ul class="words">${mistakes}</ul></section>` : ''}`,
  });
}
