import Anthropic from '@anthropic-ai/sdk';

export const MODEL = process.env.CATEGORIZE_MODEL || 'claude-sonnet-4-6';

let client = null;
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY manquante dans .env — la catégorisation automatique est désactivée.');
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Réponse IA non-JSON: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}
