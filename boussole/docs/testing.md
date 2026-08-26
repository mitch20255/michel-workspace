# Tests

```bash
pnpm test                    # tout
pnpm test:watch              # en continu
pnpm test:coverage           # avec seuils
pnpm check                   # format + lint + types + tests
```

---

## Les quatre niveaux

| Niveau         | Ce qui est vérifié       | Dépendances  | Ignoré si absentes |
| -------------- | ------------------------ | ------------ | ------------------ |
| Unitaire       | Cœur métier              | aucune       | —                  |
| Fixtures       | Connecteurs ATS          | aucune       | —                  |
| Extractibilité | PDF relisible par un ATS | Typst, pypdf | oui                |
| Intégration    | API complète             | Postgres     | oui                |

Les suites dépendant d'un outil externe sont **ignorées**, pas en échec :
Typst et Postgres sont des outils de développement, pas des dépendances du
produit. Une suite rouge doit signaler une régression, pas une machine
incomplète.

---

## Préparer la base de test

```bash
sudo -u postgres createdb -O boussole boussole_test

cd packages/db
DATABASE_URL="postgresql://boussole:boussole@localhost:5432/boussole_test?schema=public" \
  npx prisma migrate deploy
```

L'URL peut être surchargée par `TEST_DATABASE_URL`.

Les tests d'intégration s'exécutent sur une **vraie** base. La persistance est
précisément l'endroit où vivent les contraintes d'unicité, les cascades et le
comportement des colonnes JSON ; les simuler reviendrait à tester une
réimplémentation de Prisma plutôt que le système réel.

Chaque suite repart d'une base vide (`TRUNCATE ... CASCADE`), et les requêtes
passent par `app.inject()` : toute la pile Fastify est exercée —
authentification, validation, gestion d'erreurs — sans ouvrir de port.

---

## Ce que les tests doivent protéger en priorité

Ces propriétés sont le produit. Une régression sur l'une d'elles est un
incident, pas un test à ajuster.

**Rien n'est inventé.** `documents.test.ts` vérifie qu'un document contenant
une compétence, une certification ou un chiffre absent du profil est refusé.
`keywordGap.test.ts` vérifie qu'aucun mot-clé classé « absent du profil » ne
peut atteindre la forge documentaire.

**Rien ne fuit.** `minimize.test.ts` vérifie qu'aucune donnée identifiante ne
figure dans une charge utile destinée à un modèle. `llm.test.ts` vérifie que
la passerelle bloque avant l'envoi et que le journal ne contient jamais le
prompt. `api.test.ts` lit **directement en base** pour prouver que les
coordonnées et la clé API sont chiffrées — vérifier via la couche de service
prouverait seulement que le service se comporte comme on le croit.

**Le score est honnête.** `score.test.ts` vérifie qu'un critère non évaluable
est exclu du calcul, et qu'une offre trop peu documentée voit son score
plafonné.

**Le PDF est lisible par un ATS.** `extractability.test.ts` compile réellement
le PDF puis en réextrait le texte avec une bibliothèque tierce — le chemin
inverse de celui qui l'a produit — et compare contenu, caractères techniques
(`C#`, `C++`) et ordre de lecture.

---

## Écrire un test

**Nommer le comportement, pas la fonction.** « refuse une compétence absente
du profil » se lit dans un rapport d'échec ; « test verifyDocument » ne dit
rien.

**Un test qui échoue doit accuser le code.** Si un test échoue et que le
réflexe est de modifier le test, c'est qu'il testait l'implémentation plutôt
que le comportement.

**Commenter le piège, pas l'assertion.** Les cas les plus utiles de cette base
de code sont ceux qui documentent une erreur classique : « hybrid — 2 days
remote » contient le mot _remote_ mais n'est pas un poste à distance ; « you
will work with senior engineers » ne fait pas d'une offre un poste senior.

**Injecter le temps.** Toute fonction dépendant de la date accepte un
paramètre `now`. Un test qui dépend de l'horloge finit par échouer un mardi.

**Ne jamais toucher le réseau.** Les connecteurs reçoivent leur `fetch` en
paramètre. Une suite qui interroge un ATS tiers échoue le jour où celui-ci
modifie une offre : ce n'est plus un test, c'est une sonde de disponibilité.

**N'utiliser que des données fictives.** Aucune donnée candidat réelle dans le
dépôt, y compris dans les tests et les scripts d'amorçage : un dépôt est
copié, forké et indexé.
