# Sécurité

## Ce que Boussole protège, et contre quoi

Boussole conserve un profil candidat complet : identité, coordonnées,
parcours, prétentions salariales, autorisation de travail, et parfois des
réponses à des questions relevant de la vie privée. C'est un dossier plus
sensible que la plupart des applications personnelles.

**Scénarios pris au sérieux :**

| Menace                              | Protection                                                            |
| ----------------------------------- | --------------------------------------------------------------------- |
| Fuite d'une sauvegarde de base      | Chiffrement applicatif AES-256-GCM des champs les plus sensibles      |
| Journaux copiés, agrégés, conservés | Masquage systématique des PII, à deux niveaux indépendants            |
| Fuite vers un fournisseur de modèle | Minimisation, pseudonymisation et contrôle mécanique avant tout envoi |
| Exfiltration par un document généré | Aucun fait non attesté ne peut entrer dans un document                |
| Accès non autorisé à l'API locale   | Jeton exigé, comparé à temps constant ; écoute sur la boucle locale   |
| Lecture de fichiers arbitraires     | Chemins de documents résolus et confinés sous `STORAGE_DIR`           |

**Hors périmètre, explicitement :** un attaquant disposant simultanément de la
base et de la clé de chiffrement, ou un accès physique à une machine
déverrouillée. Boussole ne prétend pas s'en protéger.

---

## Chiffrement au repos

Algorithme : **AES-256-GCM**, chiffrement authentifié. Une valeur altérée en
base échoue au déchiffrement au lieu de produire silencieusement des données
fausses.

Format stocké : `v1.<iv>.<tag>.<chiffré>`. Le préfixe de version permet une
rotation d'algorithme sans avoir à deviner le format des anciennes valeurs.

Un IV aléatoire est tiré **par message** : réutiliser un IV avec GCM casse à
la fois la confidentialité et l'authentification.

### Ce qui est chiffré

| Champ                       | Table                |
| --------------------------- | -------------------- |
| `email`, `phone`, `address` | `candidate_profiles` |
| `value`                     | `sensitive_answers`  |
| `llmApiKey`                 | `user_settings`      |

### Ce qui ne l'est pas, et pourquoi

Intitulés de poste, compétences, réalisations, formations restent en clair.
Ils doivent rester interrogeables pour le scoring et le tri, et figurent de
toute façon sur un CV que le candidat diffuse volontairement. Chiffrer une
donnée qui doit rester interrogeable produit systématiquement soit du
déchiffrement en masse en mémoire, soit un contournement.

Les colonnes chiffrées ne sont **jamais indexées** : un index dessus ne sert à
rien et fuit de l'information par sa seule existence.

### La clé

`ENCRYPTION_KEY`, 32 octets en base64 :

```bash
openssl rand -base64 32
```

Une clé absente ou de mauvaise longueur **empêche le démarrage**. Le mode
dégradé « stocker en clair » n'existe pas : découvrir le problème au premier
appel, après avoir écrit des données non protégées, est bien pire qu'un refus
immédiat.

⚠️ **Sauvegarder cette clé hors du dépôt.** La perdre rend les champs chiffrés
définitivement illisibles. Si le déchiffrement échoue, l'API le dit
explicitement plutôt que de renvoyer une erreur générique — c'est presque
toujours une clé qui a changé.

---

## Authentification : ce qui est fait et ce qui ne l'est pas

Le MVP utilise un **jeton statique unique** (`API_TOKEN`, 32 caractères
minimum), comparé avec `timingSafeEqual`. Une comparaison `===` sur un secret
fuit sa longueur et son préfixe par le temps de réponse.

Ce choix est délibéré : l'application est mono-utilisateur et l'API n'écoute
que `127.0.0.1`. Ajouter OAuth, des sessions et une gestion de mots de passe
créerait une surface d'attaque réelle pour protéger un service non exposé.

**Limites assumées, à connaître avant tout déploiement :**

