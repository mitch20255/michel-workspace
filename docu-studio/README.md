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

Un **mode démo** (sujet « Les Trous Noirs ») fonctionne **sans clé API**.

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
  components/
    InputPanel.tsx           Formulaire de saisie
    SummaryView.tsx          Sommaire expert + points clés
    DocumentaryPlayer.tsx    Lecteur cinématique plein écran
    Loader.tsx               Écran de génération
```

## Notes

- La qualité des voix françaises dépend du navigateur/OS ; si aucune voix française n'est disponible, les scènes sont rythmées par leur durée.
- La génération d'images passe par un service tiers ouvert ; en cas d'indisponibilité, un fond procédural cohérent avec la palette de la scène est utilisé.
- Le sommaire reste factuel ; les nuances/limites sont indiquées dans « À nuancer ».
