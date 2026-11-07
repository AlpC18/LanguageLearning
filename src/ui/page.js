import { t } from '../i18n.js';

// Shared shell for secondary screens: back button + title + body. Handlers get (el, dataset).
export function renderPage(root, { title, body, onBack, onClick = () => {}, onInput = () => {}, onChange = () => {} }) {
  root.innerHTML = `<div class="page">
    <header class="page-head"><button class="btn" data-act="back">${t('nav.back')}</button><h1>${title}</h1></header>
    ${body}
  </div>`;
  root.onclick = (e) => {
    const el = e.target.closest('button');
    if (!el || el.disabled) return;
    if (el.dataset.act === 'back') onBack();
    else onClick(el, el.dataset);
  };
  root.oninput = (e) => onInput(e.target);
  root.onchange = (e) => onChange(e.target);
}
