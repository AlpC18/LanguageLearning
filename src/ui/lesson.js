import { esc, clean, gradeText, similarity, shuffle } from '../core/text.js';
import { BLANK } from '../core/exercises.js';
import { t, otherMeaning } from '../i18n.js';
import { speak, listen, canListen } from '../core/speech.js';

const CHARS = { de: ['ä', 'ö', 'ü', 'ß'], it: ['à', 'è', 'é', 'ì', 'ò', 'ù'], es: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'] };
const MAX_RETRIES = 2;
const SPEAK_PASS = 0.75;
const AUTO_SPEAK = new Set(['choice', 'listen-choice', 'listen-type', 'speak']);

// Runs one lesson; wrong answers come back at the end (no hearts, no lockout).
// retry: false for tests — wrong answers are not re-asked, so the score is honest.
export function runLesson(root, { lang, exercises, onFinish, onExit, retry = true }) {
  const queue = exercises.map((ex) => (ex.type === 'speak' && !canListen() ? { ...ex, type: 'listen-type' } : ex));
  const retries = new Map();
  const results = [];
  let pos = 0;
  let combo = 0;
  let sel = null;
  let checked = false;

  const current = () => queue[pos];
  const say = (text, slow = false) => speak(text, lang, { slow });
  const $ = (q) => root.querySelector(q);

  const speakRow = () =>
    `<div class="speak-row"><button class="icon big" data-say="normal" aria-label="${t('listen')}">🔊</button><button class="icon" data-say="slow" aria-label="${t('listenSlow')}">🐢</button></div>`;
  const optionList = (ex) =>
    `<div class="options">${ex.options.map((o, i) => `<button class="option" data-opt="${i}"><kbd>${i + 1}</kbd>${esc(o)}</button>`).join('')}</div>`;
  const input = () =>
    `<input class="answer" lang="${lang}" placeholder="${t('ex.placeholder')}" autocomplete="off" autocapitalize="off" spellcheck="false">
     <div class="chars">${CHARS[lang].map((c) => `<button class="char" data-char="${c}">${c}</button>`).join('')}</div>`;

  function body(ex) {
    const title = `<h2 class="ex-title">${t(`ex.${ex.type}`)}</h2>`;
    switch (ex.type) {
      case 'choice': return `${title}<p class="prompt target">${esc(ex.item.target)}</p>${speakRow()}${optionList(ex)}`;
      case 'reverse': return `${title}<p class="prompt">${esc(ex.item.meaning)}</p>${optionList(ex)}`;
      case 'article':
        return `${title}<p class="prompt target"><span class="blank">&nbsp;</span> ${esc(ex.noun)}</p><p class="sub">${esc(ex.item.meaning)}</p>${speakRow()}${optionList(ex)}`;
      case 'conjugate':
        return `${title}<p class="prompt">${esc(ex.item.meaning)}</p><p class="prompt target">${esc(ex.pronoun)} <span class="blank">&nbsp;</span></p>${input()}`;
      case 'comprehend':
        return `${title}<div class="passage" lang="${lang}">${ex.passage[0].split('\n').map((p) => `<p>${esc(p)}</p>`).join('')}</div>${speakRow()}
          <p class="question">${esc(ex.question)}</p>${optionList(ex)}`;
      case 'cloze':
        return `${title}<p class="prompt target">${esc(ex.blanked).replace(BLANK, '<span class="blank">&nbsp;</span>')}</p><p class="sub">${esc(ex.item.meaning)}</p>${optionList(ex)}`;
      case 'read':
        return `${title}<div class="passage" lang="${lang}">${ex.passage.map((p) => `<p>${esc(p)}</p>`).join('')}</div>${speakRow()}
          <p class="question">${t('ex.readQuestion')}</p>${optionList(ex)}`;
      case 'listen-choice': return `${title}${speakRow()}${optionList(ex)}`;
      case 'type': return `${title}<p class="prompt">${esc(ex.item.meaning)}</p>${input()}`;
      case 'listen-type': return `${title}${speakRow()}${input()}`;
      case 'build': return `${title}<p class="prompt">${esc(ex.item.meaning)}</p><div class="answer-line"></div><div class="tiles"></div>`;
      case 'speak':
        return `${title}<p class="prompt target">${esc(ex.item.target)}</p><p class="sub">${esc(ex.item.meaning)}</p>${speakRow()}
          <button class="mic" data-act="mic">${t('ex.mic')}</button><p class="heard" aria-live="polite"></p>
          <button class="link" data-act="skip">${t('ex.skipSpeak')}</button>`;
      case 'match': {
        const right = shuffle(ex.pairs);
        return `${title}<div class="match">
          <div>${shuffle(ex.pairs).map((p) => `<button class="option" data-left="${p.key}">${esc(p.target)}</button>`).join('')}</div>
          <div>${right.map((p) => `<button class="option" data-right="${p.key}">${esc(p.meaning)}</button>`).join('')}</div></div>`;
      }
      default: return '';
    }
  }

  function show() {
    if (pos >= queue.length) return finish();
    const ex = current();
    sel = ex.type === 'build' ? [] : ex.type === 'match' ? { left: null, matched: new Set(), wrong: new Set() } : null;
    checked = false;
    root.innerHTML = `<div class="lesson">
      <header class="lesson-head">
        <button class="icon" data-act="exit" aria-label="${t('ex.exit')}">✕</button>
        <div class="bar"><div style="transform:scaleX(${(pos / queue.length).toFixed(3)})"></div></div>
        <span class="combo">${combo >= 3 ? `🔥 ${combo}` : ''}</span>
      </header>
      <main class="ex">${body(ex)}</main>
      <footer class="lesson-foot"><div class="feedback" aria-live="polite"></div>
        <button class="btn primary" data-act="next" ${ex.type === 'match' ? 'hidden' : ''} disabled>${t('ex.check')}</button>
      </footer></div>`;
    if (ex.type === 'build') renderTiles(ex);
    if (AUTO_SPEAK.has(ex.type)) say(ex.item.target);
    $('.answer')?.focus();
  }

  function renderTiles(ex) {
    $('.answer-line').innerHTML = sel.map((i, n) => `<button class="tile" data-line="${n}">${esc(ex.tiles[i])}</button>`).join('');
    $('.tiles').innerHTML = ex.tiles
      .map((t, i) => `<button class="tile ${sel.includes(i) ? 'used' : ''}" data-tile="${i}" ${sel.includes(i) ? 'disabled' : ''}>${esc(t)}</button>`)
      .join('');
    setReady(sel.length > 0);
  }

  const setReady = (ready) => { $('[data-act="next"]').disabled = !ready; };

  function grade(ex) {
    switch (ex.type) {
      case 'choice':
      case 'reverse':
      case 'listen-choice':
      case 'cloze':
      case 'read':
      case 'article':
      case 'comprehend':
        return { correct: sel === ex.answer };
      case 'conjugate': {
        const result = gradeText(sel ?? '', ex.answer);
        return { correct: result !== 'wrong', note: result === 'accent' || result === 'typo' ? t(`ex.${result}`) : undefined };
      }
      case 'type':
      case 'listen-type': {
        const result = gradeText(sel ?? '', ex.answer);
        return { correct: result !== 'wrong', note: result === 'accent' || result === 'typo' ? t(`ex.${result}`) : undefined };
      }
      case 'build':
        return { correct: clean(sel.map((i) => ex.tiles[i]).join(' ')) === clean(ex.answer) };
      case 'speak':
        return { correct: sel.score >= SPEAK_PASS, note: t('ex.heard', { text: sel.heard, score: Math.round(sel.score * 100) }) };
      default:
        return { correct: true };
    }
  }

  function check() {
    const ex = current();
    const { correct, note } = grade(ex);
    results.push({ key: ex.item.key, correct });
    combo = correct ? combo + 1 : 0;
    const tries = retries.get(ex) ?? 0;
    if (!correct && retry && tries < MAX_RETRIES) {
      retries.set(ex, tries + 1);
      queue.push(ex);
    }
    if (ex.item.target) say(ex.item.target);
    showFeedback(correct, note, ex.item.target ? `${ex.item.target} — ${ex.item.meaning}` : ex.item.meaning, otherMeaning(ex.item));
  }

  function showFeedback(correct, note, answer, also = '') {
    checked = true;
    const foot = $('.lesson-foot');
    foot.classList.add(correct ? 'ok' : 'bad');
    const praise = t('ex.praise').split('|');
    const head = correct ? praise[Math.floor(Math.random() * praise.length)] : t('ex.correctAnswer');
    foot.querySelector('.feedback').innerHTML = `<strong>${head}</strong>${
      note ? `<p class="note">${esc(note)}</p>` : ''}${!correct || note ? `<p>${esc(answer)}</p>` : ''}${also ? `<p class="also">${esc(also)}</p>` : ''}`;
    const btn = foot.querySelector('[data-act="next"]');
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = t('ex.next');
    btn.focus();
    root.querySelectorAll('.option, .tile, .answer, .mic, .char').forEach((el) => { el.disabled = true; });
  }

  async function record(ex) {
    const mic = $('.mic');
    const heard = $('.heard');
    mic.disabled = true;
    mic.textContent = t('ex.listening');
    try {
      const alternatives = await listen(lang);
      if (!alternatives.length) throw new Error(t('speech.no-speech'));
      const best = alternatives
        .map((text) => ({ heard: text, score: similarity(text, ex.answer) }))
        .reduce((a, b) => (b.score > a.score ? b : a));
      sel = best;
      check();
    } catch (err) {
      heard.textContent = err.message;
      mic.disabled = false;
      mic.textContent = t('ex.micRetry');
    }
  }

  function onMatch(ex, el) {
    if (el.dataset.left) {
      root.querySelectorAll('[data-left]').forEach((b) => b.classList.toggle('selected', b === el));
      sel.left = el.dataset.left;
      say(ex.pairs.find((p) => p.key === sel.left).target);
      return;
    }
    if (!sel.left) return;
    const left = root.querySelector(`[data-left="${sel.left}"]`);
    if (el.dataset.right === sel.left) {
      sel.matched.add(sel.left);
      [left, el].forEach((b) => { b.classList.remove('selected'); b.classList.add('matched'); b.disabled = true; });
    } else {
      sel.wrong.add(sel.left);
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 400);
    }
    sel.left = null;
    if (sel.matched.size === ex.pairs.length) {
      ex.pairs.forEach((p) => results.push({ key: p.key, correct: !sel.wrong.has(p.key) }));
      combo = sel.wrong.size ? 0 : combo + 1;
      showFeedback(true);
    }
  }

  function exit() {
    document.removeEventListener('keydown', onKey);
    onExit();
  }

  function finish() {
    document.removeEventListener('keydown', onKey);
    onFinish({ results });
  }

  root.onclick = (e) => {
    const el = e.target.closest('button');
    if (!el || el.disabled) return;
    const ex = current();
    const act = el.dataset.act;
    if (act === 'exit') return exit();
    if (act === 'next') return checked ? (pos++, show()) : check();
    if (act === 'mic') return record(ex);
    if (act === 'skip') return (pos++, show()); // no penalty, like turning the mic off
    if (el.dataset.say) return say(ex.passage ? ex.passage.join(' ') : ex.item.target, el.dataset.say === 'slow');
    if (el.dataset.opt) {
      sel = ex.options[Number(el.dataset.opt)];
      root.querySelectorAll('.option').forEach((b) => b.classList.toggle('selected', b === el));
      if (!['choice', 'read', 'comprehend'].includes(ex.type)) say(ex.type === 'article' ? `${sel} ${ex.noun}` : sel);
      return setReady(true);
    }
    if (el.dataset.tile) return (sel = [...sel, Number(el.dataset.tile)], say(ex.tiles[el.dataset.tile]), renderTiles(ex));
    if (el.dataset.line) return (sel = sel.filter((_, n) => n !== Number(el.dataset.line)), renderTiles(ex));
    if (el.dataset.char) {
      const field = $('.answer');
      field.setRangeText(el.dataset.char, field.selectionStart, field.selectionEnd, 'end');
      field.focus();
      sel = field.value;
      return setReady(true);
    }
    if (ex.type === 'match') onMatch(ex, el);
  };

  root.oninput = (e) => {
    if (!e.target.matches('.answer')) return;
    sel = e.target.value;
    setReady(sel.trim().length > 0);
  };

  function onKey(e) {
    const btn = $('[data-act="next"]');
    if (e.key === 'Enter' && btn && !btn.hidden && !btn.disabled) {
      e.preventDefault();
      btn.click();
    } else if (/^[1-4]$/.test(e.key) && !e.target.matches('input')) {
      root.querySelector(`[data-opt="${Number(e.key) - 1}"]`)?.click();
    }
  }
  document.addEventListener('keydown', onKey);
  show();
}
