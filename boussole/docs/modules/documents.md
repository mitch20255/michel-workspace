# Module — Forge documentaire

Produit des CV et lettres ciblés, lisibles par un ATS, sans jamais rien
inventer.

## Chaîne de production

```
profil + offre ──► sélection ──► réécriture ──► gabarit Typst ──► vérification ──► PDF
                       │             │                                  │
                       │             │                                  └─ échec ⇒ rien n'est produit
                       │             └─ ne peut que supprimer et permuter
                       └─ choisit quoi montrer, jamais quoi dire
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

## Sélection

Le module choisit **quelles** expériences, quels projets et quelles puces
retenir, et dans quel ordre. La sélection ne touche pas au texte : c'est la
couche de réécriture, ci-dessous, qui le fait — et seulement dans les limites
qu'elle s'impose.

Deux règles d'affichage :

- l'ordre final est antichronologique, pas par pertinence : un CV trié par
  score déroute le lecteur ;
- un diplôme non terminé est signalé comme tel, jamais présenté comme obtenu.

## Le cadran d'impact

La plupart des gens se sous-vendent dans la forme, pas dans le fond.
« Participé à la migration de l'infrastructure, réduisant les coûts de 30 % »
contient un excellent résultat, enterré derrière un verbe d'excuse et rejeté
en fin de phrase. Un recruteur qui balaie six secondes par CV ne le verra pas.

Trois niveaux, choisis par l'utilisateur dans les paramètres :

| Niveau      | Ce qu'il fait                                                | Ce qu'il déplace                      |
| ----------- | ------------------------------------------------------------ | ------------------------------------- |
| `factual`   | Rien. Texte du profil mot pour mot                           | —                                     |
| `confident` | Résultat en tête, remplissage retiré, vocabulaire de l'offre | Rien : aucune affirmation ne change   |
| `assertive` | Retire en plus les atténuateurs de rôle                      | **La portée** de ce que vous affirmez |

`confident` est le défaut. Ses transformations sont des permutations et des
suppressions de formules creuses : « dans le cadre de mes fonctions »
n'affirmait rien, et hisser le résultat en tête ne change pas ce qui est dit.

`assertive` déplace réellement quelque chose : « participé à la refonte »
devient « refonte ». Le fait reste vrai — vous y avez bien travaillé — mais
votre part n'est plus bornée par la phrase. C'est un choix légitime, et c'est
pour cela qu'il est isolé, nommé, et jamais activé par défaut.

### Ce qui rend le niveau offensif défendable

Deux mécanismes, pas une intention :

**Le module ne peut pas inventer.** Ses seules opérations sont supprimer,
permuter, et remplacer un libellé de compétence par un synonyme reconnu comme
désignant la même compétence. `assertNoNewFacts` le vérifie à chaque puce :
tout jeton du texte produit doit exister dans l'original, aux connecteurs
près. Une violation lève une erreur et fait échouer la génération — ce n'est
pas un filet optionnel, c'est ce qui autorise l'affirmation.

Cette contrainte a un coût assumé : les tournures relatives (« ce qui a permis
de… ») ne sont pas déplacées, parce que les déplacer exigerait de reformuler,
donc d'introduire des mots absents. L'invariant passe avant la permutation.

**Rien ne part sans avoir été vu.** Chaque transformation est enregistrée avec
son avant, son après et sa justification. L'écran de l'offre affiche
l'avant/après, et sort du repli les transformations qui déplacent une portée.
Une exagération assumée et relue se défend en entretien ; la même, découverte
au moment où le recruteur la lit à voix haute, ne se défend pas.

Le ton est **conservé par document**. Changer le réglage ne réécrit pas
l'histoire d'un CV déjà envoyé.

## Compétences transférables dans la lettre

L'analyse d'écart distingue « absente du profil » de « absente, mais vous
pratiquez une compétence voisine » (voir [scoring](scoring.md)). Pour la
seconde, la lettre peut porter une phrase que le CV ne portera jamais :

> React en production (interfaces à composants) ; pas encore d'expérience
> professionnelle sur Vue.js.

Les deux moitiés sont indissociables et générées ensemble : impossible de
garder la première en supprimant la seconde. Inverser l'ordre produirait une
phrase d'excuse ; omettre la seconde serait un mensonge par insinuation.

Le garde-fou l'autorise par une exception étroite : une compétence absente du
profil peut être **nommée si elle est niée**, et une seule mention affirmative
ailleurs dans le document annule l'autorisation. La portée d'une négation ne
franchit pas la fin de sa phrase.

Le silence, lui, est la pire option : un recruteur qui ne voit pas Kubernetes
dans le dossier conclut à l'absence totale d'expérience de conteneurs.

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
