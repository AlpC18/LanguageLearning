import { t } from '../i18n.js';

// Text-to-speech and speech recognition via the browser's built-in Web Speech API (free, no keys).
const LOCALES = { de: 'de-DE', it: 'it-IT', es: 'es-ES' };
let prefs = { rate: 1, voices: {} };
export const setVoicePrefs = (p) => { prefs = { rate: 1, voices: {}, ...p }; };

// Installed voices for a course language (for the settings screen).
export const voicesFor = (lang) =>
  ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter((v) => v.lang.replace('_', '-').startsWith(LOCALES[lang].slice(0, 2)));

const Recognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = () => Boolean(Recognition());

export function speak(text, lang, { slow = false } = {}) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCALES[lang];
  const all = speechSynthesis.getVoices();
  const voice = all.find((v) => v.voiceURI === prefs.voices[lang]) ?? all.find((v) => v.lang.replace('_', '-').startsWith(LOCALES[lang]));
  if (voice) utterance.voice = voice;
  utterance.rate = prefs.rate * (slow ? 0.65 : 0.95);
  speechSynthesis.speak(utterance);
}

const KNOWN_ERRORS = new Set(['not-allowed', 'no-speech', 'network', 'audio-capture']);

// Resolves with candidate transcripts (best first); rejects with a localized, user-facing message.
export function listen(lang) {
  return new Promise((resolve, reject) => {
    const R = Recognition();
    if (!R) return reject(new Error(t('speech.unsupported')));
    const rec = new R();
    rec.lang = LOCALES[lang];
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.onresult = (e) => resolve([...e.results[0]].map((a) => a.transcript));
    rec.onerror = (e) => reject(new Error(KNOWN_ERRORS.has(e.error) ? t(`speech.${e.error}`) : t('speech.other', { error: e.error })));
    rec.onend = () => resolve([]);
    rec.start();
  });
}
