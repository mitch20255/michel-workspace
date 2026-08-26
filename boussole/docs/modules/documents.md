# Module — Forge documentaire

Produit des CV et lettres ciblés, lisibles par un ATS, sans jamais rien
inventer.

## Chaîne de production

```
profil + offre ──► sélection ──► gabarit Typst ──► vérification ──► PDF
                       │                                │
                       │                                └─ échec ⇒ rien n'est produit
                       └─ ne modifie jamais le texte d'une puce
```

La **vérification précède la compilation**, délibérément : un document qui
échoue aux garde-fous ne doit jamais exister sous forme de PDF, même dans un
dossier temporaire. Un fichier produit finit toujours par être envoyé.

## Garde-fous

`verifyDocument` contrôle mécaniquement que tout fait affirmé existe dans le
profil :

| Contrôle       | Refuse                                                     |
| -------------- | ---------------------------------------------------------- |
| Compétences    | Un terme technique absent du profil et de la liste blanche |
| Certifications | Une certification ou un diplôme non enregistré             |
| Employeurs     | Un employeur cité mais absent du parcours                  |
| Chiffres       | Un résultat chiffré introuvable dans le profil             |

Ces contrôles sont **déterministes et hors LLM**. Ils s'appliquent
identiquement à un texte assemblé par le code et à un texte écrit par un
modèle — c'est précisément ce qui permettra d'ajouter la reformulation par
modèle en V1 sans affaiblir la garantie.

Cas réel couvert par un test : une certification écrite dans le résumé libre
mais non enregistrée dans la liste des certifications est refusée. Le résumé
fait partie du profil, mais rien ne distinguerait alors une qualification
réelle d'une formule d'affichage.

## Sélection, pas réécriture

Le module choisit **quelles** expériences, quels projets et quelles puces
retenir, et dans quel ordre. Il ne modifie **jamais** le texte d'une puce.

Sélectionner et réordonner sont des opérations honnêtes ; réécrire ne l'est
qu'encadré. La reformulation par modèle est prévue en V1, sous les mêmes
garde-fous et avec relecture humaine obligatoire.

Deux règles d'affichage :

- l'ordre final est antichronologique, pas par pertinence : un CV trié par
  score déroute le lecteur ;
- un diplôme non terminé est signalé comme tel, jamais présenté comme obtenu.

## Extractibilité ATS

Chaque décision de mise en page découle de la façon dont un ATS lit un PDF :

| Décision                              | Raison                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Une seule colonne                     | Une mise en page à deux colonnes est extraite dans le désordre — première cause de CV illisibles |
| Aucun tableau de mise en page         | Certains extracteurs sérialisent les cellules ligne par ligne, d'autres colonne par colonne      |
| Pas d'en-tête ni de pied de page      | De nombreux extracteurs les ignorent : les coordonnées y disparaîtraient                         |
| Aucune icône                          | Elles ressortent en caractères parasites dans le texte extrait                                   |
| Libellés de section en toutes lettres | Les ATS les reconnaissent par correspondance                                                     |
| Listes natives                        | Le PDF porte alors une vraie structure de liste                                                  |
| Polices standards avec repli          | Une police absente produit des caractères manquants                                              |

Ces choix sont **vérifiés, pas supposés** : un test compile réellement le PDF,
en réextrait le texte avec une bibliothèque tierce — un chemin totalement
différent de celui qui l'a produit — et compare contenu, caractères
techniques (`C#`, `C++`) et ordre de lecture.

## Échappement Typst

Indispensable et facile à sous-estimer. Les puces d'un CV contiennent
régulièrement `#`, `*`, `_`, `@` ou `$` — « C# », « 20 % → 5 $ »,
« @entreprise ». Non échappés, ils sont interprétés comme de la syntaxe
Typst : au mieux la compilation casse, au pire le texte du CV envoyé à
l'employeur est silencieusement modifié.

## Sans Typst

L'absence du binaire est un mode dégradé assumé, pas une erreur. La source
`.typ` et le texte extractible sont produits quand même, et la raison est
renvoyée. Le candidat garde un document exploitable et un message clair, au
lieu d'une erreur opaque au pire moment.

## Versions

Chaque génération crée une **nouvelle ligne**. Un document déjà envoyé n'est
jamais écrasé : savoir exactement quel CV a été transmis à quel employeur est
indispensable en entretien, et une version écrasée est définitivement perdue.

Sont conservés la source Typst (pour reproduire à l'identique), le texte
extractible, les mots-clés effectivement mis en avant et une empreinte du
profil au moment de la génération — qui permet de détecter qu'un document ne
reflète plus le profil courant.
