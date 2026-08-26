# Module — Modèle de langage

Couche d'abstraction BYOK, **désactivée par défaut**.

## Le produit fonctionne sans

Ce n'est pas une nuance d'implémentation. Scoring, déduplication, détection
d'offres douteuses, analyse d'écart de mots-clés, génération de CV et de
lettres, préparation d'entretien : tout est déterministe et fonctionne avec
`LLM_PROVIDER=none`.

Un utilisateur sans clé — ou qui refuse d'envoyer ses données — dispose de la
fonctionnalité complète, pas d'un bouton grisé.

## Fournisseurs

| Fournisseur              | Local | Clé | Consentement    |
| ------------------------ | ----- | --- | --------------- |
| `none` (défaut)          | —     | —   | —               |
| `ollama`                 | oui   | non | **non demandé** |
| `anthropic`              | non   | oui | requis          |
| `openai` (ou compatible) | non   | oui | requis          |

Ollama ne demande pas de consentement : rien ne quitte la machine, l'exiger
serait du théâtre. `local: true` remonte jusqu'à l'interface pour que
l'utilisateur voie, à chaque appel, si ses données sont sorties.

Le fournisseur compatible OpenAI passe par HTTP direct : le point d'accès
`/v1/chat/completions` est stable depuis des années et implémenté à
l'identique par de nombreux services (Groq, Together, vLLM, LM Studio). Un
changement d'URL suffit à en changer.

Anthropic passe par le SDK officiel : il porte les réessais, les classes
d'erreur typées et le suivi des évolutions de l'API. Les réimplémenter serait
une dette permanente pour un gain nul.

## La passerelle est le seul chemin

Aucun module applicatif n'appelle un fournisseur directement. Quatre contrôles
s'appliquent donc à **chaque** appel, sans exception possible par oubli :

1. **Fournisseur actif ?** `none` par défaut.
2. **Consentement donné ?** Distinct de la configuration : posséder une clé ne
   vaut pas accord pour transmettre ses données. Changer de fournisseur le
   réinitialise.
3. **Aucune donnée identifiante ?** Contrôle mécanique de la charge utile
   contre le profil réel. Appliqué aussi en local : il coûte quelques
   microsecondes et empêche une habitude dangereuse de s'installer.
4. **Taille bornée ?** Contre l'envoi massif accidentel.

Aucun repli silencieux : si le fournisseur local échoue, l'appel échoue.

## Ce qui part, ce qui reste

| Transmis                            | Jamais transmis                           |
| ----------------------------------- | ----------------------------------------- |
| Offre (publique)                    | Nom, courriel, téléphone, adresse         |
| Réalisations, compétences, diplômes | Réponses aux questions sensibles          |
| Région (« Québec, CA »)             | Prétentions salariales                    |
| —                                   | Noms d'employeurs, sauf demande explicite |

Le profil est pseudonymisé : `LE_CANDIDAT`, `ENTREPRISE_1`, `ENTREPRISE_2`.
Les identités réelles sont réinjectées localement, après la réponse.

## Audit

Chaque appel émet un événement portant l'usage, le fournisseur, le modèle, les
compteurs de jetons et la durée. **Jamais le prompt** : un journal qui
contient les prompts est une copie intégrale du profil sous un autre nom.

## Usages autorisés

Liste fermée (`LLM_PURPOSES`) : questions d'entretien, retour sur une réponse,
reformulation de puce, brouillon de lettre, résumé d'offre.

Elle sert de documentation exhaustive de ce pour quoi Boussole peut appeler un
modèle, et rend visible en revue de code tout nouvel usage introduit.

## Préparation d'entretien

Le socle est **entièrement déterministe** : questions dérivées des exigences
réelles de l'offre et des écarts réels du profil, questions à poser au
recruteur déduites de ce que l'annonce ne dit pas, points de vigilance, trame
STAR rappelée mais jamais remplie à la place du candidat.

Le modèle ne fait qu'_enrichir_ ce socle. S'il est absent, refusé ou en panne,
la préparation est renvoyée avec la raison — jamais une page vide.
