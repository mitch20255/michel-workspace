# Docu Studio 🎬

D'un **sujet** ou d'un **texte**, l'application génère un **sommaire de niveau expert**, puis met en scène un **mini-documentaire cinématique** (style **réaliste** ou **animé**) directement dans le navigateur : voix off, visuels par scène, sous-titres, musique d'ambiance et transitions.

## Ce que ça fait

1. **Entrée** — vous saisissez un sujet (« les trous noirs ») **ou** collez un texte à résumer.
2. **Sommaire expert** — l'API Claude produit un sommaire structuré (Markdown) + des points clés.
3. **Scénario** — le modèle écrit un mini-documentaire découpé en scènes : narration, accroches, descriptions visuelles, palette et durée.
4. **Lecteur cinématique** — un lecteur plein écran joue le documentaire :
   - **visuels par scène** générés à la volée (Pollinations, sans clé) avec un effet Ken Burns ; repli sur un dégradé procédural si l'image n'est pas disponible ;
   - **voix off française** via la synthèse vocale du navigateur ;
   - **musique d'ambiance** générée par la Web Audio API (aucun fichier externe) ;
   - **sous-titres**, titres de chapitre et barre de progression ;
   - commandes lecture/pause, précédent/suivant, voix, musique, plein écran, clavier (Espace, ←/→).

Deux façons de « voir » le documentaire :

- **Aperçu cinématique** (gratuit, immédiat) : visuels par scène + effet Ken Burns, dégradés procéduraux en repli, voix off, musique et sous-titres.
- **Vidéo IA réelle** (payant, top tech) : un **vrai clip vidéo par scène** est généré avec les modèles de pointe (**Google Veo 3**, **OpenAI Sora 2**, **Kling**, **Luma**…), puis assemblé et joué avec la narration française par-dessus.

Un **mode démo** (sujet « Les Trous Noirs ») fonctionne **sans clé API** (aperçu cinématique).

## Génération vidéo réelle (les derniers modèles)

Les modèles vidéo sont **payants** et **ne peuvent pas être appelés depuis le navigateur** (CORS + protection de la clé). L'app inclut donc un **petit backend local** (`server/`) qui appelle le modèle côté serveur, attend le rendu, et renvoie le clip au lecteur — la clé n'est **jamais** exposée au navigateur.

Fournisseurs et modèles disponibles :

| Fournisseur | Comment l'activer | Modèles |
|---|---|---|
| **Replicate** (recommandé) | `REPLICATE_API_TOKEN` | Google **Veo 3 / Veo 3 Fast**, **Kling v2.5**, **Luma Ray**, **MiniMax Hailuo**, **Wan 2.5** — un seul jeton |
| **OpenAI Sora** | `OPENAI_API_KEY` | **Sora 2**, **Sora 2 Pro** |
| **Google Veo** | `GEMINI_API_KEY` | **Veo 3.1 / 3.0 / 3.0 Fast** (API Gemini) |

Mise en route :

```bash
cp .env.example .env      # puis renseignez au moins une clé
npm install
npm run dev               # lance le front (Vite) ET le backend vidéo ensemble
```

Ensuite : sujet/texte → **Générer** → **🎥 Générer la vidéo IA** → choisissez fournisseur/modèle/format → **Générer les clips** (progression par scène) → **Lancer le documentaire vidéo**.

> On peut aussi coller la clé directement dans l'écran Studio vidéo (elle est envoyée au backend local, jamais stockée dans le bundle). Le fichier `.env` reste la méthode recommandée.

> ⏱️ La génération vidéo est **lente** (de ~30 s à quelques minutes par clip) et **facturée par le fournisseur**. Les clips sont générés 2 à la fois ; chaque scène joue son clip en boucle pendant sa narration.

## Prérequis

- Node.js 18+
- Une **clé API Anthropic** (`sk-ant-…`) pour la génération réelle. La clé est saisie dans l'interface et **stockée uniquement en local** (localStorage) ; elle n'est jamais envoyée ailleurs que vers l'API Anthropic.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrez l'URL affichée (par défaut http://localhost:5173).
Sans clé API, cliquez sur **« Voir la démo »**.

### Build de production

```bash
npm run build
npm run preview
```

## Choix techniques

- **React + Vite + TypeScript**.
- Appel direct à l'**API Claude** depuis le navigateur via le SDK officiel `@anthropic-ai/sdk` (`dangerouslyAllowBrowser: true`).
- **Structured outputs** (`output_config.format`) pour garantir un scénario JSON valide, normalisé côté client.
- Modèle par défaut : **Claude Opus 5** ; **Sonnet 5** et **Haiku 4.5** proposés pour ajuster vitesse/coût.
- **Aucune dépendance lourde** pour le rendu : voix (SpeechSynthesis), musique (Web Audio), visuels (générateur d'images ouvert), Markdown (rendu maison).

## Structure

```
src/
  App.tsx                    Orchestration des vues (saisie → sommaire → lecteur)
  types.ts                   Types partagés
  lib/
    claude.ts                Appel API + schéma + normalisation
    demo.ts                  Production de démonstration (sans clé)
    tts.ts                   Voix off (SpeechSynthesis)
    audio.ts                 Musique d'ambiance (Web Audio)
    visuals.ts               URLs d'images + dégradés de secours
    video.ts                 Client du backend vidéo (jobs + polling)
  components/
    InputPanel.tsx           Formulaire de saisie
    SummaryView.tsx          Sommaire expert + points clés
    VideoStudio.tsx          Génération des clips vidéo par scène
    DocumentaryPlayer.tsx    Lecteur plein écran (clips vidéo ou aperçu)
    Loader.tsx               Écran de génération
server/
  index.mjs                  Backend Express : Replicate / OpenAI Sora / Google Veo
.env.example                 Clés des fournisseurs vidéo (à copier en .env)
```

## Notes

- La qualité des voix françaises dépend du navigateur/OS ; si aucune voix française n'est disponible, les scènes sont rythmées par leur durée.
- La génération d'images passe par un service tiers ouvert ; en cas d'indisponibilité, un fond procédural cohérent avec la palette de la scène est utilisé.
- Le sommaire reste factuel ; les nuances/limites sont indiquées dans « À nuancer ».
