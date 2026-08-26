# Architecture

## Principe directeur

Le domaine métier est **pur**. Normalisation, déduplication, score d'offre
fantôme, scoring de compatibilité et analyse d'écart de mots-clés vivent dans
`@boussole/core` : aucune I/O, aucun état global, aucun appel réseau.

Trois conséquences pratiques :

- le scoring est **reproductible** — même profil et même offre donnent
  toujours le même résultat, ce qui rend une régression détectable ;
- la normalisation est **rejouable** — le payload brut de chaque offre est
  archivé, donc un parseur amélioré peut être appliqué au corpus existant
  sans réinterroger les ATS ;
- les tests du cœur métier s'exécutent en millisecondes, sans base ni réseau.

Tout ce qui touche au monde extérieur est repoussé vers les bords : les
connecteurs pour le réseau, `@boussole/db` pour la persistance, `apps/api`
pour l'orchestration.

---

## Modules

| Module                 | Responsabilité                                           | Ne fait jamais                             |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------ |
| `@boussole/core`       | Schémas, normalisation, déduplication, scoring, sécurité | I/O, réseau, état global                   |
| `@boussole/connectors` | Récupération depuis les ATS publics                      | Authentification, contournement anti-robot |
| `@boussole/db`         | Schéma Prisma, correspondance domaine ↔ base             | Logique métier                             |
| `@boussole/documents`  | CV et lettres Typst, garde-fous                          | Écrire un fait absent du profil            |
| `@boussole/llm`        | Passerelle BYOK, préparation d'entretien                 | Appeler un modèle sans consentement        |
| `apps/api`             | Orchestration, persistance, audit                        | Rendu                                      |
| `apps/web`             | Interface                                                | Détenir le jeton d'API                     |

`@boussole/core` expose trois points d'entrée :

- `.` — isomorphe, importable côté navigateur ;
- `./server` — chiffrement AES-256-GCM, isolé pour que `node:crypto` n'entre
  jamais dans un bundle client ;
- `./testing` — fixtures partagées par les tests des autres paquets.

---

## Flux principal : de l'ATS au CV

```
Connecteur ──► RawJob ──► normalizeJob ──► NormalizedJob ──► base
   │                          │
   │                          ├─ HTML → texte, sections, compétences
   │                          ├─ salaire, localisation, séniorité, langue
   │                          ├─ empreintes (contenu + identité)
   │                          └─ score d'offre fantôme
   │
   └─ fetch injecté (les tests n'atteignent jamais le réseau)

base ──► dedupeJobs ──► groupes de doublons
     └──► scoreJob(profil) ──► score + critères + écart de mots-clés
                                   │
                                   ├─ safeToAdd ──► forge documentaire
                                   └─ realGaps  ──► signalés, jamais écrits

forge ──► sélection ──► gabarit Typst ──► vérification ──► PDF
                                              │
                                              └─ échec ⇒ aucun fichier produit
```

### Points de vigilance du flux

**L'état précédent est transmis à la normalisation.** Sans lui, `firstSeenAt`
est réécrit à chaque ingestion : l'offre paraît éternellement neuve et le
score d'offre fantôme, qui repose entièrement sur l'ancienneté et les
republications, devient faux.

**Une offre disparue est désactivée, jamais supprimée.** Elle peut porter une
candidature en cours, et sa réapparition ultérieure est le signal de
republication le plus fort dont dispose le module de détection.

**La déduplication est recalculée sur l'ensemble du corpus.** Elle est
transitive : une offre nouvelle peut relier deux groupes existants. Un
rapprochement incrémental produirait des groupes différents selon l'ordre
d'arrivée.

**La vérification précède la compilation.** Un document qui échoue aux
garde-fous ne doit jamais exister sous forme de PDF, même dans un dossier
temporaire : un fichier produit finit toujours par être envoyé.

---

## Décisions structurantes

### Deux empreintes par offre, pas une

`contentHash` change dès qu'un mot de la description change — il détecte les
modifications. `identityKey` reste stable entre republications — il détecte
que deux annonces sont la même. Une empreinte unique ne peut pas remplir les
deux rôles.

`identityKey` est composée exclusivement de champs structurés : entreprise,
titre débruité, département, lieu. Une version antérieure y ajoutait un
« noyau lexical » extrait de la description ; c'était instable, puisque
ajouter une phrase déplace la fenêtre de sélection des tokens et change
l'empreinte — exactement ce qu'elle doit éviter.

