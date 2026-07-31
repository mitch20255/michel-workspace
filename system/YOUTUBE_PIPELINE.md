# YOUTUBE → BRAIN — Le pipeline de synthèse

> Comment une vidéo YouTube devient une synthèse niveau expert que le cerveau de Michel ingère.
> Ce fichier est lu par l'agent (moi / le Heartbeat) à chaque traitement.

---

## Le principe (honnête)

L'app Nexus publiée **ne peut pas** lire YouTube ni faire tourner un LLM toute seule
(runtime sans connecteur). Et l'accès direct à YouTube est bloqué (403) pour l'agent.
Donc la synthèse est produite **par l'agent, à partir d'un transcript réel** — jamais inventée.

**Règle absolue :** on ne synthétise QUE des vidéos dont on a le vrai transcript.
Pas de transcript = pas de synthèse. On n'invente jamais le contenu d'une vidéo.

---

## Le flux qui marche AUJOURD'HUI (zéro clé API)

```
Michel                          App Nexus                     Agent (moi / Heartbeat)
──────                          ─────────                     ──────────────────────
1. Crée une playlist publique
2. Colle les liens vidéo   →    Learn → file d'attente
3. Ouvre chaque vidéo,
   colle le transcript      →   stocké sur la note
4. Export queue (.json)     →   nexus-youtube-queue.json
5. Me donne le fichier ─────────────────────────────────→    6. Lit les transcripts
                                                              7. Écrit une synthèse experte
                                                                 (format ci-dessous)
                                                              8. Produit syntheses.json
                                                              9. Commit dans brain/knowledge/
10. Import syntheses (.json) ←   ingéré comme notes  ←────────
    → dans son cerveau, cherchable
```

Le seul geste manuel récurrent de Michel : **coller le transcript** (bouton natif YouTube :
« … » → *Afficher la transcription* → copier). ~30 sec/vidéo. Zéro compte, zéro clé.

## Le flux FULL-AUTO (Chemin B — setup une fois par Michel)

Pour que « l'app fait tout » sans coller de transcript, il faut brancher 3 services
(comptes que Michel crée, ~20 min total) :
1. **YouTube Data API** (clé Google, gratuit) → lister les vidéos d'une playlist publique.
2. **Service de transcript** (ex. youtube-transcript API, ou Whisper) → récupérer le texte.
3. **Clé API Claude/Anthropic** → générer la synthèse automatiquement.

Une fois ces clés fournies, je code un petit backend/worker qui tourne le pipeline
en entier sur un simple lien de playlist. C'est l'étape « produit » (voir MICHEL_WAKE_UP.md).

---

## Format de synthèse — NIVEAU EXPERT (obligatoire)

Chaque synthèse suit cette structure. Ton : celui de Michel (voir `brain/IDENTITY.md`) —
direct, orienté ROI, bilingue naturel. On ne résume pas : on **distille et on connecte**.

```markdown
# 🎥 <Titre de la vidéo>
**Source :** <chaîne> · <URL> · <durée si connue>
**Synthétisé :** <date> · **Tags :** #youtube #<domaine>

## En 30 secondes (TL;DR)
Les 2-3 idées qui comptent, point.

## Les concepts clés
- **<Concept>** — explication experte, pas superficielle.
- ...

## Ce qu'un expert retient (au-delà du contenu)
La nuance, le contre-intuitif, ce que la vidéo sous-entend sans le dire,
les limites de ce qui est avancé.

## 💰 Application pour l'agence de Michel
Comment ça se traduit en action concrète : un pitch, une automation à vendre,
un angle de contenu, une décision. Toujours ramener au business.

## 🔗 Connexions dans le cerveau
Liens vers les notes/décisions existantes que ça renforce ou contredit.

## Questions ouvertes / à creuser
Ce que ça soulève et qui mérite un suivi.
```

**Sortie machine** (pour l'import dans l'app), un tableau JSON :
```json
[
  { "videoId": "abc123", "title": "…", "url": "https://…",
    "tags": ["youtube","ai"], "synthesis": "<le markdown ci-dessus en texte>" }
]
```

---

## Où ça atterrit (double ingestion)

1. **Dans l'app Nexus** → via *Import syntheses* (note type `youtube`, statut `done`).
2. **Dans le cerveau git** → un fichier `brain/knowledge/youtube/<date>-<slug>.md`
   + une ligne dans `memory/INDEX.md`.

Les deux, toujours. L'app pour l'usage quotidien, le git pour la source de vérité durable.
