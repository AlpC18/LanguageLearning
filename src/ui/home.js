import { esc } from '../core/text.js';
import { speak } from '../core/speech.js';
import { mountSearchFilter, LEVELS } from '../components/search-filter.js';
import { DAILY_GOAL, LESSONS_PER_UNIT } from '../core/progress.js';
import { t, locale, LOCALES, unitTitle, unitTip, otherMeaning } from '../i18n.js';

const meaningOf = ([, tr, en]) => (locale() === 'en' && en) || tr;

function unitCard(unit, number) {
  const dots = '●'.repeat(unit.done) + '○'.repeat(LESSONS_PER_UNIT - unit.done);
  const lesson = t('unit.lesson', { n: unit.done + 1, total: LESSONS_PER_UNIT });
  const action =
    unit.status === 'locked' ? `<span class="muted">${t('unit.locked')}</span>`
    : unit.status === 'done' ? `<button class="btn" data-practice="${unit.id}">${t('unit.practice')}</button>`
    : `<button class="btn primary" data-lesson="${unit.id}">${t(unit.done ? 'unit.continue' : 'unit.start')} · ${lesson}</button>`;
  const words = unit.words
    .map((w) => `<li><button class="icon" data-say="${esc(w[0])}" aria-label="${t('listen')}">🔊</button><b>${esc(w[0])}</b> — ${esc(meaningOf(w))} <span class="also">· ${esc(otherMeaning({ tr: w[1], en: w[2] }))}</span></li>`)
    .join('');
  return `<li class="unit ${unit.status}">
    <div class="unit-head"><span class="badge">${unit.level}</span><h3>${number}. ${esc(unitTitle(unit))}</h3><span class="dots" aria-label="${t('unit.lessonsDone', { done: unit.done, total: LESSONS_PER_UNIT })}">${dots}</span></div>
    <details><summary>${t('unit.grammar')}</summary><p>${esc(unitTip(unit))}</p></details>
    <details><summary>${t('unit.words', { n: unit.words.length })}</summary><ul class="words">${words}</ul></details>
    <div class="unit-actions">${action}</div></li>`;
}

// One collapsible section per CEFR level; empty levels show as "coming soon" only when nothing is filtered.
function levelSections(units, list, filters, byId) {
  const unfiltered = !filters.query && !filters.level && !filters.status;
  return LEVELS.map((level) => {
    const all = units.filter((u) => u.level === level);
    const shown = list.filter((u) => u.level === level);
    if (!shown.length && !(unfiltered && !all.length)) return '';
    const done = all.reduce((sum, u) => sum + u.done, 0);
    const summary = all.length ? t('home.lessons', { done, total: all.length * LESSONS_PER_UNIT }) : t('home.soon');
    const open = all.some((u) => u.status === 'active') || !unfiltered ? 'open' : '';
    return `<li class="level"><details ${open}>
      <summary><span class="badge">${level}</span><b>${t(`level.${level}`)}</b><span class="muted">${summary}</span></summary>
      ${all.some((u) => u.status !== 'done') ? `<button class="btn skip-test" data-test="${level}">${t('home.test', { level })}</button>` : ''}
      <ol class="units">${shown.map((u) => unitCard(u, byId.get(u.id).number)).join('')}</ol></details></li>`;
  }).join('');
}

// Big "continue" shortcut to the first unfinished, unlocked unit.
function continueCard(units) {
  const index = units.findIndex((u) => u.status === 'active');
  if (index < 0) return units.length ? `<section class="card continue"><b>${t('home.allDone')}</b></section>` : '';
  const unit = units[index];
  const sub = t('home.continueSub', { n: index + 1, title: unitTitle(unit), lesson: unit.done + 1, total: LESSONS_PER_UNIT });
  return `<section class="card continue"><span>${esc(sub)}</span><button class="btn primary" data-lesson="${unit.id}">${t('home.continue')}</button></section>`;
}

