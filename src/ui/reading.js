import { esc } from '../core/text.js';
import { t, locale } from '../i18n.js';
import { LEVELS } from '../components/search-filter.js';
import { renderPage } from './page.js';

export function renderReadingList(root, { readings, verbsCount, onBack, onRead, onListenRead, onVerbs }) {
  const title = (r) => (locale() === 'en' ? r.title.en : r.title.tr);
  const groups = LEVELS.map((level) => {
    const list = readings.filter((r) => r.level === level);
    return list.length ? `<h3><span class="badge">${level}</span> ${t(`level.${level}`)}</h3><ul class="reading-list">${list
      .map((r) => `<li><button class="btn" data-read="${esc(r.id)}">📖 ${esc(title(r))} <span class="muted">· ${t('read.questions', { n: r.questions.length })}</span></button>
        <button class="btn" data-listen-read="${esc(r.id)}" aria-label="${t('read.listen')}">🎧</button></li>`)
      .join('')}</ul>` : '';
  }).join('');
  renderPage(root, {
    title: t('read.title'), onBack,
    body: `<section class="card"><h2>${t('verbs.title')}</h2>
        ${verbsCount ? `<p class="muted">${t('verbs.count', { n: verbsCount })}</p><button class="btn primary" data-act="verbs">${t('verbs.start')}</button>` : `<p class="muted">${t('empty.verbs')}</p>`}</section>
      <section class="card">${groups || `<p class="muted">${t('empty.reading')}</p>`}</section>`,
    onClick: (el, d) => {
      if (d.read) onRead(d.read);
      else if (d.listenRead) onListenRead(d.listenRead);
      else if (d.act === 'verbs') onVerbs();
    },
  });
}
