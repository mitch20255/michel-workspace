# HEARTBEAT — Mode autonome (intégré au Brain OS)

> Les règles complètes du mode autonome sont dans [`../HEARTBEAT_RULES.md`](../HEARTBEAT_RULES.md).
> Ce fichier ajoute les **devoirs de tenue du cerveau** que l'agent doit faire à chaque réveil.

---

## À chaque réveil, en plus des règles ROI existantes

1. **Vider l'inbox.** Prendre `capture/inbox.md`, classer chaque item via `system/ROUTER.md`.
2. **Tenir le journal.** Écrire ou compléter `memory/daily/AAAA-MM-JJ.md` avec ce qui a été fait.
3. **Documenter les décisions.** Toute vraie décision prise → nouveau fichier dans `brain/decisions/`.
4. **Mettre à jour l'INDEX.** Tout fichier important créé → ligne ajoutée à `memory/INDEX.md`.
5. **Agir comme Michel.** Toujours relire `brain/IDENTITY.md` avant de produire quelque chose en son nom.
6. **Traiter la file YouTube.** Vérifier `capture/youtube-queue.md` (et tout `.json` de queue exporté depuis l'app). Pour chaque vidéo qui a un **transcript réel**, produire une synthèse niveau expert selon `system/YOUTUBE_PIPELINE.md`, l'écrire dans `brain/knowledge/youtube/`, et générer le `syntheses.json` que Michel importera dans l'app. **Jamais de synthèse sans transcript.**

## Priorités : voir HEARTBEAT_RULES.md
Le fichier racine garde la logique ROI (revenus → automation → projets → exploration).
Ce fichier-ci ne fait qu'y greffer l'entretien du cerveau.
