import type { Production } from "../types";

/** Production pré-générée pour le mode démo (aucune clé API requise). */
export const DEMO_PRODUCTION: Production = {
  title: "Les Trous Noirs",
  subtitle: "Là où l'espace, le temps et la lumière capitulent",
  expertSummary: `## Qu'est-ce qu'un trou noir ?

Un **trou noir** est une région de l'espace-temps où la gravité est si intense que **rien**, pas même la lumière, ne peut s'en échapper une fois franchi l'**horizon des événements**. Ce n'est pas un « trou » au sens littéral, mais une concentration extrême de masse dans un volume minuscule.

## Anatomie

- **Singularité** : point central de densité théoriquement infinie où les lois connues de la physique cessent de s'appliquer.
- **Horizon des événements** : frontière de non-retour ; son rayon (rayon de Schwarzschild) est proportionnel à la masse.
- **Disque d'accrétion** : matière en spirale, chauffée à des millions de degrés, qui émet un rayonnement intense — c'est souvent ce que l'on « voit ».

## Comment se forment-ils ?

Les trous noirs **stellaires** naissent de l'effondrement gravitationnel d'étoiles massives en fin de vie (supernova). Les trous noirs **supermassifs**, millions à milliards de fois la masse du Soleil, siègent au cœur des galaxies — dont **Sagittarius A*** au centre de la Voie lactée.

## Pourquoi ils comptent

- Ils déforment le temps : près de l'horizon, le temps s'écoule plus lentement (**dilatation temporelle**).
- Leur observation directe (image de M87* par l'**Event Horizon Telescope**, 2019) et la détection d'**ondes gravitationnelles** (LIGO, 2015) ont confirmé la relativité générale d'Einstein dans des régimes extrêmes.`,
  keyPoints: [
    "Un trou noir piège la lumière au-delà de l'horizon des événements.",
    "La singularité concentre une masse énorme dans un volume quasi nul.",
    "Trous noirs stellaires (effondrement d'étoiles) vs supermassifs (cœurs de galaxies).",
    "Le temps ralentit à l'approche de l'horizon : dilatation temporelle.",
    "Première image directe en 2019 par l'Event Horizon Telescope (M87*).",
    "Les ondes gravitationnelles (LIGO, 2015) ont confirmé leur existence.",
  ],
  notes:
    "La singularité reste une prédiction mathématique ; une théorie de gravité quantique manque encore pour la décrire. Les chiffres varient selon les modèles.",
  documentary: {
    style: "realistic",
    totalDurationSec: 66,
    scenes: [
      {
        id: 1,
        heading: "Une porte dans le cosmos",
        narration:
          "Dans le silence infini de l'univers se cachent les objets les plus extrêmes jamais imaginés. Ni tout à fait vides, ni tout à fait pleins. Des lieux où même la lumière renonce à fuir.",
        onScreenText: "L'inévitable",
        visualPrompt:
          "Cinematic deep space, a vast starfield with a subtle gravitational lensing distortion forming, dark and majestic, ultra realistic, volumetric light",
        palette: ["#05060f", "#1b2a4a", "#8899cc"],
        mood: "mystérieux",
        durationSec: 12,
      },
      {
        id: 2,
        heading: "L'horizon des événements",
        narration:
          "Approchez-vous. Voici l'horizon des événements : la frontière de non-retour. Franchissez-la, et l'univers extérieur disparaît pour toujours. Le temps lui-même s'y étire.",
        onScreenText: "Point de non-retour",
        visualPrompt:
          "Extreme close cinematic view of a black hole event horizon, glowing orange accretion disk bending around a perfect black sphere, photorealistic, Interstellar style",
        palette: ["#0a0a12", "#c2703d", "#ffcf87"],
        mood: "sublime",
        durationSec: 13,
      },
      {
        id: 3,
        heading: "La naissance d'un monstre",
        narration:
          "Tout commence par une étoile géante. À court de carburant, elle s'effondre sur elle-même en une fraction de seconde, puis explose en supernova. Ce qui reste : un point sans dimension, d'une densité inconcevable.",
        onScreenText: "Effondrement",
        visualPrompt:
          "A massive star collapsing and exploding into a supernova, brilliant shockwave, cinematic, realistic astrophysics visualization, dramatic light",
        palette: ["#1a0b2e", "#e0563b", "#ffd97d"],
        mood: "dramatique",
        durationSec: 13,
      },
      {
        id: 4,
        heading: "Les géants endormis",
        narration:
          "Au cœur de chaque galaxie sommeille un colosse : un trou noir supermassif, des millions de fois la masse du Soleil. Le nôtre s'appelle Sagittaire A étoile, tapi au centre de la Voie lactée.",
        onScreenText: "Sagittarius A*",
        visualPrompt:
          "The center of the Milky Way galaxy, dense golden star clusters swirling around a bright supermassive black hole, cinematic realistic space photography",
        palette: ["#100a1f", "#c9922f", "#f4e2b8"],
        mood: "majestueux",
        durationSec: 13,
      },
      {
        id: 5,
        heading: "Voir l'invisible",
        narration:
          "Longtemps, ils ne furent qu'une équation. Puis, en deux mille dix-neuf, l'humanité a photographié l'ombre d'un trou noir. Une preuve. Un souvenir de notre insatiable curiosité.",
        onScreenText: "2019 : la preuve",
        visualPrompt:
          "The first real image of a black hole, glowing orange ring on black background, Event Horizon Telescope style, hopeful and awe-inspiring, realistic",
        palette: ["#0b0b0b", "#d97b2b", "#ffe6a8"],
        mood: "inspirant",
        durationSec: 15,
      },
    ],
  },
};
