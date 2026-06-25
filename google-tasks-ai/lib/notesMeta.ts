import { Priority } from "./types";

const META_RE = /^<!--meta:(\{.*?\})-->\n?/;

export function decodeNotes(raw: string | undefined | null): {
  notes: string;
  priority: Priority | null;
  estimatedMinutes: number | null;
} {
  if (!raw) return { notes: "", priority: null, estimatedMinutes: null };
  const match = raw.match(META_RE);
  if (!match) return { notes: raw, priority: null, estimatedMinutes: null };
  let priority: Priority | null = null;
  let estimatedMinutes: number | null = null;
  try {
    const meta = JSON.parse(match[1]);
    priority = meta.priority ?? null;
    estimatedMinutes = meta.estimatedMinutes ?? null;
  } catch {
    // ignore malformed meta, treat rest as plain notes
  }
  return { notes: raw.slice(match[0].length), priority, estimatedMinutes };
}

export function encodeNotes(
  notes: string,
  priority: Priority | null,
  estimatedMinutes: number | null
): string {
  if (!priority && !estimatedMinutes) return notes;
  const meta = JSON.stringify({
    priority: priority ?? undefined,
    estimatedMinutes: estimatedMinutes ?? undefined,
  });
  return `<!--meta:${meta}-->\n${notes}`;
}
