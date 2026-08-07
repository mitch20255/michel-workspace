import type { DocStyle, Scene, VideoConfig, VideoProvider } from "../types";

/** Catalogue des modèles de pointe, par fournisseur. */
export const VIDEO_MODELS: Record<
  VideoProvider,
  { id: string; label: string }[]
> = {
  replicate: [
    { id: "google/veo-3-fast", label: "Google Veo 3 Fast (rapide)" },
    { id: "google/veo-3", label: "Google Veo 3 (audio natif, top réalisme)" },
    { id: "kwaivgi/kling-v2.5-turbo-pro", label: "Kling v2.5 Turbo Pro" },
    { id: "minimax/hailuo-02", label: "MiniMax Hailuo 02" },
    { id: "luma/ray", label: "Luma Ray" },
    { id: "wan-video/wan-2.5-t2v-fast", label: "Wan 2.5 (texte→vidéo)" },
  ],
  openai: [
    { id: "sora-2", label: "Sora 2" },
    { id: "sora-2-pro", label: "Sora 2 Pro (qualité max)" },
  ],
  google: [
    { id: "veo-3.1-generate-preview", label: "Veo 3.1 (preview)" },
    { id: "veo-3.0-generate-preview", label: "Veo 3.0" },
    { id: "veo-3.0-fast-generate-preview", label: "Veo 3.0 Fast" },
  ],
};

export const PROVIDER_LABELS: Record<VideoProvider, string> = {
  replicate: "Replicate (Veo 3, Kling, Luma…)",
  openai: "OpenAI Sora",
  google: "Google Veo (Gemini)",
};

export interface HealthInfo {
  ok: boolean;
  keys: Record<VideoProvider, boolean>;
}

export async function checkHealth(): Promise<HealthInfo | null> {
  try {
    const r = await fetch("/api/health");
    if (!r.ok) return null;
    return (await r.json()) as HealthInfo;
  } catch {
    return null;
  }
}

/** Construit le prompt vidéo pour une scène en tenant compte du style. */
export function videoPromptFor(scene: Scene, style: DocStyle): string {
  const hint =
    style === "realistic"
      ? "cinematic photorealistic documentary shot, natural motion, film grain, dramatic lighting, no text, no subtitles"
      : "stylized animated documentary shot, painterly motion, vibrant, no text, no subtitles";
  return `${scene.visualPrompt}. ${hint}`;
}

interface StartResponse {
  id?: string;
  error?: string;
}
interface JobStatus {
  status: "processing" | "succeeded" | "failed";
  progress: number;
  error: string | null;
  videoUrl: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Génère un clip pour une scène. Renvoie l'URL du clip (même origine).
 * `onProgress` reçoit une valeur 0–100. `signal` permet d'annuler.
 */
export async function generateClip(
  scene: Scene,
  style: DocStyle,
  cfg: VideoConfig,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey && cfg.apiKey.trim()) headers["x-provider-key"] = cfg.apiKey.trim();

  const startRes = await fetch("/api/generate", {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      prompt: videoPromptFor(scene, style),
      provider: cfg.provider,
      model: cfg.model,
      aspect: cfg.aspect,
      seconds: cfg.seconds,
    }),
  });
  const started = (await startRes.json()) as StartResponse;
  if (!startRes.ok || !started.id) {
    throw new Error(started.error || `Erreur ${startRes.status} au démarrage.`);
  }

  const jobId = started.id;
  // Sondage jusqu'à complétion.
  for (let i = 0; i < 300; i++) {
    if (signal?.aborted) throw new Error("Annulé.");
    await sleep(3000);
    const r = await fetch(`/api/jobs/${jobId}`, { signal });
    const j = (await r.json()) as JobStatus;
    onProgress(j.progress || 0);
    if (j.status === "succeeded" && j.videoUrl) return j.videoUrl;
    if (j.status === "failed") throw new Error(j.error || "Génération échouée.");
  }
  throw new Error("Délai dépassé.");
}
