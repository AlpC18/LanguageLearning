// Runs every sentence and reading text through a local LanguageTool server and lists what it flags.
// Setup (once, ≈390 MB in .tools/): download https://languagetool.org/download/LanguageTool-stable.zip and unzip into .tools/
// Start:  java -cp .tools/LanguageTool-*/languagetool-server.jar org.languagetool.server.HTTPServer --port 8081
// Run:    node scripts/grammar-check.mjs [de|it|es]
// LanguageTool is a strong second opinion, not an oracle: review each hit before changing content.
const SERVER = process.env.LT_URL ?? 'http://localhost:8081/v2/check';
const LT_LANG = { de: 'de-DE', it: 'it', es: 'es' };
// Style/noise rules that don't indicate errors in short textbook sentences.
const IGNORED = new Set(['WHITESPACE_RULE', 'UPPERCASE_SENTENCE_START', 'DOUBLE_PUNCTUATION', 'PUNCTUATION_PARAGRAPH_END',
  'DE_CASE', 'TOO_LONG_SENTENCE', 'EN_QUOTES', 'TYPOGRAFISCHE_ANFUEHRUNGSZEICHEN', 'GERMAN_WORD_REPEAT_BEGINNING_RULE',
  'ITALIAN_WORD_REPEAT_RULE', 'SPANISH_WORD_REPEAT_BEGINNING_RULE', 'DE_SENTENCE_WHITESPACE', 'PASSIVE_VOICE']);

async function check(text, lang) {
  const body = new URLSearchParams({ text, language: LT_LANG[lang], level: 'picky' });
  const res = await fetch(SERVER, { method: 'POST', body });
  if (!res.ok) throw new Error(`LanguageTool HTTP ${res.status}`);
  const { matches } = await res.json();
  return matches.filter((m) => !IGNORED.has(m.rule.id));
}

async function run(lang) {
  const { units } = (await import(`../src/data/${lang}.js`)).default;
  const readings = (await import(`../src/data/readings/${lang}.js`)).default;
  const items = [
    ...units.flatMap((u) => u.sentences.map(([s]) => ({ where: u.id, text: s }))),
    ...readings.map((r) => ({ where: r.id, text: r.text })),
  ];
  let hits = 0;
  for (let i = 0; i < items.length; i += 8) {
    const batch = items.slice(i, i + 8);
    const results = await Promise.all(batch.map((item) => check(item.text, lang)));
    batch.forEach((item, n) => {
      for (const m of results[n]) {
        hits += 1;
        const bad = item.text.slice(m.offset, m.offset + m.length);
        const fix = m.replacements.slice(0, 3).map((r) => r.value).join(' / ');
        console.log(`${item.where} | ${item.text.length > 120 ? `${item.text.slice(Math.max(0, m.offset - 40), m.offset + 60)}…` : item.text}\n    [${m.rule.id}] "${bad}" → ${fix || '?'} — ${m.message}`);
      }
    });
  }
  console.log(`${lang}: ${items.length} texts checked, ${hits} flags`);
}

const langs = process.argv.slice(2).filter((l) => LT_LANG[l]);
try {
  for (const lang of langs.length ? langs : Object.keys(LT_LANG)) await run(lang);
} catch (err) {
  console.error(`${err.message}\nIs the LanguageTool server running? See the header of scripts/grammar-check.mjs.`);
  process.exitCode = 1;
}
