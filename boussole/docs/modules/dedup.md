# Module — Déduplication

Évite qu'une même offre apparaisse cinq fois dans le CRM.

## Deux empreintes, pas une

| Empreinte     | Change quand                                    | Sert à                    |
| ------------- | ----------------------------------------------- | ------------------------- |
| `contentHash` | Un mot de la description change                 | Détecter une modification |
| `identityKey` | Entreprise, titre, département ou lieu changent | Reconnaître la même offre |

Une empreinte unique ne peut pas remplir les deux rôles : détecter les
changements exige la sensibilité, reconnaître une republication exige la
stabilité.

`identityKey` est composée **exclusivement de champs structurés**. Une version
antérieure y ajoutait un « noyau lexical » extrait de la description — les N
tokens les plus significatifs, triés. C'était instable : ajouter une phrase
introduit des tokens qui déplacent la fenêtre de troncature, et l'empreinte
change, exactement ce qu'elle doit éviter. Toute heuristique de sélection de
tokens souffre du même défaut à des degrés divers.

Contrepartie assumée : deux postes réellement distincts partageant entreprise,
titre, département et lieu seront confondus. Le département réduit fortement
ce risque, et la fusion reste réversible. Le bon compromis : un doublon manqué
pollue le CRM à chaque ingestion, une fusion excessive se corrige en un clic.

## Cascade, du moins cher au plus cher

1. Même source **et** même identifiant source → identité certaine, aucun calcul.
2. Même `identityKey` → identité quasi certaine.
3. Même clé de blocage → comparaison fine.
4. Aucune clé commune → jamais comparées.

L'étape 3 est la seule coûteuse, et le blocage la borne : sans lui, 5 000
offres feraient 12,5 millions de comparaisons.

## Comparaison fine

Quatre mesures pondérées : titre (0,40), entreprise (0,25), description (0,25),
localisation (0,10).

Le titre domine parce que c'est le seul champ toujours présent et toujours
discriminant. Une donnée absente ne pénalise pas : son poids est **redistribué**
sur les autres critères plutôt que compté zéro.

Deux mesures complémentaires sur le titre — Jaro-Winkler rattrape les variantes
courtes, les trigrammes rattrapent les réordonnancements de mots.

| Score       | Conséquence                                                |
| ----------- | ---------------------------------------------------------- |
| ≥ 0,86      | Regroupées automatiquement                                 |
| 0,72 – 0,86 | Signalées pour revue humaine, **jamais fusionnées seules** |
| < 0,72      | Offres distinctes                                          |

## Regroupement transitif

Union-find : si A ≡ B et B ≡ C, les trois forment un seul groupe. C'est le
comportement attendu pour des republications successives.

La plus petite identifiante devient la racine, pour que les groupes restent
stables entre deux exécutions — sans quoi chaque ingestion réécrirait toute la
table.

Le recalcul porte sur **l'ensemble du corpus**, jamais en incrémental : une
offre nouvelle peut relier deux groupes existants, et un rapprochement
incrémental produirait des groupes différents selon l'ordre d'arrivée.

## Offre représentante

Celle qui a la description la plus complète, puis la plus récemment vue. On
garde la plus informative, pas la plus ancienne.

Les groupes à un seul membre ne sont pas matérialisés : créer une ligne par
offre unique gonflerait la table sans rien apporter.
