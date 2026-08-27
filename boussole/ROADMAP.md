# Feuille de route

Ordre directeur : **les garanties d'abord, la fluidité ensuite.** Une
fonctionnalité qui fait gagner du temps mais permet d'envoyer une information
fausse à un employeur coûte plus cher qu'elle ne rapporte.

---

## V0 — Fondations · fait

- Monorepo pnpm, TypeScript strict, ESLint, Prettier, Vitest.
- Postgres 16 + pgvector, Redis, `docker-compose` de développement.
- Domaine pur, sans I/O ni état global.
- Chiffrement AES-256-GCM, masquage des PII, journal d'audit.

## MVP · fait

Utilisable de bout en bout aujourd'hui.

- **Profil candidat** structuré, avec réponses sensibles chiffrées et à trois
  états.
- **Ingestion** depuis Greenhouse, Lever, Ashby et Personio, via API publiques
  et à un rythme mesuré.
- **Normalisation** : HTML → texte, sections, compétences, salaire,
  localisation, séniorité, langue fr/en.
- **Déduplication** : empreintes stables, blocage, regroupement transitif,
  seuil de revue humaine pour les cas ambigus.
- **Score d'offre fantôme** : signaux pondérés et explicables.
- **Scoring de compatibilité** : neuf critères, chacun justifié en français,
  poids redistribué pour les critères non évaluables, score plafonné quand
  l'offre est trop peu documentée.
- **Écart de mots-clés** séparant strictement « déjà au profil » de « absent ».
- **Forge documentaire** Typst avec garde-fous anti-invention et
  extractibilité ATS vérifiée par réextraction du PDF.
- **Cadran d'impact** à trois niveaux, de la reprise mot pour mot au retrait
  des atténuateurs de rôle. Aucun niveau ne peut introduire un fait :
  l'invariant est vérifié à chaque puce. L'avant/après est affiché avant envoi.
- **Compétences transférables** : une exigence approchée par une compétence
  voisine produit une phrase honnête pour la lettre, jamais une ligne de CV.
- **CRM Kanban** à onze colonnes, transitions validées, aucune soumission
  automatique.
- **Préparation d'entretien** entièrement fonctionnelle sans modèle.
- **Passerelle LLM** BYOK, désactivée par défaut.
- **Interface** en français : sept écrans.
- 423 tests, dont 34 d'intégration sur une vraie base.

---

## V1 — Robustesse et confort

**Ingestion planifiée.** Files Redis/BullMQ, déjà présentes dans le
`docker-compose`. L'ingestion est aujourd'hui synchrone parce qu'une source
publie quelques dizaines à quelques centaines d'offres, ce qui tient dans une
requête HTTP. Elle deviendra asynchrone quand elle sera planifiée.

**Éditeur de profil par sections.** L'éditeur JSON actuel est un compromis
assumé : le modèle de données est complet, c'est l'interface qui manque. Le
travail est réel — quelques dizaines de champs imbriqués — mais sans risque.

**Reformulation par modèle, sous garde-fous.** La réécriture actuelle est
déterministe et bornée : elle supprime et permute, elle ne rédige pas. Un
modèle pourrait produire des formulations que ces règles n'atteignent pas —
notamment sur les puces dont la structure ne correspond à aucun motif connu.
Il passera par `verifyDocument` **et** par `assertNoNewFacts`, exactement
comme le texte assemblé par le code : c'est précisément pour cela que les deux
contrôles sont déterministes et hors LLM. Relecture humaine obligatoire avant
tout envoi.

**Voisinages de compétences élargis.** La table d'adjacence est curatée à la
main, donc courte et fiable. L'étendre suppose un critère d'admission tenu :
deux compétences ne sont voisines que si le transfert est réel en quelques
semaines. Une table laxiste produirait des passerelles ridicules en entretien.

**Recherche sémantique.** pgvector est déjà installé. À n'activer que si le
recouvrement lexical montre ses limites sur un corpus réel : une dépendance
supplémentaire doit répondre à un problème constaté, pas anticipé.

**Analyses.** Taux de réponse par source, par secteur, par score initial —
pour répondre à « où mon temps est-il le mieux investi ? ».

**Pondérations éditables** depuis l'interface. Quelqu'un qui déménage ne
pondère pas la localisation comme quelqu'un qui a un bail.

---

## V2 — Modules assistés

**Extension navigateur.** Repoussée délibérément après les garanties. Contrat
non négociable : aucune soumission automatique, arrêt sur tout champ sensible
non renseigné, résumé avant envoi, journal local des actions, désactivation
possible à tout moment. Une extension qui remplit des formulaires sans ces
garanties est exactement l'outil que ce projet refuse d'être.

**Brouillons de prospection.** Génération de brouillons, jamais d'envoi.
Aucune séquence automatique opaque, aucun envoi massif. La valeur est dans le
brouillon personnalisé, pas dans le volume.

**Rappels avancés** et intégrations calendrier/courriel, sous consentement
explicite et révocable.

---

## V3 — Au-delà

Simulation d'entretien vocale, multi-profils, collaboration avec un conseiller
en emploi, mode SaaS. Chacun de ces chantiers suppose de vrais comptes et une
revue de sécurité complète.

---

## Écarté, et pourquoi

**Connecteur Workday.** Pas d'API publique : un locataire par client, des
points d'accès internes non documentés dont la forme change sans préavis. Un
tel connecteur serait du scraping fragile déguisé. Les offres hébergées sur
Workday restent ajoutables à la main. À réévaluer si Workday publie une API
de tableau d'offres stable.

**Scraping de LinkedIn et Indeed.** Interdit par leurs conditions
d'utilisation, protégé par des mécanismes anti-robot que ce projet ne
contournera pas, et supposerait de stocker vos identifiants.

**Soumission automatique de candidatures.** Ce n'est pas une question de
difficulté technique. Un outil qui postule à votre place produit du volume,
pas des entretiens, et engage votre nom sur des réponses que vous n'avez pas
lues.

**Envoi massif de courriels.** Même raisonnement, avec en plus des questions
de conformité anti-pourriel.
