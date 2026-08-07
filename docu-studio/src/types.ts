export type DocStyle = "realistic" | "animated";

export type InputMode = "topic" | "text";

export interface Scene {
  id: number;
  /** Titre / bas de vignette affiché à l'écran pour la scène. */
  heading: string;
  /** Narration parlée (voix off), en français. */
  narration: string;
  /** Courte accroche / mot-clé affiché en superposition. */
  onScreenText: string;
  /** Description visuelle utilisée pour générer l'image de la scène. */
  visualPrompt: string;
  /** Palette de couleurs (hex) pour le fond procédural de secours. */
  palette: string[];
  /** Ambiance de la scène (mysterious, hopeful, tense, ...). */
  mood: string;
  /** Durée cible de la scène en secondes. */
  durationSec: number;
}

export interface Documentary {
  style: DocStyle;
  totalDurationSec: number;
  scenes: Scene[];
}

export interface Production {
  title: string;
  subtitle: string;
  /** Sommaire niveau expert, en Markdown léger. */
  expertSummary: string;
  keyPoints: string[];
  documentary: Documentary;
  /** Notes / sources éventuelles. */
  notes: string;
}

export interface GenerateOptions {
  mode: InputMode;
  input: string;
  style: DocStyle;
  model: string;
  sceneCount: number;
  apiKey: string;
}

export type VideoProvider = "replicate" | "openai" | "google";
export type AspectRatio = "16:9" | "9:16" | "1:1";

export interface VideoConfig {
  provider: VideoProvider;
  model: string;
  aspect: AspectRatio;
  seconds: number;
  /** Clé du fournisseur (facultatif — sinon le serveur lit ses variables d'env). */
  apiKey?: string;
}

/** sceneId -> URL du clip vidéo généré (servie par le backend, même origine). */
export type ClipMap = Record<number, string>;
