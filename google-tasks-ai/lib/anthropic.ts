import Anthropic from "@anthropic-ai/sdk";
import { Priority } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

export interface ParsedTask {
  title: string;
  due: string | null;
  notes: string;
}

export async function parseTaskFromText(text: string, nowIso: string): Promise<ParsedTask> {
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system:
      "Tu transformes une phrase en langage naturel en une tâche structurée pour Google Tasks. " +
      "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format: " +
      '{"title": string, "due": string|null, "notes": string}. ' +
      "Le titre doit être court et actionnable. " +
      "'due' doit être une date ISO 8601 (ex: 2026-06-30T00:00:00.000Z) si une échéance est mentionnée ou déductible, sinon null. " +
      "'notes' contient les détails additionnels non inclus dans le titre, ou une chaîne vide.",
    messages: [
      {
        role: "user",
        content: `Date et heure actuelles: ${nowIso}\n\nPhrase à transformer: ${text}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse IA vide");
  }
  const parsed = extractJson(textBlock.text) as Partial<ParsedTask>;
  return {
    title: parsed.title?.trim() || text.trim(),
    due: parsed.due ?? null,
    notes: parsed.notes ?? "",
  };
}

export interface TaskForPrioritization {
  id: string;
  title: string;
  notes: string;
  due: string | null;
}

export interface PrioritizationResult {
  id: string;
  priority: Priority;
  estimatedMinutes: number;
  reason: string;
}

export async function prioritizeTasks(
  tasks: TaskForPrioritization[],
  nowIso: string
): Promise<PrioritizationResult[]> {
  if (tasks.length === 0) return [];
  const client = getClient();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system:
      "Tu es un assistant de gestion de tâches. Pour chaque tâche fournie, détermine une priorité " +
      "(P1 = critique/urgent, P2 = haute, P3 = moyenne, P4 = basse), une estimation de durée en minutes " +
      "pour la réaliser (multiple de 15, entre 15 et 240), et une courte raison (max 15 mots, en français). " +
      "Tiens compte de la date d'échéance (plus proche = plus urgent) et du contenu du titre/notes. " +
      "Réponds UNIQUEMENT avec un tableau JSON, sans texte autour, au format: " +
      '[{"id": string, "priority": "P1"|"P2"|"P3"|"P4", "estimatedMinutes": number, "reason": string}]',
    messages: [
      {
        role: "user",
        content: `Date et heure actuelles: ${nowIso}\n\nTâches:\n${JSON.stringify(tasks, null, 2)}`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse IA vide");
  }
  const parsed = extractJson(textBlock.text) as PrioritizationResult[];
  return parsed;
}
