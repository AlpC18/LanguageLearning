// AI teacher tools: each asks Claude for strict JSON so the app can render it as interactive UI.
import { sendChat } from './chat-api.js';

export const LANGUAGE_NAMES = { de: 'German', it: 'Italian', es: 'Spanish' };
export const FOCUSES = ['grammar', 'speaking', 'listening'];
export const MAX_CARDS = 20;

// Pulls the first {...} block out of a reply (models sometimes wrap JSON in prose or code fences).
export function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON in reply');
  return JSON.parse(text.slice(start, end + 1));
}

const base = ({ lang, level, explain }) =>
  `You are an expert ${LANGUAGE_NAMES[lang]} teacher. The learner is at CEFR level ${level}. `
  + `Write all explanations in ${explain}; write all ${LANGUAGE_NAMES[lang]} examples correctly and naturally. `
  + 'Reply with ONLY one JSON object, no prose before or after it.';

export const PROMPTS = {
  lesson: ({ focus, topic, ...ctx }) => ({
    system: base(ctx),
    user: `Prepare a 30-minute lesson focused on ${focus}${topic ? ` about "${topic}"` : ''}. JSON shape: `
      + '{"title": string, "sections": [{"heading": string, "body": string, "examples": [{"target": string, "meaning": string}]}], '
      + '"exercises": [{"task": string, "answer": string}], "quiz": [{"q": string, "options": [string, string, string, string], "answer": 0-3}]}. '
      + `4–6 sections (for listening, include short ${LANGUAGE_NAMES[ctx.lang]} passages in examples to be read aloud), 4–6 exercises, exactly 5 quiz questions.`,
  }),
  cards: ({ words, ...ctx }) => ({
    system: base(ctx),
    user: `Turn these words into flashcards: ${words.join(', ')}. JSON shape: {"cards": [{"word": string (with article if a noun), `
      + '"tr": string (Turkish meaning), "en": string (English meaning), "example": string, "exampleMeaning": string, "tip": string (a simple memory trick)}]}. '
      + 'One card per word, in the same order; keep examples beginner-friendly.',
  }),
  grammar: ({ rule, ...ctx }) => ({
    system: base(ctx),
    user: `Explain this grammar rule: "${rule}". JSON shape: {"title": string, "explanation": string, `
      + '"examples": [{"target": string, "meaning": string}], "mistakes": [{"wrong": string, "right": string, "why": string}]}. '
      + 'Use 4–6 simple examples and exactly the 3 most common learner mistakes.',
  }),
};

export async function askTutor(kind, ai, params) {
  const { system, user } = PROMPTS[kind](params);
  const reply = await sendChat({ apiKey: ai.apiKey, model: ai.model, system, messages: [{ role: 'user', content: user }], maxTokens: 4000 });
  return extractJson(reply);
}
