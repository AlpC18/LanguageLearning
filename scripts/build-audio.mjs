// Pre-generates natural (Piper neural TTS) audio for everything the app speaks from its built-in data.
// Run: npm run audio            (all languages; only missing clips are generated, so re-runs are cheap)
//      npm run audio -- de      (one language)
// One-time setup (≈230 MB, kept out of git in .tools/):
//   python3 -m venv .tools/venv && .tools/venv/bin/pip install piper-tts
//   voices from https://huggingface.co/rhasspy/piper-voices → .tools/voices/<name>.onnx(+.json), names below.
import { existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { audioKey, normalizeSpeech } from '../src/core/audio-key.js';
import { tokens } from '../src/core/text.js';
import { PRONOUNS } from '../src/core/conjugation.js';
import { VOICE_SAMPLE } from '../src/core/speech.js';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const VOICES = { de: 'de_DE-thorsten-medium', it: 'it_IT-paola-medium', es: 'es_ES-davefx-medium' };
const PYTHON = join(ROOT, '.tools/venv/bin/python');

// Every text the app can speak for a language without AI: words, sentences, sentence tiles, verb forms, readings.
async function textsFor(lang) {
  const course = (await import(`../src/data/${lang}.js`)).default;
  const verbs = (await import(`../src/data/verbs/${lang}.js`)).default;
  const readings = (await import(`../src/data/readings/${lang}.js`)).default;
  const texts = [VOICE_SAMPLE[lang]];
  for (const unit of course.units) {
    for (const [word] of unit.words) texts.push(word, ...word.split(/\s+/));
    for (const [sentence] of unit.sentences) texts.push(sentence, ...tokens(sentence));
  }
  for (const v of verbs) texts.push(v.verb, ...v.present, ...v.present.map((form, i) => `${PRONOUNS[lang][i]} ${form}`));
  for (const r of readings) texts.push(r.text);
  return [...new Set(texts.map(normalizeSpeech).filter((s) => /\p{L}/u.test(s)))];
}

async function build(lang) {
  const voice = join(ROOT, '.tools/voices', `${VOICES[lang]}.onnx`);
  if (!existsSync(PYTHON) || !existsSync(voice)) throw new Error(`Missing Piper setup for ${lang} — see the header of scripts/build-audio.mjs`);
  const dir = join(ROOT, 'audio', lang);
  mkdirSync(dir, { recursive: true });
  const texts = await textsFor(lang);
  const wanted = new Map(texts.map((text) => [audioKey(text), text]));
  const jobs = [...wanted].filter(([key]) => !existsSync(join(dir, `${key}.mp3`))).map(([key, text]) => ({ text, out: join(dir, `${key}.mp3`) }));
  console.log(`${lang}: ${texts.length} texts, ${jobs.length} to generate`);
  if (jobs.length) {
    const jobFile = join(tmpdir(), `dilbaz-audio-${lang}.json`);
    writeFileSync(jobFile, JSON.stringify(jobs));
    const run = spawnSync(PYTHON, [join(ROOT, 'scripts/piper_batch.py'), voice, jobFile], { stdio: 'inherit' });
    rmSync(jobFile, { force: true });
    if (run.status !== 0) throw new Error(`Piper failed for ${lang}`);
  }
  // Drop clips whose text no longer exists, then publish the index the app reads.
  for (const file of readdirSync(dir)) if (!wanted.has(file.replace('.mp3', ''))) rmSync(join(dir, file));
  const available = [...wanted.keys()].filter((key) => existsSync(join(dir, `${key}.mp3`))).sort();
  writeFileSync(join(ROOT, 'audio', `${lang}.json`), JSON.stringify(available));
  console.log(`${lang}: ${available.length} clips ready`);
}

const langs = process.argv.slice(2).filter((a) => VOICES[a]);
for (const lang of langs.length ? langs : Object.keys(VOICES)) await build(lang);