// units: course units decorated with { done, status, language, keywords }.
export function renderHome(root, { state, courses, units, today, dueCount, mistakeCount, notice = '', onLang, onMeaning, onLesson, onReview, onMistakes, onExport, onImport, onTest, onPage }) {
  const goal = state.goal ?? DAILY_GOAL;
  const goalPct = Math.min(100, Math.round((today / goal) * 100));
  root.innerHTML = `<div class="home">
    <header class="top">
      <h1>Dilbaz</h1>
      <nav class="langs">${Object.values(courses)
        .map((c) => `<button class="lang ${c.lang === state.lang ? 'active' : ''}" data-lang="${c.lang}">${c.flag} ${t(`lang.${c.lang}`)}</button>`)
        .join('')}</nav>
      <div class="stats"><span title="${t('home.streak')}">🔥 ${t('home.days', { n: state.streak.count })}</span><span title="${t('home.totalXp')}">⭐ ${state.xp} XP</span><span title="${t('home.freezeTitle')}">🧊 ${state.freezes ?? 0}</span></div>
    </header>
    <nav class="pages">${['stats', 'notebook', 'reading', 'chat', 'settings'].map((p) => `<button class="btn" data-page="${p}">${t(`nav.${p}`)}</button>`).join('')}</nav>
    ${units.length ? '' : `<p class="card muted">${t('empty.course')}</p>`}
    ${continueCard(units)}
    <div class="meaning" role="group" aria-label="${t('home.meaning')}">
      <span class="muted">${t('home.meaning')}:</span>
      ${Object.entries(LOCALES).map(([code, label]) => `<button class="chip" data-meaning="${code}" aria-pressed="${code === locale()}">${label}</button>`).join('')}
    </div>
    <section class="card goal">
      <div class="goal-row"><span>${t('home.goal')}</span><b>${today}/${goal} XP</b></div>
      <div class="bar"><div style="transform:scaleX(${goalPct / 100})"></div></div>
    </section>
    <section class="quick">
      <button class="btn" data-act="review" ${dueCount ? '' : 'disabled'}>${t('home.review', { n: dueCount })}</button>
      <button class="btn" data-act="mistakes" ${mistakeCount ? '' : 'disabled'}>${t('home.mistakes', { n: mistakeCount })}</button>
    </section>
    <section class="card filter"></section>
    <ol class="path"></ol>
    <footer class="card backup">
      <p class="muted">${t('home.backupNote')}</p>
      <div class="backup-row">
        <button class="btn" data-act="export">${t('home.export')}</button>
        <label class="btn">${t('home.import')}<input type="file" accept="application/json,.json" data-role="import" hidden></label>
      </div>
      <p class="notice" aria-live="polite">${esc(notice)}</p>
    </footer>
  </div>`;

  const byId = new Map(units.map((u, i) => [u.id, { unit: u, number: i + 1 }]));
  mountSearchFilter(
    root.querySelector('.filter'),
    units,
    (list, filters) => {
      root.querySelector('.path').innerHTML = levelSections(units, list, filters, byId) || `<li class="muted">${t('filter.none')}</li>`;
    },
    { groups: ['level', 'status'] },
  );

  root.oninput = null;
  root.onchange = (e) => {
    const file = e.target.matches('[data-role="import"]') && e.target.files[0];
    if (file) onImport(file);
  };
  root.onclick = (e) => {
    const el = e.target.closest('button');
    if (!el || el.disabled) return;
    const { lang, meaning, act, lesson, practice, say, test, page } = el.dataset;
    if (page) onPage(page);
    else if (lang) onLang(lang);
    else if (meaning) onMeaning(meaning);
    else if (act === 'review') onReview();
    else if (act === 'mistakes') onMistakes();
    else if (act === 'export') onExport();
    else if (test) onTest(test);
    else if (lesson) onLesson(byId.get(lesson).unit, true);
    else if (practice) onLesson(byId.get(practice).unit, false);
    else if (say) speak(say, state.lang);
  };
}
