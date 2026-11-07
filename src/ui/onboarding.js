import { t, setLocale, LOCALES } from '../i18n.js';
import { LEVELS } from '../components/search-filter.js';
import { GOALS } from '../core/progress.js';

// First-visit setup. Picking a level > A1 marks earlier levels complete (placement tests remain available).
export function renderOnboarding(root, { courses, onDone }) {
  const choice = { lang: 'de', meaning: 'tr', goal: 30, level: 'A1' };
  const row = (name, entries) => `<div class="choice-row" role="group">${entries
    .map(([value, label]) => `<button class="chip" data-${name}="${value}" aria-pressed="${String(choice[name]) === String(value)}">${label}</button>`).join('')}</div>`;

  function render() {
    root.innerHTML = `<div class="onboarding">
      <h1>${t('ob.title')}</h1>
      <section class="card"><h2>${t('ob.course')}</h2>${row('lang', Object.values(courses).map((c) => [c.lang, `${c.flag} ${t(`lang.${c.lang}`)}`]))}</section>
      <section class="card"><h2>${t('ob.meaning')}</h2>${row('meaning', Object.entries(LOCALES))}</section>
      <section class="card"><h2>${t('ob.goal')}</h2>${row('goal', GOALS.map((g) => [g, `${g} XP`]))}</section>
      <section class="card"><h2>${t('ob.level')}</h2>${row('level', LEVELS.map((l) => [l, l === 'A1' ? t('ob.levelNew') : `${l} · ${t(`level.${l}`)}`]))}
        <p class="muted">${t('ob.levelNote')}</p></section>
      <button class="btn primary" data-act="start">${t('ob.start')}</button>
    </div>`;
  }

  root.onclick = (e) => {
    const el = e.target.closest('button');
    if (!el) return;
    const [name] = Object.keys(el.dataset);
    if (name === 'act') return onDone(choice);
    choice[name] = name === 'goal' ? Number(el.dataset.goal) : el.dataset[name];
    if (name === 'meaning') setLocale(choice.meaning); // relabel the screen right away
    return render();
  };
  root.oninput = null;
  root.onchange = null;
  render();
}
