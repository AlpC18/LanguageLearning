import { esc } from '../core/text.js';
import { speak } from '../core/speech.js';
import { t } from '../i18n.js';
import { askTutor, FOCUSES, MAX_CARDS } from '../core/tutor-api.js';
import { renderPage } from './page.js';

// Model text → safe HTML: escape first, then allow **bold** and line breaks.
const rich = (s) => esc(s ?? '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const sayBtn = (text) => `<button class="icon" data-say="${esc(text)}" aria-label="${t('listen')}">🔊</button>`;
const exampleList = (list = []) => `<ul class="words">${list.map((e) => `<li>${sayBtn(e.target)}<b>${esc(e.target)}</b> — ${esc(e.meaning)}</li>`).join('')}</ul>`;

const FORMS = {
  lesson: () => `<label>${t('tutor.focus')} <select name="focus">${FOCUSES.map((f) => `<option value="${f}">${t(`focus.${f}`)}</option>`).join('')}</select></label>
    <input name="topic" placeholder="${t('tutor.topic')}" autocomplete="off">`,
  cards: () => `<textarea name="words" rows="4" placeholder="${t('tutor.words')}" required></textarea>`,
  grammar: () => `<input name="rule" placeholder="${t('tutor.rule')}" required autocomplete="off">`,
};

function lessonView(data) {
  const sections = (data.sections ?? []).map((s) => `<section class="card"><h3>${esc(s.heading)}</h3><p>${rich(s.body)}</p>${exampleList(s.examples)}</section>`).join('');
  const exercises = (data.exercises ?? []).map((x, i) => `<li><p>${rich(x.task)}</p><details><summary>${t('tutor.showAnswer')}</summary><p>${rich(x.answer)}</p></details></li>`).join('');
  const quiz = (data.quiz ?? []).map((q, i) => `<li class="quiz-q" data-answer="${Number(q.answer)}"><p><b>${i + 1}.</b> ${rich(q.q)}</p><div class="options">${(q.options ?? [])
    .map((o, j) => `<button class="option" data-quiz="${i}" data-pick="${j}">${esc(o)}</button>`).join('')}</div></li>`).join('');
  return `<h2>${esc(data.title)}</h2>${sections}
    <section class="card"><h3>${t('tutor.exercises')}</h3><ol class="exercise-list">${exercises}</ol></section>
    <section class="card"><h3>${t('tutor.quiz')}</h3><ol class="quiz">${quiz}</ol><p class="quiz-score" aria-live="polite"></p></section>`;
}

const cardsView = (data) => `<p class="muted">${t('tutor.flip')}</p><ul class="flashcards">${(data.cards ?? []).map((c, i) => `<li>
    <button class="flashcard" data-flip="${i}"><span class="front">${esc(c.word)}</span>
      <span class="back"><b>${esc(c.tr)}</b> · ${esc(c.en)}<br><i>${esc(c.example)}</i><br><small>${esc(c.exampleMeaning)}</small><br>💡 ${esc(c.tip)}</span></button>
    ${sayBtn(c.word)}</li>`).join('')}</ul>
  <button class="btn primary" data-act="add-cards">${t('tutor.addAll')}</button>`;

const grammarView = (data) => `<section class="card"><h2>${esc(data.title)}</h2><p>${rich(data.explanation)}</p></section>
  <section class="card"><h3>${t('tutor.examples')}</h3>${exampleList(data.examples)}</section>
  <section class="card"><h3>${t('tutor.mistakes')}</h3><ol class="mistakes">${(data.mistakes ?? [])
    .map((m) => `<li><span class="bad-text">✗ ${esc(m.wrong)}</span><br><span class="ok-text">✓ ${esc(m.right)}</span><p class="muted">${rich(m.why)}</p></li>`).join('')}</ol></section>`;

const VIEWS = { lesson: lessonView, cards: cardsView, grammar: grammarView };

export function renderTutor(root, { lang, ai, level, explain, onBack, onAddCards }) {
  let mode = 'lesson';
  let result = null;
  const ready = Boolean(ai.apiKey);

  function draw(notice = '') {
    renderPage(root, {
      title: t('tutor.title'), onBack,
      body: !ready ? `<section class="card"><p>${t('chat.needKey')}</p></section>` : `
        <nav class="choice-row">${Object.keys(FORMS).map((m) => `<button class="chip" data-mode="${m}" aria-pressed="${m === mode}">${t(`tutor.${m}`)}</button>`).join('')}</nav>
        <form class="card form tutor-form" data-role="form">${FORMS[mode]()}<button class="btn primary" type="submit">${t('tutor.make')}</button></form>
        <p class="notice" aria-live="polite">${esc(notice)}</p>
        <div class="tutor-output" lang="${lang}"></div>`,
      onClick: (el, d) => {
        if (d.mode) { mode = d.mode; result = null; draw(); }
        else if (d.say) speak(d.say, lang);
        else if (d.flip) el.classList.toggle('flipped');
        else if (d.act === 'add-cards') draw(t('tutor.added', { n: onAddCards(result.cards ?? []) }));
        else if (d.quiz) pickAnswer(el, d);
      },
    });
    if (!ready) return;
    if (result) root.querySelector('.tutor-output').innerHTML = VIEWS[mode](result);
    root.querySelector('[data-role="form"]').onsubmit = submit;
  }

  function pickAnswer(el, d) {
    const item = el.closest('.quiz-q');
    item.querySelectorAll('.option').forEach((b) => { b.disabled = true; });
    const right = Number(item.dataset.answer);
    el.classList.add(Number(d.pick) === right ? 'matched' : 'shake');
    item.querySelector(`[data-pick="${right}"]`).classList.add('matched');
    item.dataset.done = Number(d.pick) === right ? 'ok' : 'bad';
    const all = root.querySelectorAll('.quiz-q');
    const done = [...all].filter((q) => q.dataset.done);
    if (done.length === all.length) {
      root.querySelector('.quiz-score').textContent = t('tutor.score', { n: done.filter((q) => q.dataset.done === 'ok').length, total: all.length });
    }
  }

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const params = { lang, level, explain };
    if (mode === 'lesson') Object.assign(params, { focus: f.get('focus'), topic: String(f.get('topic') ?? '').trim() });
    if (mode === 'grammar') params.rule = String(f.get('rule')).trim();
    if (mode === 'cards') {
      params.words = String(f.get('words')).split(/[,\n]/).map((w) => w.trim()).filter(Boolean);
      if (params.words.length > MAX_CARDS) return draw(t('tutor.tooMany'));
    }
    const button = e.target.querySelector('[type="submit"]');
    button.disabled = true;
    root.querySelector('.notice').textContent = t('tutor.loading');
    try {
      result = await askTutor(mode, ai, params);
      return draw();
    } catch (err) {
      button.disabled = false;
      root.querySelector('.notice').textContent = err instanceof SyntaxError ? t('tutor.badReply') : t('chat.error', { msg: err.message });
      return undefined;
    }
  }

  draw();
}