### Un critère non évaluable est retiré du calcul

Compter zéro un critère faute d'information pénaliserait les offres
discrètes, pas les mauvaises offres. Le poids des critères non évaluables est
donc redistribué sur les autres.

En contrepartie, le score est **plafonné** selon le nombre de critères
réellement évaluables : sans exigence, sans salaire et sans lieu, une annonce
ne peut échouer nulle part, et un simple intitulé bien aligné suffirait à la
faire remonter en tête. Un avertissement ne suffit pas — c'est le score qui
pilote le tri.

### Le profil en JSON validé plutôt qu'en tables

Expériences, projets, formations et compétences sont stockés en colonnes JSON
validées par Zod. Leur forme évolue vite et ils ne sont jamais interrogés
champ par champ en SQL ; les normaliser imposerait une dizaine de jointures
pour afficher un CV. Les champs qui doivent rester interrogeables — ville,
région, intitulés — sont des colonnes.

### Chiffrement sélectif

Sont chiffrés au repos : courriel, téléphone, adresse, valeurs des réponses
sensibles, clé BYOK. Ne le sont pas : intitulés, compétences, réalisations.

Chiffrer ce qui doit rester interrogeable produit systématiquement soit du
déchiffrement en masse en mémoire, soit un contournement. Ces informations
figurent de toute façon sur un CV que le candidat diffuse volontairement.

Le déchiffrement est appliqué **pendant** la conversion base → domaine, avant
la validation : une colonne chiffrée n'est pas une adresse courriel valide.

### Le modèle de données est multi-utilisateur, l'authentification ne l'est pas

Le MVP utilise un jeton statique unique, comparé à temps constant, sur une API
qui n'écoute que la boucle locale. Ajouter OAuth et une gestion de mots de
passe créerait une surface d'attaque réelle pour protéger un service non
exposé. Le schéma porte déjà `userId` partout : passer à de vrais comptes sera
l'ajout d'une couche, pas une refonte. Limites détaillées dans `SECURITY.md`.

### Le jeton d'API ne quitte jamais le serveur web

`apps/web/src/lib/api.ts` importe `server-only` : la compilation échoue si le
module est tiré depuis un composant client. Lectures par composants serveur,
écritures par actions serveur. Le compromis assumé est l'absence de mise à
jour optimiste dans le MVP.

---

## Stratégie de tests

| Niveau         | Portée                                                          | Dépendances  |
| -------------- | --------------------------------------------------------------- | ------------ |
| Unitaire       | Cœur métier : scoring, déduplication, normalisation, garde-fous | Aucune       |
| Fixtures       | Connecteurs, sur des payloads ATS archivés                      | Aucune       |
| Extractibilité | Compilation Typst réelle, puis réextraction du texte            | Typst, pypdf |
| Intégration    | API complète via `app.inject()`                                 | Postgres     |

Les tests de connecteurs n'atteignent jamais le réseau : une suite qui
interroge un ATS tiers n'est plus un test mais une sonde de disponibilité.

Les tests d'intégration s'exécutent sur une **vraie** base Postgres. La
persistance est justement l'endroit où vivent les contraintes d'unicité, les
cascades et le comportement des colonnes JSON ; les simuler reviendrait à
tester une réimplémentation de Prisma. Ils sont ignorés proprement si la base
de test est absente.

Le test d'extractibilité vérifie la promesse centrale de la forge — qu'un ATS
puisse relire le PDF — par le chemin inverse de celui qui l'a produit : une
bibliothèque tierce réextrait le texte et l'on compare contenu, caractères
techniques et ordre de lecture.

---

## Erreurs et robustesse

| Situation                  | Comportement                                                         |
| -------------------------- | -------------------------------------------------------------------- |
| ATS injoignable            | Réessais bornés avec repli exponentiel ; échec enregistré par source |
| ATS renvoie 403            | Arrêt immédiat, message explicite — aucun contournement              |
| Offre malformée            | Ignorée, signalée en avertissement ; l'ingestion continue            |
| Typst absent               | Sources et texte produits ; PDF marqué indisponible                  |
| Modèle en panne            | Socle déterministe retourné avec la raison                           |
| Clé de chiffrement changée | Erreur explicite nommant la cause probable                           |
| Document non conforme      | Génération refusée, violations listées                               |

Un échec de source n'interrompt jamais les autres : chaque source a sa propre
trace d'exécution.
