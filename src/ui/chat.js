import { esc } from '../core/text.js';
import { speak, listen, canListen } from '../core/speech.js';
import { t, locale } from '../i18n.js';
import { LEVELS } from '../components/search-filter.js';
import { sendChat, tutorPrompt } from '../core/chat-api.js';
import { renderPage } from './page.js';

const NAMES = { de: 'German', it: 'Italian', es: 'Spanish' };

// Conversation lives only in memory for this visit; nothing is sent anywhere except the Claude API.
export function renderChat(root, { lang, ai, defaultLevel, onBack }) {
  let messages = [];
  let level = defaultLevel;
  let topic = '';
  let busy = false;
  const ready = Boolean(ai.apiKey);

  renderPage(root, {
    title: t('chat.title'), onBack,
    body: ready ? `<div class="chat-bar"><label>${t('chat.level')}
          <select data-role="level">${LEVELS.map((l) => `<option ${l === level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <input data-role="topic" placeholder="${t('chat.topic')}" autocomplete="off"></div>
        <ol class="chat-log" aria-live="polite"><li class="muted">${t('chat.start')}</li></ol>
        <form class="chat-form" data-role="form">
          <input name="msg" lang="${lang}" placeholder="${t('chat.placeholder')}" autocomplete="off" required>
          ${canListen() ? '<button class="icon big" type="button" data-act="mic" aria-label="mic">🎤</button>' : ''}
          <button class="btn primary" type="submit">${t('chat.send')}</button>
        </form>` : `<section class="card"><p>${t('chat.needKey')}</p></section>`,
    onClick: async (el, d) => {
      if (d.say) speak(d.say, lang);
      if (d.act === 'mic') {
        try {
          const [best] = await listen(lang);
          if (best) root.querySelector('[name="msg"]').value = best;
        } catch (err) {
          append('error', err.message);
        }
      }
    },
    onChange: (el) => {
      if (el.matches('[data-role="level"]')) { level = el.value; messages = []; }
      if (el.matches('[data-role="topic"]')) { topic = el.value.trim(); messages = []; } // new topic → fresh conversation
    },
  });
  if (!ready) return;

  const log = root.querySelector('.chat-log');
  function append(role, text) {
    const li = document.createElement('li');
    li.className = `msg ${role}`;
    li.innerHTML = role === 'assistant'
      ? `${esc(text).replace(/\n/g, '<br>')} <button class="icon" data-say="${esc(text.replace(/^✏️.*$/m, '').trim())}" aria-label="${t('listen')}">🔊</button>`
      : esc(text);
    log.append(li);
    li.scrollIntoView({ block: 'end' });
    return li;
  }

  root.querySelector('[data-role="form"]').onsubmit = async (e) => {
    e.preventDefault();
    const input = e.target.elements.msg;
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    input.value = '';
    append('user', text);
    messages = [...messages, { role: 'user', content: text }];
    const pending = append('pending', t('chat.thinking'));
    try {
      const system = tutorPrompt({ language: NAMES[lang], level, topic, explain: locale() === 'en' ? 'English' : 'Turkish' });
      const reply = await sendChat({ apiKey: ai.apiKey, model: ai.model, system, messages });
      pending.remove();
      messages = [...messages, { role: 'assistant', content: reply }];
      append('assistant', reply);
      speak(reply.replace(/^✏️.*$/m, '').trim(), lang);
    } catch (err) {
      pending.remove();
      messages = messages.slice(0, -1); // let the learner resend
      append('error', t('chat.error', { msg: err.message }));
    } finally {
      busy = false;
    }
  };
}
