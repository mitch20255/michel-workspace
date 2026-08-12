# ⚙️ Architecture du Second Brain

## 1. Les deux cerveaux

Tu as déjà **Cortex** (`cortex_n8n_FINAL.json`). Ne le remplace pas — il joue un rôle
différent. Vois-les comme deux hémisphères :

| | **Cortex** (existant) | **Second Brain** (ce vault) |
|---|---|---|
| Rôle | Cerveau **exécutif** | Cerveau de **connaissance / mémoire** |
| Question | « Qu'est-ce que je dois **FAIRE** ? » | « Qu'est-ce que j'ai **APPRIS / VU** ? » |
| Entrée | Tes pensées, idées, to-dos (Telegram) | Ce que tu **consommes** (Insta, articles, YouTube) |
| Traitement | Claude → tâche / projet | Claude → résumé + tags + catégorie |
| Sortie | **Asana** (projets + tâches) + Supabase | **Obsidian** (notes .md liées) |
| Nature | Éphémère, orienté action | Durable, cumulatif, cherchable |

Le pattern technique de Cortex — *capture → Claude analyse et sort du JSON structuré →
routage vers la bonne destination* — est **exactement** celui qu'on réutilise ici.
On change juste la destination et le prompt de Claude.

## 2. Le flux de connaissance (5 étapes)

```
CAPTURE ──▶ INBOX ──▶ TRAITEMENT (Claude) ──▶ SOURCE atomique ──▶ RELIÉE aux projets
```

1. **Capture** — tu partages un contenu (voir `Capture-Automation.md`).
2. **Inbox** — la capture brute atterrit dans `00-Inbox/` (rien n'est perdu).
3. **Traitement** — Claude lit le contenu et produit :
   - un **titre** clair,
   - un **résumé** (2-3 phrases),
   - 3-5 **key takeaways** (les vrais apprentissages actionnables),
   - une **catégorie** + des **tags**,
   - le(s) **projet(s)** auxquels rattacher la note.
4. **Source** — une note `.md` propre est créée dans `01-Sources/<type>/`.
5. **Reliure** — grâce aux tags/liens, la note remonte automatiquement dans les MOC.

## 3. Anatomie d'une note-source

Chaque note commence par un **frontmatter** (métadonnées YAML) — c'est ce qui rend le
vault interrogeable :

```yaml
---
type: article          # article | video | post | journal | podcast
source: "Nom du média / chaîne"
url: https://...
date: 2026-08-12
category: Parenting     # voir Tags-et-Categories.md
tags: [parenting, sommeil, 0-2ans]
projets: ["[[Parenting - MOC]]"]
importance: high        # high | medium | low
status: à-lire          # à-lire | traité | à-approfondir
---
```

Le corps de la note : **Résumé → Key takeaways → Citations/extraits → Mes notes**.

## 4. Le mécanisme « projet » (le cœur)

Un **projet** = un dossier dans `02-Projects/` avec **3 notes** :

- **`<Projet> - MOC.md`** (*Map of Content*) — le tableau de bord. Elle n'écrit rien
  elle-même : elle **interroge** le vault avec Dataview. Toute note taggée avec le bon
  tag y apparaît toute seule.
- **`<Projet> - Base de connaissances.md`** — la **synthèse finale** que TU écris quand
  tu as « closé le dossier ». C'est le livrable durable (ce que tu retiens vraiment).
- **`<Projet> - Veille.md`** — la file des **nouveautés** post-clôture, pour rester à jour.

### Les 3 phases d'un projet de connaissance

```
PHASE 1 : RECHERCHE          PHASE 2 : SYNTHÈSE          PHASE 3 : VEILLE
« Closer le dossier »        « Base de données finale »   « Rester à jour »
─────────────────────        ─────────────────────        ─────────────────────
Tu consommes en masse,       Tu relis toutes les          Le dossier est closé.
tout tombe dans la MOC       Sources, tu écris la         Chaque NOUVELLE capture
via les tags.                synthèse (Base de            taggée alimente la
                             connaissances).             note Veille automatiquement.
```

C'est exactement ton exemple *Parenting* : apprendre tout (Phase 1) → base finale
(Phase 2) → veille des nouveaux articles (Phase 3). L'exemple est monté dans
`02-Projects/Parenting/`.

## 5. Pourquoi Dataview change tout

Sans Dataview, un « second brain » devient vite un cimetière de notes. Dataview
transforme le vault en **base de données vivante** : les MOC se remplissent seules,
tu peux filtrer par catégorie/importance/date, et une capture faite depuis ton
téléphone ce soir apparaît dans le bon projet sans aucune manipulation. C'est la
différence entre « ranger des fichiers » et « avoir une mémoire externe ».
