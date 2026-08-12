# 🏷️ Taxonomie — Catégories & Tags

> Une taxonomie légère mais **cohérente**. La règle d'or : **peu de catégories, beaucoup de tags.**

## Catégories (1 seule par note)
La catégorie répond à « ça appartient à quel grand domaine ? ». Reprends celles de Cortex
pour rester cohérent entre les deux cerveaux, + les tiennes :

- `AI & Machine Learning`
- `Business & Stratégie`
- `Développement / Code`
- `Marketing & Growth`
- `Design & Créatif`
- `Finance & Investissement`
- `Productivité & Outils`
- `Parenting` ← ton exemple
- `Santé & Bien-être`
- `Personnel`
- `Autre`

## Tags (plusieurs par note)
Les tags sont **fins et libres**. Trois familles utiles :

| Famille | Exemples | À quoi ça sert |
|---|---|---|
| **Sujet** | `#sommeil`, `#discipline`, `#0-2ans`, `#outreach-b2b` | Filtrer finement dans une MOC |
| **Projet** | `#parenting`, `#cortex`, `#la-fabrique` | Rattacher au bon projet (moteur des MOC) |
| **Statut** | `#à-lire`, `#à-approfondir`, `#pépite` | Piloter ton flux de traitement |

### Convention
- Tags en **minuscules**, mots liés par des tirets : `#0-2ans`, `#cash-flow`.
- **Un tag = un projet** : c'est ce tag que les MOC interrogent (ex. tout `#parenting`
  remonte dans `Parenting - MOC`).
- N'invente pas 40 tags. Commence petit, laisse-les émerger.

## Statuts de traitement (frontmatter `status`)
- `à-lire` — capturé, pas encore lu en profondeur.
- `traité` — lu, résumé, takeaways extraits.
- `à-approfondir` — mérite une session dédiée.

## Importance (frontmatter `importance`)
- `high` — pépite, à réutiliser souvent.
- `medium` — utile.
- `low` — contexte, gardé « au cas où ».
