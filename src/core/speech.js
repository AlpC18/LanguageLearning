import { t } from '../i18n.js';
import { audioKey, normalizeSpeech } from './audio-key.js';

// Text-to-speech and speech recognition via the browser's built-in Web Speech API (free, no keys).
const LOCALES = { de: 'de-DE', it: 'it-IT', es: 'es-ES' };
export const VOICE_SAMPLE = { de: 'Guten Tag! Wie geht es dir?', it: 'Buongiorno! Come stai?', es: '¡Buenos días! ¿Cómo estás?' };
let prefs = { rate: 1, voices: {} };
export const setVoicePrefs = (p) => { prefs = { rate: 1, voices: {}, ...p }; };

// Installed voices for a course language (for the settings screen).
export const voicesFor = (lang) =>
  ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter((v) => v.lang.replace('_', '-').startsWith(LOCALES[lang].slice(0, 2)));

const Recognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = () => Boolean(Recognition());

// Pre-generated natural clips (scripts/build-audio.mjs) are used when present; otherwise the device voice speaks.
// Choosing a specific device voice in Settings ('device' or a voiceURI) always uses the device voice.
const clipIndex = {};
export const loadClips = (lang) =>
  (clipIndex[lang] ??= fetch(`audio/${lang}.json`).then((r) => (r.ok ? r.json() : [])).then((keys) => new Set(keys)).catch(() => new Set()));

let playing = null;
let request = 0;
let finish = () => {}; // resolves the promise of the speech currently playing

function stopAll() {
  request += 1;
  playing?.pause();
  playing = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  finish();
}

function deviceSpeak(text, lang, slow, done) {
  if (!('speechSynthesis' in window)) return done();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCALES[lang];
  const all = speechSynthesis.getVoices();
  const voice = all.find((v) => v.voiceURI === prefs.voices[lang]) ?? all.find((v) => v.lang.replace('_', '-').startsWith(LOCALES[lang]));
  if (voice) utterance.voice = voice;
  utterance.rate = prefs.rate * (slow ? 0.65 : 0.95);
  utterance.onend = done;
  utterance.onerror = done;
  return speechSynthesis.speak(utterance);
}

// Plays clips one after another (a passage is a list of sentences); falls back to the device voice on any error.
function playClips(keys, lang, slow, fallbackText, id, done) {
  const [key, ...rest] = keys;
  if (id !== request) return undefined;
  if (!key) return done();
  const audio = new Audio(`audio/${lang}/${key}.mp3`);
  audio.playbackRate = prefs.rate * (slow ? 0.7 : 1);
  audio.onended = () => playClips(rest, lang, slow, fallbackText, id, done);
  playing = audio;
  return audio.play().catch(() => { if (id === request) deviceSpeak(fallbackText, lang, slow, done); });
}

// text: a string, or an array of sentences spoken in order. Resolves when speaking ends or is interrupted.
export async function speak(text, lang, { slow = false } = {}) {
  const parts = (Array.isArray(text) ? text : [text]).map(normalizeSpeech).filter(Boolean);
  stopAll();
  const id = request;
  const ended = new Promise((resolve) => { finish = resolve; });
  const done = () => { if (id === request) finish(); };
  const joined = parts.join(' ');
  if (!prefs.voices[lang]) {
    const clips = await loadClips(lang);
    const keys = parts.map(audioKey);
    if (id !== request) return ended;
    if (keys.length && keys.every((k) => clips.has(k))) {
      playClips(keys, lang, slow, joined, id, done);
      return ended;
    }
  }
  deviceSpeak(joined, lang, slow, done);
  return ended;
}

export const stopSpeaking = () => stopAll();

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
