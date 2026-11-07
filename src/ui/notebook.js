import { esc, clean } from '../core/text.js';
import { speak } from '../core/speech.js';
import { t, otherMeaning } from '../i18n.js';
import { renderPage } from './page.js';

const strength = (card) => (!card ? 'new' : card.interval >= 7 ? 'known' : 'learning');

// items: words from unlocked units + the learner's own words (item.mine = true).
export function renderNotebook(root, { lang, items, cards, notice = '', onBack, onAdd, onDelete, onPractice }) {
  const mine = items.filter((i) => i.mine);
  const row = (i) => `<li data-q="${esc(clean(`${i.target} ${i.tr} ${i.en ?? ''}`))}">
      <button class="icon" data-say="${esc(i.target)}" aria-label="${t('listen')}">🔊</button>
      <b>${esc(i.target)}</b> — ${esc(i.meaning)} <span class="also">· ${esc(otherMeaning(i))}</span>
      <span class="pill ${strength(cards[i.key])}">${t(`nb.${strength(cards[i.key])}`)}</span>
      ${i.mine ? `<button class="link" data-delete="${esc(i.id)}">${t('nb.delete')}</button>` : ''}</li>`;
  renderPage(root, {
    title: t('nb.title'), onBack,
    body: `<section class="card">
        <h2>${t('nb.add')}</h2>
        <form class="add-word" data-role="add">
          <input name="target" placeholder="${t('nb.target', { lang: t(`lang.${lang}`) })}" lang="${lang}" required autocomplete="off">
          <input name="tr" placeholder="${t('nb.tr')}" lang="tr" required autocomplete="off">
          <input name="en" placeholder="${t('nb.en')}" lang="en" autocomplete="off">
          <button class="btn primary" type="submit">${t('nb.save')}</button>
        </form>
        <p class="notice" aria-live="polite">${esc(notice)}</p>
        <button class="btn" data-act="practice" ${mine.length ? '' : 'disabled'}>${t('nb.practice', { n: mine.length })}</button>
      </section>
      <section class="card">
        <input type="search" class="search" data-role="filter" placeholder="${t('nb.search')}" autocomplete="off">
        <p class="result-count">${t('nb.count', { n: items.length })}</p>
        <ul class="words notebook">${[...mine, ...items.filter((i) => !i.mine)].map(row).join('')}</ul>
      </section>`,
    onClick: (el, d) => {
      if (d.say) speak(d.say, lang);
      else if (d.delete) onDelete(d.delete);
      else if (d.act === 'practice') onPractice();
    },
    onInput: (el) => {
      if (!el.matches('[data-role="filter"]')) return;
      const q = clean(el.value);
      root.querySelectorAll('.notebook li').forEach((li) => { li.hidden = q && !li.dataset.q.includes(q); });
    },
  });
  root.querySelector('[data-role="add"]').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    onAdd({ target: String(f.get('target')).trim(), tr: String(f.get('tr')).trim(), en: String(f.get('en')).trim() });
  };
}
