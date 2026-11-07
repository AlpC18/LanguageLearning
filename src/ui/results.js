import { esc } from '../core/text.js';
import { speak } from '../core/speech.js';
import { t, otherMeaning } from '../i18n.js';

const CONFETTI_FROM = 80; // % accuracy that earns a little celebration

// First answer per item decides accuracy; retries only help you learn.
export function firstTryAccuracy(results) {
  const first = new Map();
  results.forEach(({ key, correct }) => { if (!first.has(key)) first.set(key, correct); });
  const values = [...first.values()];
  return values.length ? Math.round((values.filter(Boolean).length / values.length) * 100) : 0;
}

export function renderResults(root, { lang, xp, results, streak, itemsByKey, saved, onContinue, heading = t('res.done'), message = '' }) {
  const missed = [...new Set(results.filter((r) => !r.correct).map((r) => r.key))]
    .map((key) => itemsByKey.get(key))
    .filter(Boolean);
  root.innerHTML = `<div class="results">
    <h1>${esc(heading)}</h1>
    ${message ? `<p class="result-message">${esc(message)}</p>` : ''}
    <div class="result-stats">
      <div class="card"><span>XP</span><b>+${xp}</b></div>
      <div class="card"><span>${t('res.accuracy')}</span><b>%${firstTryAccuracy(results)}</b></div>
      <div class="card"><span>${t('res.streak')}</span><b>🔥 ${streak}</b></div>
    </div>
    ${missed.length ? `<section class="card"><h2>${t('res.review')}</h2><ul class="words">${missed
      .map((i) => `<li><button class="icon" data-say="${esc(i.target)}" aria-label="${t('listen')}">🔊</button><b>${esc(i.target)}</b> — ${esc(i.meaning)} <span class="also">· ${esc(otherMeaning(i))}</span></li>`)
      .join('')}</ul><p class="muted">${esc(t('res.reviewNote'))}</p></section>` : message ? '' : `<p class="perfect">${t('res.perfect')}</p>`}
    ${saved ? '' : `<p class="warn">${t('res.notSaved')}</p>`}
    <button class="btn primary" data-act="continue">${t('ex.next')}</button>
  </div>`;
  root.oninput = null;
  root.onclick = (e) => {
    const el = e.target.closest('button');
    if (!el) return;
    if (el.dataset.say) speak(el.dataset.say, lang);
    if (el.dataset.act === 'continue') onContinue();
  };
  if (firstTryAccuracy(results) >= CONFETTI_FROM) {
    const pieces = Array.from({ length: 18 }, (_, i) => `<span style="left:${(i * 37) % 100}%;animation-delay:${(i % 6) * 0.12}s">${['🎉', '⭐', '✨'][i % 3]}</span>`);
    root.insertAdjacentHTML('beforeend', `<div class="confetti" aria-hidden="true">${pieces.join('')}</div>`);
  }
  root.querySelector('[data-act="continue"]').focus();
}