- pas de sessions, pas d'expiration, pas de révocation — changer le jeton
  invalide l'accès existant ;
- pas de limitation de débit sur l'authentification ;
- pas de séparation des privilèges : le jeton donne accès à tout ;
- `/health` est volontairement ouvert (une sonde qui exige un secret n'est
  pas utilisable par un superviseur) et ne révèle rien de personnel.

**Avant d'exposer l'API au-delà de la boucle locale**, il faut de vrais
comptes. Le schéma porte déjà `userId` sur toutes les tables concernées :
c'est l'ajout d'une couche d'authentification, pas une refonte.

---

## Journaux

Deux barrières indépendantes, parce qu'un journal qui fuit est une fuite
permanente : il est copié, agrégé et conservé bien après la suppression du
compte.

1. `redactForLogs` (`@boussole/core`) masque courriels, téléphones, numéros
   d'assurance sociale, cartes, clés d'API, jetons porteurs et JWT, et
   remplace intégralement la valeur des clés sensibles connues.
2. Le journaliseur Fastify masque en plus les en-têtes d'autorisation et les
   champs de corps de requête sensibles — il attrape ce qu'un appelant aurait
   oublié de faire passer par la première.

Les requêtes SQL ne sont journalisées qu'en développement : leurs paramètres
contiennent des données de profil.

---

## Journal d'audit

Le journal répond à « qu'est-ce que cet outil a fait en mon nom ? ». Il est
en **ajout seul** : aucune route ne permet de modifier ou supprimer une
entrée. Un journal effaçable ne prouve rien.

Il ne contient **jamais** de valeur sensible — seulement la nature de
l'action, des références et des compteurs. Une génération documentaire y
laisse « CV v3, ton offensif, 4 puces réécrites dont 2 de portée », jamais le
texte des puces. « Champ `salary_expectation`
mis à jour », jamais le montant. « Appel au modèle pour
`interview_questions`, 1 240 jetons », jamais le prompt : un journal qui
contient les prompts est une copie intégrale du profil sous un autre nom.

---

## Envoi vers un fournisseur de modèle

Quatre contrôles, appliqués par la passerelle à **chaque** appel — aucun
module n'appelle un fournisseur directement :

1. **Fournisseur actif ?** `none` par défaut. Rien ne sort.
2. **Consentement donné ?** Distinct de la configuration : posséder une clé ne
   vaut pas accord pour transmettre ses données. Changer de fournisseur
   réinitialise le consentement — accepter un service ne vaut pas acceptation
   pour un autre.
3. **Aucune donnée identifiante ?** Vérification mécanique de la charge utile
   contre le profil réel. Une fuite devient une erreur bruyante plutôt qu'un
   envoi silencieux. Ce contrôle s'applique aussi au fournisseur local : il
   coûte quelques microsecondes et empêche une habitude dangereuse de
   s'installer pendant le développement.
4. **Taille bornée ?** Contre l'envoi massif accidentel.

Aucun repli silencieux : si le fournisseur local échoue, l'appel échoue.
Basculer vers un service en nuage sans le dire serait une fuite.

---

## Dépendances

La chaîne d'approvisionnement est une surface d'attaque réelle. Deux mesures :

- `onlyBuiltDependencies` dans `pnpm-workspace.yaml` : seules les dépendances
  explicitement listées peuvent exécuter des scripts d'installation ;
- chaque dépendance directe est justifiée dans le commit qui l'introduit.

Dépendances runtime directes, hors framework : `zod`, `fast-xml-parser`
(flux XML Personio uniquement, entités externes désactivées),
`@anthropic-ai/sdk`, `@prisma/client`, `fastify`, `@fastify/cors`, `next`,
`react`.

---

## Signaler une vulnérabilité

Ce dépôt est un projet personnel. Pour signaler un problème de sécurité,
ouvrir une issue **sans détail exploitable** et demander un canal privé.
