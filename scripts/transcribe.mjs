// Local pronunciation analysis with whisper.cpp, used by scripts/serve.mjs (POST /api/transcribe?lang=de).
// Setup: brew install whisper-cpp, then download ggml-small-q5_1.bin from
// https://huggingface.co/ggerganov/whisper.cpp into .tools/whisper/.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const run = promisify(execFile);
const MODEL = join(new URL('..', import.meta.url).pathname, '.tools/whisper/ggml-small-q5_1.bin');
const LANGS = new Set(['de', 'it', 'es']);
export const MAX_AUDIO_BYTES = 3 * 1024 * 1024; // ~1 minute of compressed speech is plenty for one sentence

let available;
export async function whisperAvailable() {
  available ??= existsSync(MODEL) && run('whisper-cli', ['--help']).then(() => true, () => false);
  return available;
}

// Whisper tokens → words. A token starting with a space opens a new word; the word's confidence is its weakest token.
export function tokensToWords(tokens) {
  const words = [];
  for (const { text, p } of tokens) {
    if (/^\s*\[_?[A-Z_]+/.test(text) || !text.trim()) continue; // [_BEG_], [_TT_123] …
    if (/^\s/.test(text) || !words.length) words.push({ word: text.trim(), p });
    else {
      const last = words.at(-1);
      words[words.length - 1] = { word: last.word + text, p: Math.min(last.p, p) };
    }
  }
  return words.map((w) => ({ word: w.word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''), p: Math.round(w.p * 100) / 100 })).filter((w) => w.word);
}

// audio: any format ffmpeg reads (webm/opus from Chrome, mp4/aac from Safari). Returns { text, words: [{ word, p }] }.
export async function transcribe(audio, lang) {
  if (!LANGS.has(lang)) throw new Error('unsupported language');
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) throw new Error('bad audio size');
  const dir = await mkdtemp(join(tmpdir(), 'dilbaz-stt-'));
  try {
    await writeFile(join(dir, 'in'), audio);
    await run('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(dir, 'in'), '-ar', '16000', '-ac', '1', join(dir, 'in.wav')]);
    // No prompt with the expected sentence on purpose: biasing Whisper would hide real pronunciation mistakes.
    await run('whisper-cli', ['-m', MODEL, '-l', lang, '-f', join(dir, 'in.wav'), '-ojf', '-of', join(dir, 'out'), '-np', '-nt'], { timeout: 30000 });
    const segments = JSON.parse(await readFile(join(dir, 'out.json'), 'utf8')).transcription ?? [];
    return {
      text: segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim(),
      words: tokensToWords(segments.flatMap((s) => s.tokens ?? [])),
    };
  } catch (err) {
    console.error('transcribe failed:', err.message); // details stay in the server log, the client gets a generic message
    throw new Error('could not process audio');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
