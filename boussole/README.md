# Boussole

Assistant de recherche d'emploi. Il découvre des offres, les normalise, les
déduplique, détecte les annonces douteuses, évalue leur compatibilité avec
votre profil, génère des CV et lettres ciblés, suit vos candidatures et
prépare vos entretiens.

**Ce qu'il ne fait pas**, par conception :

- il ne soumet **aucune** candidature à votre place ;
- il n'invente **jamais** une compétence, un diplôme, une certification, une
  durée ou un chiffre absent de votre profil ;
- il ne contourne aucune protection anti-robot ;
- il n'envoie rien à un service tiers sans un consentement explicite et
  distinct de la configuration ;
- il ne stocke aucun identifiant de site d'emploi.

---

## Démarrage rapide

Prérequis : **Node 22+**, **pnpm 10+**, **PostgreSQL 16** (ou Docker).
[Typst](https://github.com/typst/typst) est optionnel — sans lui, les CV sont
produits en source et en texte, mais pas en PDF.

```bash
cd boussole
pnpm install

# 1. Configuration
cp .env.example .env
# Renseigner ENCRYPTION_KEY et API_TOKEN :
#   openssl rand -base64 32   → ENCRYPTION_KEY
#   openssl rand -hex 32      → API_TOKEN

# 2. Base de données
pnpm infra:up          # Postgres + Redis en local (ou utiliser votre instance)
pnpm db:generate
pnpm db:migrate

# 3. Données de démonstration (facultatif, entièrement fictives)
pnpm seed

# 4. Lancer
pnpm dev:api           # http://127.0.0.1:4000
pnpm dev:web           # http://localhost:3000
```

> **Ne définissez pas `NODE_ENV` dans `.env`.** Le fichier est partagé par
> l'API et l'interface ; un `NODE_ENV=development` exporté casse
> `next build` avec une erreur qui ne désigne pas sa cause. Chaque commande
> définit son propre mode.

---

## Vue d'ensemble

```
apps/
  api/          API HTTP (Fastify) — profil, ingestion, scoring, CRM, documents
  web/          Interface (Next.js) — sept écrans, en français
packages/
  core/         Domaine pur : schémas, normalisation, déduplication, scoring
  connectors/   Greenhouse, Lever, Ashby, Personio
  db/           Schéma Prisma, migrations, correspondance domaine ↔ base
  documents/    Forge documentaire Typst + garde-fous anti-invention
  llm/          Passerelle BYOK, désactivée par défaut
infra/          docker-compose de développement
docs/           Architecture, sécurité, vie privée, feuille de route
```

Détail des responsabilités et des flux : [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Les trois garanties du produit

### 1. Rien n'est inventé

Tout ce qui apparaît dans un document généré doit exister dans votre profil.
Ce n'est pas une consigne donnée à un modèle : c'est un contrôle mécanique
(`packages/documents/src/guardrails.ts`) qui vérifie compétences,
certifications, diplômes, employeurs et chiffres, **avant** la compilation du
PDF. Un document qui échoue n'est jamais produit, même temporairement.

L'analyse d'écart de mots-clés distingue trois statuts, et un seul autorise
une action automatique :

| Statut            | Signification                            | Ce que Boussole peut faire           |
| ----------------- | ---------------------------------------- | ------------------------------------ |
| `matched`         | Présente au profil et visible dans le CV | Rien à faire                         |
| `missing_from_cv` | Présente au profil, absente du CV envoyé | La faire ressortir                   |
| `not_in_profile`  | Absente de votre profil                  | **Rien** — signalée comme écart réel |

### 2. Vous gardez la main

Aucune route ne marque une candidature « soumise » automatiquement. Le
passage à cette étape est un bouton que vous cliquez. Le CRM refuse par
ailleurs les transitions absurdes, pour que ses statistiques restent
interprétables.

### 3. Rien ne sort sans votre accord

Le fournisseur de modèle par défaut est `none` : aucune donnée ne quitte la
machine. Toutes les fonctions principales — scoring, déduplication, détection
d'offres douteuses, génération de CV et de lettres, préparation d'entretien —
sont déterministes et fonctionnent sans modèle.

Si vous activez un fournisseur distant, quatre contrôles s'appliquent à chaque
appel : fournisseur actif, consentement explicite (distinct de la
configuration), absence de données identifiantes vérifiée mécaniquement, et
taille de prompt bornée. Détails dans [`PRIVACY.md`](PRIVACY.md).

---

## Commandes

| Commande                       | Effet                                   |
| ------------------------------ | --------------------------------------- |
| `pnpm dev:api`                 | API en rechargement à chaud             |
| `pnpm dev:web`                 | Interface en rechargement à chaud       |
| `pnpm test`                    | Tous les tests                          |
| `pnpm check`                   | Format, lint, types et tests            |
| `pnpm db:migrate`              | Applique les migrations                 |
| `pnpm seed`                    | Jeu de démonstration (données fictives) |
| `pnpm infra:up` / `infra:down` | Postgres + Redis locaux                 |

Guides : [développement local](docs/development.md) · [tests](docs/testing.md).

---

## État actuel

Le MVP est fonctionnel de bout en bout : ingestion réelle depuis quatre ATS,
normalisation, déduplication, scoring explicable, génération de documents
vérifiés, CRM et préparation d'entretien.

Ce qui n'existe pas encore, et pourquoi, est dans
[`ROADMAP.md`](ROADMAP.md) — notamment l'extension navigateur et la
prospection par courriel, volontairement repoussées après les garanties.

## Documentation

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — modules, flux, décisions structurantes
- [`ROADMAP.md`](ROADMAP.md) — ce qui est fait, ce qui suit, ce qui est écarté
- [`SECURITY.md`](SECURITY.md) — modèle de menace, chiffrement, limites assumées
- [`PRIVACY.md`](PRIVACY.md) — données collectées, minimisation, export, suppression
- [`docs/modules/`](docs/modules/) — un document par module
