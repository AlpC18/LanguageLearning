// Listening mode: plays a unit's sentences (or a reading text) one after another with the natural voice.
// Options: repeat each line, slow speed, show/hide the translation, and a pause to repeat aloud (shadowing).
import { esc } from '../core/text.js';
import { speak, stopSpeaking } from '../core/speech.js';
import { t, locale, unitTitle } from '../i18n.js';
import { renderPage } from './page.js';

const BASE_GAP_MS = 700;
const SHADOW_MS_PER_CHAR = 70; // time to repeat a line aloud, roughly proportional to its length
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// sources: [{ id, label, entries: [{ target, meaning }] }]
export function renderListen(root, { lang, sources, onBack }) {
  const opts = { source: 0, index: 0, repeat: 1, slow: false, showMeaning: true, shadow: false };
  let session = 0; // bumps on every stop so a running loop knows to end
  let running = false;

  const current = () => sources[opts.source];
  const entry = () => current().entries[opts.index];

  function draw() {
    const list = current();
    const e = entry();
    renderPage(root, {
      title: t('listen.title'),
      onBack: () => { stop(); onBack(); },
      body: `<section class="card listen">
          <label>${t('listen.source')} <select data-role="source">${sources.map((s, i) => `<option value="${i}" ${i === opts.source ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
          <p class="muted">${t('listen.position', { n: opts.index + 1, total: list.entries.length })}</p>
          <p class="prompt target" lang="${lang}">${esc(e.target)}</p>
          ${opts.showMeaning ? `<p class="sub">${esc(e.meaning)}</p>` : ''}
          <div class="listen-controls">
            <button class="btn" data-act="prev" aria-label="${t('listen.prev')}">⏮</button>
            <button class="btn primary" data-act="toggle">${running ? t('listen.pause') : t('listen.play')}</button>
            <button class="btn" data-act="next" aria-label="${t('listen.next')}">⏭</button>
          </div>
          <div class="listen-options">
            <label><input type="checkbox" data-opt="slow" ${opts.slow ? 'checked' : ''}> ${t('listen.slow')}</label>
            <label><input type="checkbox" data-opt="showMeaning" ${opts.showMeaning ? 'checked' : ''}> ${t('listen.meaning')}</label>
            <label><input type="checkbox" data-opt="shadow" ${opts.shadow ? 'checked' : ''}> ${t('listen.shadow')}</label>
            <label>${t('listen.repeat')} <select data-role="repeat">${[1, 2, 3].map((n) => `<option ${n === opts.repeat ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          </div>
          <p class="muted">${t('listen.hint')}</p>
        </section>`,
      onClick: (el, d) => {
        if (d.act === 'toggle') return running ? stop() : start();
        if (d.act === 'next' || d.act === 'prev') return jump(d.act === 'next' ? 1 : -1);
        return undefined;
      },
      onChange: (el) => {
        if (el.dataset.role === 'source') { stop(); opts.source = Number(el.value); opts.index = 0; draw(); }
        else if (el.dataset.role === 'repeat') opts.repeat = Number(el.value);
        else if (el.dataset.opt) { opts[el.dataset.opt] = el.checked; draw(); }
      },
    });
  }

  async function loop(id) {
    while (id === session && opts.index < current().entries.length) {
      draw();
      const { target } = entry();
      for (let r = 0; r < opts.repeat && id === session; r += 1) {
        await speak(target, lang, { slow: opts.slow });
        await wait(BASE_GAP_MS + (opts.shadow ? target.length * SHADOW_MS_PER_CHAR : 0));
      }
      if (id !== session) return;
      opts.index += 1;
    }
    if (id === session) { running = false; opts.index = 0; draw(); }
  }

  function start() {
    session += 1;
    running = true;
    loop(session);
  }

  function stop() {
    session += 1;
    running = false;
    stopSpeaking();
    draw();
  }

  function jump(step) {
    const wasRunning = running;
    stop();
    opts.index = Math.max(0, Math.min(current().entries.length - 1, opts.index + step));
    if (wasRunning) start();
    else draw();
  }

  draw();
}

// Playable sources: unlocked units (sentences, then words) and reading texts.
export function listenSources(units, readings) {
  const en = locale() === 'en';
  return [
    ...units.map((u) => ({
      id: u.id,
      label: `${u.level} · ${unitTitle(u)}`,
      entries: [...u.sentences, ...u.words].map(([target, tr, enMeaning]) => ({ target, meaning: (en && enMeaning) || tr })),
    })),
    ...readings.map((r) => ({
      id: r.id,
      label: `📖 ${r.level} · ${en ? r.title.en : r.title.tr}`,
      entries: [{ target: r.text, meaning: en ? r.title.en : r.title.tr }],
    })),
  ];
}
