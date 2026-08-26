# Développement local

## Mise en place

```bash
cd boussole
pnpm install

cp .env.example .env
# ENCRYPTION_KEY : openssl rand -base64 32
# API_TOKEN      : openssl rand -hex 32
```

### Base de données

Avec Docker :

```bash
pnpm infra:up          # Postgres 16 + pgvector + Redis, sur 127.0.0.1
```

Sans Docker, avec un Postgres local :

```bash
sudo -u postgres psql -c "CREATE ROLE boussole LOGIN PASSWORD 'boussole' CREATEDB"
sudo -u postgres createdb -O boussole boussole
```

Puis, dans les deux cas :

```bash
pnpm db:generate       # génère le client Prisma
pnpm db:migrate        # applique les migrations
pnpm seed              # jeu de démonstration (facultatif, données fictives)
```

### Lancement

Deux terminaux :

```bash
pnpm dev:api           # http://127.0.0.1:4000
pnpm dev:web           # http://localhost:3000
```

---

## Pièges connus

### Ne pas définir `NODE_ENV` dans `.env`

Le fichier est partagé par l'API et l'interface. Un `NODE_ENV=development`
exporté dans l'environnement fait échouer `next build` : Next compile pour la
production pendant que React résout sa version de développement, et les deux
copies ne partagent pas le même répartiteur de hooks.

L'erreur obtenue — `Cannot read properties of null (reading 'useContext')`
sur `/_global-error` — ne désigne pas du tout sa cause. Chaque commande
définit son propre mode.

### `prisma generate` a besoin de `DATABASE_URL`

Même sans base démarrée : la variable est lue pour analyser le schéma. Si
`.env` n'existe pas encore, la commande échoue avec un message peu clair.

### Le client Prisma n'est pas versionné

`packages/db/generated/` est ignoré par git : c'est du code dépendant de la
plateforme. Après un `git clone` ou un changement de schéma, lancer
`pnpm db:generate`.

### Construire les paquets avant les tests d'intégration

Les tests unitaires s'exécutent sur les sources grâce aux alias Vitest.
`@boussole/db` fait exception — il réexporte le client Prisma, qui est du
CommonJS et ne survit pas à une résolution ESM par Vite. Il est donc résolu
via son `dist` :

```bash
pnpm build              # construit tous les paquets
pnpm test
```

### Typst est facultatif

Sans lui, la génération produit la source `.typ` et le texte extractible, et
signale le PDF comme indisponible. Pour l'installer :

```bash
# https://github.com/typst/typst#installation
curl -sSL https://github.com/typst/typst/releases/latest/download/typst-x86_64-unknown-linux-musl.tar.xz \
  | tar xJ --strip-components=1 -C /usr/local/bin --wildcards '*/typst'
```

---

## Conventions de code

**Langue.** Identifiants et types en anglais, commentaires et messages
destinés à l'utilisateur en français. La base de code parle deux langues
volontairement : le vocabulaire technique est anglais, le produit s'adresse
à un public francophone.

**Commentaires.** Ils expliquent _pourquoi_, pas _quoi_. Un commentaire qui
paraphrase la ligne suivante est du bruit ; un commentaire qui explique
pourquoi un seuil vaut 0,86 ou pourquoi un critère est retiré du calcul évite
qu'on « simplifie » une décision réfléchie six mois plus tard.

**Validation.** Toute donnée qui traverse une frontière — API, base,
connecteur, modèle — passe par un schéma Zod. On ne fait jamais confiance à
une source externe, y compris à sa propre base : une ligne écrite par une
version antérieure du code est une source externe.

**Erreurs.** Types dédiés portant ce qui permet de décider (`retryable`,
`status`, `violations`), jamais des chaînes à comparer. Les messages destinés
à l'utilisateur sont en français et actionnables.

**Nommer l'incertitude.** Toute valeur déduite porte un niveau de confiance.
Un salaire lu dans un champ structuré et un salaire deviné dans un paragraphe
ne valent pas la même chose, et l'interface doit pouvoir le dire.

---

## Ajouter un connecteur ATS

1. Vérifier qu'une **API publique et documentée** existe. Sinon, ne pas
   l'implémenter — c'est le critère, pas la difficulté technique.
2. Créer `packages/connectors/src/<nom>.ts` implémentant `Connector`.
3. Valider la réponse avec Zod, de façon permissive : les ATS renvoient des
   données incomplètes, c'est la normalisation qui range.
4. Une offre malformée est ignorée et signalée en avertissement ; elle ne doit
   jamais faire échouer toute l'ingestion.
5. Ajouter une fixture réelle dans `src/fixtures/` et des tests qui
   n'atteignent pas le réseau.
6. Enregistrer le connecteur dans `src/index.ts`.

---

## Modifier le scoring

Le moteur est dans `packages/core/src/matching/score.ts`. Trois propriétés à
préserver :

1. **Explicable.** Chaque critère produit sa note, son poids et une phrase en
   français. Un score sans justification est inutilisable pour décider où
   investir son temps.
2. **Honnête sur l'inconnu.** Un critère non évaluable est retiré du calcul,
   jamais compté zéro. En contrepartie le score est plafonné quand trop peu de
   critères sont évaluables — sans quoi une annonce vide ne peut échouer nulle
   part et remonte en tête.
3. **Gratuit.** Aucun appel réseau, aucun modèle. Le LLM n'intervient
   qu'ensuite, sur les offres retenues.

Après toute modification : `pnpm test` puis `pnpm seed`, et vérifier que le
classement obtenu reste défendable.
