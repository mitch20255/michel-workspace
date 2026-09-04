# Image-to-video

`img2video.py` prend **une image + un prompt positif + un prompt négatif** et
rend un MP4. Un seul CLI, trois fournisseurs interchangeables.

Aucune dépendance : uniquement la bibliothèque standard Python 3.

## Utilisation

```bash
python3 video/img2video.py \
  --image photo.png \
  --prompt "la caméra recule lentement, lumière chaude de fin de journée" \
  --negative "flou, texte, filigrane, mains déformées" \
  --duration 5 --aspect 9:16 \
  --out out/clip.mp4
```

Deux modes qui ne demandent ni clé ni réseau :

| Mode | Ce qu'il fait |
|---|---|
| `--dry-run` | affiche la requête exacte qui partirait (clé masquée, image abrégée) |
| `--check` | teste la joignabilité du fournisseur et la présence de la clé |

## Fournisseurs

| `--provider` | Variable d'environnement | Modèle par défaut | Joignable depuis Claude Code web |
|---|---|---|---|
| `veo` | `GEMINI_API_KEY` | `veo-3.0-generate-001` | **oui** |
| `replicate` | `REPLICATE_API_TOKEN` | `kwaivgi/kling-v1.6-standard` | non — bloqué par le proxy |
| `fal` | `FAL_KEY` | `fal-ai/kling-video/v1.6/standard/image-to-video` | non — bloqué par le proxy |

Replicate et fal.ai fonctionnent depuis une machine locale sans restriction
réseau. Pour les utiliser depuis un environnement Claude Code web, il faut
autoriser leur domaine dans la politique réseau de l'environnement.

## Choisir un modèle

`--model` accepte n'importe quel slug du catalogue du fournisseur — vérifie-le
sur leur catalogue, les slugs bougent vite. Les modèles ne nomment pas tous
leur champ image de la même façon (`start_image`, `image`, `input_image`) :

```bash
--model wan-video/wan-2.2-i2v-fast --image-field image
```

Tout paramètre propre à un modèle passe par `--extra`, transmis tel quel
(les valeurs JSON valides sont converties, sinon c'est une chaîne) :

```bash
--extra seed=42 --extra num_frames=81 --extra cfg_scale=0.5
```

## Prompt négatif

Attention : ce n'est pas universel. Kling et Wan le prennent nativement
(`negative_prompt`), Veo aussi (`negativePrompt`). D'autres modèles l'ignorent
silencieusement — un `--dry-run` suivi d'une lecture du schéma du modèle évite
la mauvaise surprise.

Ce qui marche le mieux dedans : les défauts techniques (`flou, artefacts,
compression, filigrane, texte`) plutôt que des concepts abstraits.

## Ajouter un fournisseur

Sous-classer `Provider` et implémenter `plan()` (construire la requête) et
`run()` (lancer, attendre, retourner l'URL), puis l'ajouter à `PROVIDERS`.
Une trentaine de lignes.
