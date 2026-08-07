import Anthropic from "@anthropic-ai/sdk";
import type { GenerateOptions, Production } from "../types";

/**
 * Schéma JSON imposé à la réponse du modèle via les "structured outputs".
 * Les contraintes non supportées (minItems, minLength, ...) sont volontairement
 * absentes — on les valide/normalise côté client.
 */
const PRODUCTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    expertSummary: {
      type: "string",
      description:
        "Sommaire de niveau expert en Markdown léger (titres ##, listes -, gras **). Dense, structuré, sans bavardage.",
    },
    keyPoints: {
      type: "array",
      items: { type: "string" },
      description: "5 à 8 points clés, un par entrée, concis.",
    },
    notes: {
      type: "string",
      description: "Nuances, limites ou pistes de vérification. Peut être court.",
    },
    documentary: {
      type: "object",
      additionalProperties: false,
      properties: {
        style: { type: "string", enum: ["realistic", "animated"] },
        totalDurationSec: { type: "number" },
        scenes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "integer" },
              heading: { type: "string" },
              narration: { type: "string" },
              onScreenText: { type: "string" },
              visualPrompt: {
                type: "string",
                description:
                  "Description visuelle riche en ANGLAIS pour un générateur d'images (sujet, cadrage, lumière, ambiance).",
              },
              palette: {
                type: "array",
                items: { type: "string" },
                description:
                  "3 couleurs hex (#rrggbb) qui capturent l'ambiance de la scène.",
              },
              mood: { type: "string" },
              durationSec: { type: "number" },
            },
            required: [
              "id",
              "heading",
              "narration",
              "onScreenText",
              "visualPrompt",
              "palette",
              "mood",
              "durationSec",
            ],
          },
        },
      },
      required: ["style", "totalDurationSec", "scenes"],
    },
  },
  required: [
    "title",
    "subtitle",
    "expertSummary",
    "keyPoints",
    "notes",
    "documentary",
  ],
} as const;

function buildPrompt(opts: GenerateOptions): string {
  const styleFr =
    opts.style === "realistic"
      ? "documentaire réaliste (prises de vues réelles, cinématique, sérieux)"
      : "documentaire animé (illustré, stylisé, dynamique)";

  const source =
    opts.mode === "topic"
      ? `Sujet demandé : « ${opts.input} »`
      : `Texte source à résumer et adapter :\n"""\n${opts.input}\n"""`;

  return `Tu es un producteur de documentaires et un analyste expert. À partir de l'entrée ci-dessous, tu dois produire DEUX livrables en un seul objet JSON.

${source}

1) UN SOMMAIRE NIVEAU EXPERT (champ "expertSummary") :
- En français, dense et rigoureux, comme pour un lecteur averti du domaine.
- Structuré en Markdown léger : quelques titres "## ", des listes "- ", du gras "**".
- Va au fond des choses : mécanismes, causes, enjeux, chiffres marquants, débats. Pas de généralités creuses.
- Ajoute 5 à 8 "keyPoints" (points clés) percutants.

2) UN SCÉNARIO DE MINI-DOCUMENTAIRE (champ "documentary"), style : ${styleFr} :
- ${opts.sceneCount} scènes environ, formant un récit complet et attirant : accroche → développement → point culminant → conclusion mémorable.
- Chaque scène a :
  - "narration" : la voix off en FRANÇAIS, 2 à 4 phrases, ton captivant et clair.
  - "heading" : un titre court de chapitre.
  - "onScreenText" : 1 à 4 mots d'accroche affichés à l'écran.
  - "visualPrompt" : une description visuelle riche en ANGLAIS pour un générateur d'images (sujet précis, cadrage, lumière, ambiance) cohérente avec le style ${opts.style === "realistic" ? "photoréaliste, cinématique" : "illustration animée, stylisée"}.
  - "palette" : 3 couleurs hex évoquant l'ambiance.
  - "mood" : l'ambiance en un mot.
  - "durationSec" : durée cible (8 à 16 s), cohérente avec la longueur de la narration.
- "style" doit valoir "${opts.style}". "totalDurationSec" = somme des durées.

Écris pour émouvoir et instruire. Reste factuel et honnête ; nuance dans "notes".`;
}

/** Normalise/complète les données pour éviter les surprises côté lecteur. */
function normalize(p: Production, style: GenerateOptions["style"]): Production {
  const scenes = (p.documentary?.scenes ?? []).map((s, i) => {
    const words = (s.narration ?? "").trim().split(/\s+/).filter(Boolean).length;
    // ~2,3 mots/seconde de narration + un peu de respiration.
    const estimated = Math.max(6, Math.round(words / 2.3) + 2);
    const duration =
      Number.isFinite(s.durationSec) && s.durationSec > 3
        ? Math.round(s.durationSec)
        : estimated;
    const palette =
      Array.isArray(s.palette) && s.palette.filter((c) => /^#/.test(c)).length >= 2
        ? s.palette.filter((c) => /^#/.test(c)).slice(0, 3)
        : ["#1b2a4a", "#c2703d", "#f4f1ea"];
    while (palette.length < 3) palette.push(palette[palette.length - 1]);
    return {
      ...s,
      id: Number.isFinite(s.id) ? s.id : i + 1,
      heading: s.heading || `Chapitre ${i + 1}`,
      onScreenText: s.onScreenText || "",
      mood: s.mood || "neutre",
      palette,
      durationSec: Math.min(24, duration),
    };
  });

  const totalDurationSec = scenes.reduce((a, s) => a + s.durationSec, 0);

  return {
    title: p.title || "Documentaire",
    subtitle: p.subtitle || "",
    expertSummary: p.expertSummary || "",
    keyPoints: Array.isArray(p.keyPoints) ? p.keyPoints : [],
    notes: p.notes || "",
    documentary: {
      style: (p.documentary?.style as Production["documentary"]["style"]) || style,
      totalDurationSec,
      scenes,
    },
  };
}

/** Appelle l'API Claude et renvoie une production normalisée. */
export async function generateProduction(
  opts: GenerateOptions,
): Promise<Production> {
  const client = new Anthropic({
    apiKey: opts.apiKey,
    dangerouslyAllowBrowser: true,
  });

  // `output_config` (structured outputs + effort) is a recent API addition ;
  // on le passe en clair et on caste pour rester compatible avec les typages
  // du SDK selon la version installée.
  const params = {
    model: opts.model,
    max_tokens: 16000,
    output_config: {
      effort: "medium",
      format: {
        type: "json_schema",
        schema: PRODUCTION_SCHEMA,
      },
    },
    messages: [{ role: "user", content: buildPrompt(opts) }],
  };

  const response = (await client.messages.create(
    params as unknown as Anthropic.MessageCreateParamsNonStreaming,
  )) as Anthropic.Message;

  if (response.stop_reason === "refusal") {
    throw new Error(
      "La requête a été refusée par les filtres du modèle. Reformulez le sujet.",
    );
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse vide du modèle.");
  }

  let parsed: Production;
  try {
    parsed = JSON.parse(textBlock.text) as Production;
  } catch {
    throw new Error("Le modèle n'a pas renvoyé de JSON valide.");
  }

  return normalize(parsed, opts.style);
}
