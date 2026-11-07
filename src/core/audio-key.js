// Maps a spoken text to its pre-generated clip name (audio/<lang>/<key>.mp3). Shared by the app and scripts/build-audio.mjs.
export const normalizeSpeech = (text) => String(text).normalize('NFC').replace(/\s+/g, ' ').trim();

// FNV-1a 32-bit — tiny, stable, and collisions are irrelevant at a few thousand clips per language.
export function audioKey(text) {
  let h = 0x811c9dc5;
  for (const ch of normalizeSpeech(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
