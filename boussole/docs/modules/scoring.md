# Module — Scoring

Évalue la compatibilité entre une offre et un profil. Déterministe, gratuit,
explicable.

## Les neuf critères

| Critère                 | Poids | Évaluable si                                               |
| ----------------------- | ----- | ---------------------------------------------------------- |
| Alignement du poste     | 0,18  | Le profil a des intitulés cibles ou une expérience         |
| Compétences exigées     | 0,26  | L'offre a des exigences identifiables                      |
| Compétences souhaitées  | 0,08  | L'offre mentionne des compétences non exigées              |
| Niveau de séniorité     | 0,12  | Le niveau est déterminable **et** un niveau cible existe   |
| Localisation            | 0,10  | L'offre a un lieu **et** le profil des préférences         |
| Mode de travail         | 0,08  | Le mode est déterminable                                   |
| Rémunération            | 0,10  | L'offre publie un salaire **et** le profil des prétentions |
| Secteur                 | 0,04  | Le profil a des secteurs cibles                            |
| Profondeur d'expérience | 0,04  | Les années sont déclarées sur les compétences demandées    |

## Les trois propriétés à préserver

### Explicable

Chaque critère produit sa note, son poids et une phrase en français. Un score
sans justification est inutilisable pour décider où investir son temps — et
un score qu'on ne peut pas contester finit par ne plus être cru.

### Honnête sur l'inconnu

Un critère non évaluable est **retiré du calcul**, jamais compté zéro.
Compter zéro pénaliserait les offres discrètes, pas les mauvaises offres :
une entreprise qui ne publie pas ses salaires n'est pas un mauvais employeur.

**En contrepartie, le score est plafonné** selon le nombre de critères
réellement évaluables : moins de quatre plafonne à 60, moins de six à 78.

Cette contrepartie n'est pas théorique. Sans elle, une offre fantôme sans
exigence, sans salaire et sans lieu obtenait 83/100 et se retrouvait
recommandée en priorité — elle ne pouvait échouer nulle part, et un intitulé
bien aligné suffisait. Un avertissement ne suffisait pas : c'est le score qui
pilote le tri, et personne ne lit l'avertissement d'une offre classée
première.

### Gratuit

Aucun appel réseau, aucun modèle. Le scoring s'exécute sur des milliers
d'offres en quelques secondes, sans coût et sans transmettre quoi que ce soit.

## Filtres déterministes

Appliqués avant tout calcul : entreprise exclue, intitulé exclu, offre
expirée, mode de travail hors préférences. Une offre écartée obtient 0 et la
raison est affichée — inutile de scorer ce que le candidat a explicitement
exclu.

## Décisions

| Décision                            | Seuil            |
| ----------------------------------- | ---------------- |
| Prioritaire — générer les documents | ≥ 82             |
| Shortlist                           | ≥ 70             |
| À considérer                        | ≥ 45             |
| Écartée                             | < 45 ou bloquant |

## Le score fantôme n'écarte jamais

Un score ≥ 55 produit un avertissement et une pénalité modérée de 8 points.
Il ne disqualifie pas : c'est un **signal faible**, et une offre peut cocher
plusieurs cases tout en étant parfaitement légitime — une PME qui recrute en
continu, un poste réellement difficile à pourvoir.

L'interface affiche « signaux », jamais « offre fantôme », et le détail reste
consultable pour que l'utilisateur puisse contester.

## Analyse d'écart de mots-clés

Quatre statuts, et **un seul autorise une action sur le CV** :

| Statut            | Ce que Boussole peut faire                      |
| ----------------- | ----------------------------------------------- |
| `matched`         | Rien                                            |
| `missing_from_cv` | Faire ressortir — l'affirmation reste vraie     |
| `transferable`    | **Rien dans le CV** — une phrase pour la lettre |
| `not_in_profile`  | **Rien** — signalé comme écart réel             |

Cette séparation est la barrière anti-hallucination du produit. Seule la liste
`safeToAdd` est transmise à la forge documentaire ; `realGaps` ne l'atteint
jamais, et `transferable` en fait partie.

### Compétences voisines

`transferable` n'est pas un adoucissement de `not_in_profile` : c'est un
sous-cas documenté. Le problème qu'il résout : « Kubernetes exigé, absent du
profil » était classé exactement comme « SAP exigé, absent du profil ». Pour
quelqu'un qui opère des conteneurs sur ECS depuis trois ans, c'est faux — et
c'est une occasion perdue à chaque candidature.

Les groupes de voisinage (`adjacency.ts`) sont curatés selon un critère
strict : deux compétences ne sont voisines que si quelqu'un qui maîtrise l'une
devient productif sur l'autre en quelques semaines, sans repartir de zéro
conceptuellement.

Une exigence approchée compte pour **la moitié** dans la couverture. Compter
plein ferait passer un candidat sans Kubernetes pour un candidat avec
Kubernetes ; compter zéro nierait trois ans de conteneurs.

La phrase produite pour la lettre nomme la compétence possédée **et** l'écart,
en un seul bloc indissociable. Voir [forge documentaire](documents.md).

Une offre sans exigence identifiable retourne une couverture de 0, pas de 1 :
on ne sait rien, ce n'est pas une adéquation parfaite.

## Les scores sont stockés

Plutôt que recalculés à chaque affichage. Ce n'est pas une optimisation : un
score dépend du profil au moment du calcul, et l'utilisateur doit pouvoir
constater qu'une offre a changé de note après une mise à jour de son profil.
Recalculer silencieusement effacerait cette information.
