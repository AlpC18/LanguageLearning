// Speaking practice helpers: record the learner (for "listen to yourself") and, when the app is served by
// scripts/serve.mjs with whisper.cpp installed, analyse the recording locally for a word-by-word score.
const MAX_RECORDING_MS = 10000;
export const UNCLEAR_BELOW = 0.6; // Whisper word confidence under this is shown as "unclear pronunciation"

let whisper;
let whisperOk = false;
export const whisperReady = () =>
  (whisper ??= fetch('api/health').then((r) => (r.ok ? r.json() : {})).then((d) => (whisperOk = Boolean(d.whisper))).catch(() => false));
export const whisperKnown = () => whisperOk; // sync answer once whisperReady() has resolved (warmed up on the home screen)

export const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

// Starts recording; stop() resolves with the audio Blob. Stops by itself after MAX_RECORDING_MS.
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
  });
  recorder.start();
  const timer = setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), MAX_RECORDING_MS);
  const stop = () => {
    clearTimeout(timer);
    if (recorder.state !== 'inactive') recorder.stop();
    return done;
  };
  return { stop, done };
}

// → { text, words: [{ word, p }] }; throws a plain Error on failure.
export async function transcribe(blob, lang) {
  const res = await fetch(`api/transcribe?lang=${encodeURIComponent(lang)}`, { method: 'POST', body: blob });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return { text: String(data.text ?? ''), words: Array.isArray(data.words) ? data.words : [] };
}

// Marks each expected word: ok (heard), unclear (heard but with low confidence), or missed.
export function wordFeedback(diff, words = []) {
  const confidence = new Map(words.map((w) => [w.word.toLocaleLowerCase(), w.p]));
  return diff.map(({ word, ok }) => {
    const p = confidence.get(word.replace(/[^\p{L}\p{N}'’-]/gu, '').toLocaleLowerCase());
    return { word, status: !ok ? 'missed' : p !== undefined && p < UNCLEAR_BELOW ? 'unclear' : 'ok' };
  });
}
