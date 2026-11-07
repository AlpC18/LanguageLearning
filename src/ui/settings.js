import { esc } from '../core/text.js';
import { speak, voicesFor } from '../core/speech.js';
import { t } from '../i18n.js';
import { GOALS } from '../core/progress.js';
import { CHAT_MODELS } from '../core/chat-api.js';
import { renderPage } from './page.js';

const SAMPLE = { de: 'Guten Tag! Wie geht es dir?', it: 'Buongiorno! Come stai?', es: '¡Buenos días! ¿Cómo estás?' };

export function renderSettings(root, { state, ai, langs, notice = '', onBack, onSave, onSaveAi, onReminder }) {
  const voiceRow = (lang) => `<label>${t('set.voice', { lang: t(`lang.${lang}`) })}
      <select data-voice="${lang}"><option value="">${t('set.defaultVoice')}</option>${voicesFor(lang)
        .map((v) => `<option value="${esc(v.voiceURI)}" ${state.voice?.voices?.[lang] === v.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select>
      <button class="btn" data-test-voice="${lang}">${t('set.test')}</button></label>`;
  renderPage(root, {
    title: t('set.title'), onBack,
    body: `<section class="card form">
        <label>${t('set.goal')} <select data-role="goal">${GOALS.map((g) => `<option ${g === state.goal ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
        <label>${t('set.rate')} <input type="range" min="0.6" max="1.4" step="0.1" value="${state.voice?.rate ?? 1}" data-role="rate"> <b data-role="rate-value">${state.voice?.rate ?? 1}×</b></label>
        ${langs.map(voiceRow).join('')}
      </section>
      <section class="card form">
        <h2>${t('set.look')}</h2>
        <label>${t('set.theme')} <select data-role="theme">${['system', 'light', 'dark'].map((v) => `<option value="${v}" ${state.theme === v ? 'selected' : ''}>${t(`set.theme${v[0].toUpperCase()}${v.slice(1)}`)}</option>`).join('')}</select></label>
        <label>${t('set.font')} <select data-role="font">${['S', 'M', 'L'].map((v) => `<option value="${v}" ${state.fontSize === v ? 'selected' : ''}>${t(`set.font${v}`)}</option>`).join('')}</select></label>
        <label><input type="checkbox" data-role="effects" ${state.effects !== false ? 'checked' : ''}> ${t('set.effects')}</label>
      </section>
      <section class="card form">
        <label><input type="checkbox" data-role="reminder" ${state.reminder?.on ? 'checked' : ''}> ${t('set.reminder')}</label>
        <input type="time" value="${state.reminder?.time ?? '20:00'}" data-role="reminder-time">
        <p class="muted">${t('set.reminderNote')}</p>
      </section>
      <section class="card form">
        <h2>${t('set.ai')}</h2>
        <p class="muted">${t('chat.needKey')}</p>
        <label>${t('set.apiKey')} <input type="password" value="${esc(ai.apiKey)}" data-role="api-key" autocomplete="off" spellcheck="false"></label>
        <label>${t('set.model')} <select data-role="model">${Object.entries(CHAT_MODELS).map(([id, name]) => `<option value="${id}" ${id === ai.model ? 'selected' : ''}>${name}</option>`).join('')}</select></label>
      </section>
      <section class="card form"><h2>${t('flag.title')}</h2>
        ${(state.flags ?? []).length ? `<ul class="words">${state.flags.map((f) => `<li><b>${esc(f.target)}</b> — ${esc(f.meaning ?? '')} <span class="muted">${esc(f.key)}</span></li>`).join('')}</ul>
          <div class="backup-row"><button class="btn" data-act="copy-flags">${t('flag.copy')}</button><button class="btn" data-act="clear-flags">${t('flag.clear')}</button></div>`
          : `<p class="muted">${t('flag.none')}</p>`}
      </section>
      <p class="notice" aria-live="polite">${esc(notice)}</p>`,
    onClick: async (el, d) => {
      if (d.testVoice) speak(SAMPLE[d.testVoice], d.testVoice);
      if (d.act === 'clear-flags') onSave({ flags: [] });
      if (d.act === 'copy-flags') {
        await navigator.clipboard?.writeText(JSON.stringify(state.flags, null, 2)).catch(() => {});
        el.textContent = t('flag.copied');
      }
    },
    onInput: (el) => { if (el.matches('[data-role="rate"]')) root.querySelector('[data-role="rate-value"]').textContent = `${el.value}×`; },
    onChange: (el) => {
      const role = el.dataset.role;
      if (role === 'goal') onSave({ goal: Number(el.value) });
      else if (role === 'theme') onSave({ theme: el.value });
      else if (role === 'font') onSave({ fontSize: el.value });
      else if (role === 'effects') onSave({ effects: el.checked });
      else if (role === 'rate') onSave({ voice: { ...state.voice, rate: Number(el.value) } });
      else if (el.dataset.voice) onSave({ voice: { ...state.voice, voices: { ...state.voice?.voices, [el.dataset.voice]: el.value } } });
      else if (role === 'reminder' || role === 'reminder-time') {
        onReminder({ on: root.querySelector('[data-role="reminder"]').checked, time: root.querySelector('[data-role="reminder-time"]').value || '20:00' });
      } else if (role === 'api-key' || role === 'model') {
        onSaveAi({ apiKey: root.querySelector('[data-role="api-key"]').value.trim(), model: root.querySelector('[data-role="model"]').value });
      }
    },
  });
}
