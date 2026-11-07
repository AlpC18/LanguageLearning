import { esc, clean } from '../core/text.js';
import { speak } from '../core/speech.js';
import { t, locale } from '../i18n.js';

// Renders an AI story where every word is tappable; glossary hits can go straight to the notebook.
export function storyHtml(story, lang) {
  const words = (line) => esc(line).replace(/[\p{L}][\p{L}'’-]*/gu, (w) => `<button class="w" data-w="${w}">${w}</button>`);
  return `<section class="card story" lang="${lang}">
      <h2>${esc(story.title)} <button class="icon" data-say-story aria-label="${t('listen')}">🔊</button></h2>
      <p class="muted">${t('story.tap')}</p>
      ${String(story.text).split('\n').filter(Boolean).map((p) => `<p>${words(p)}</p>`).join('')}
    </section>
    <section class="card gloss" aria-live="polite" hidden></section>`;
}

// Call from a page's click handler; returns true when it handled the click.
export function handleStoryClick(root, el, story, lang, onAdd) {
  const lookup = (w) => (story.glossary ?? []).find((g) => clean(g.word) === clean(w) || clean(g.lemma ?? '') === clean(w));
  const box = root.querySelector('.gloss');
  if (el.hasAttribute('data-say-story')) { speak(story.text, lang); return true; }
  if (el.dataset.w) {
    root.querySelectorAll('.w.active').forEach((b) => b.classList.remove('active'));
    el.classList.add('active');
    speak(el.dataset.w, lang);
    const g = lookup(el.dataset.w);
    box.hidden = false;
    box.innerHTML = g
      ? `<b>${esc(g.lemma || g.word)}</b> — ${esc(locale() === 'en' ? g.en : g.tr)} <span class="also">· ${esc(locale() === 'en' ? g.tr : g.en)}</span>
         <button class="btn" data-add-gloss="${esc(g.word)}">${t('story.add')}</button>`
      : `<b>${esc(el.dataset.w)}</b> — <span class="muted">${t('story.unknown')}</span>`;
    return true;
  }
  if (el.dataset.addGloss) {
    const g = lookup(el.dataset.addGloss);
    onAdd([{ word: g.lemma || g.word, tr: g.tr, en: g.en }]);
    el.textContent = t('story.added');
    el.disabled = true;
    return true;
  }
  return false;
}
