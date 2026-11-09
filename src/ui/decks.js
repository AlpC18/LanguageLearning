// Level vocabulary decks: progress per level, a study button, and a browsable word list with examples.
import { esc } from '../core/text.js';
import { speak } from '../core/speech.js';
import { t } from '../i18n.js';
import { NEW_PER_SESSION } from '../core/decks.js';
import { renderPage } from './page.js';

export function renderDecks(root, { lang, items, stats, onBack, onStudy }) {
  const levels = Object.keys(stats);
  const card = (level) => {
    const s = stats[level];
    const words = items.filter((i) => i.level === level).map((i) => `<li>
        <button class="icon" data-say="${esc(i.target)}" aria-label="${t('listen')}">🔊</button><b>${esc(i.target)}</b> — ${esc(i.meaning)}
        <div class="example"><button class="icon" data-say="${esc(i.example)}" aria-label="${t('listen')}">🔊</button><span lang="${lang}">${esc(i.example)}</span>
        <span class="muted">${esc(i.exampleMeaning)}</span></div></li>`).join('');
    return `<section class="card">
        <h2><span class="badge">${level}</span> ${t(`level.${level}`)}</h2>
        <p class="muted">${t('deck.progress', { learned: s.learned, total: s.total, due: s.due })}</p>
        <div class="bar"><div style="transform:scaleX(${s.total ? s.learned / s.total : 0})"></div></div>
        <button class="btn primary" data-study="${level}" ${s.due || s.learned < s.total ? '' : 'disabled'}>${t('deck.study', { n: NEW_PER_SESSION })}</button>
        <details><summary>${t('deck.browse', { n: s.total })}</summary><ul class="words deck-words">${words}</ul></details>
      </section>`;
  };
  renderPage(root, {
    title: t('deck.title'),
    onBack,
    body: `<p class="muted">${t('deck.intro')}</p>${levels.length ? levels.map(card).join('') : `<p class="card muted">${t('deck.empty')}</p>`}`,
    onClick: (el, d) => {
      if (d.study) onStudy(d.study);
      else if (d.say) speak(d.say, lang);
    },
  });
}
