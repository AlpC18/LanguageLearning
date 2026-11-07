// Direct browser call to the Claude API with the learner's own key (stored only in this browser).
export const CHAT_MODELS = { 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-haiku-4-5-20251001': 'Claude Haiku 4.5 (cheaper)' };
const KEY = 'dilbaz:ai';

export function loadAi() {
  try {
    return { apiKey: '', model: 'claude-sonnet-5-5', ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { apiKey: '', model: 'claude-sonnet-5-5' };
  }
}

export function saveAi(ai) {
  try { localStorage.setItem(KEY, JSON.stringify(ai)); } catch { /* private mode: key lives for this session only */ }
}

export function tutorPrompt({ language, level, explain }) {
  return `You are a friendly ${language} conversation partner for a learner at CEFR level ${level}. `
    + `Reply ONLY in ${language}, in 1–3 short sentences suited to ${level}, and keep the conversation going with a question. `
    + `If the learner's last message contains mistakes, begin your reply with a line starting with "✏️ " that gives the corrected sentence `
    + `and a very short explanation in ${explain}. Never switch the conversation language.`;
}

export async function sendChat({ apiKey, model, system, messages }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 600, system, messages }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}
