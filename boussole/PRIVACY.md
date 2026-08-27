# Vie privée

Boussole s'exécute sur votre machine. Il n'y a pas de service central, pas de
compte à créer, pas de télémétrie. Vos données restent dans votre base
PostgreSQL et vos fichiers.

Ce document décrit précisément ce qui est stocké, ce qui peut sortir, et
comment tout récupérer ou tout effacer.

---

## Ce qui est stocké

### Vous appartient

| Donnée                           | Chiffrée | Pourquoi elle existe                        |
| -------------------------------- | -------- | ------------------------------------------- |
| Identité, titre, résumé          | Non      | Figurent sur le CV généré                   |
| Courriel, téléphone, adresse     | **Oui**  | Coordonnées du CV ; identifient directement |
| Ville / région / pays            | Non      | Nécessaires au scoring de localisation      |
| Expériences, projets, formations | Non      | Seul matériau autorisé des documents        |
| Compétences, langues, liens      | Non      | Base du scoring et de l'écart de mots-clés  |
| Préférences et prétentions       | Non      | Pilotent le scoring                         |
| Réponses aux questions sensibles | **Oui**  | Autorisation de travail, EEO, salaire…      |
| Candidatures, notes, rappels     | Non      | Votre CRM                                   |
| Documents générés                | Non      | Trace de ce qui a été envoyé                |
| Puces réécrites (avant/après)    | Non      | Pièce justificative de chaque reformulation |
| Clé API du modèle                | **Oui**  | Vous appartient                             |
| Journal d'audit                  | Non      | Ne contient aucune valeur sensible          |

Le raisonnement derrière le chiffrement sélectif est dans
[`SECURITY.md`](SECURITY.md).

### N'appartient à personne

Les offres d'emploi sont publiques. Elles ne sont rattachées à aucun compte et
survivent à la suppression de votre profil — ce qui est personnel (score,
candidature, notes, documents) est rattaché à vous et disparaît avec vous.

---

## Ce qui sort de votre machine

### Vers les ATS, à l'ingestion

Une requête HTTP GET vers une API publique et documentée. Elle contient
uniquement l'identifiant du tableau d'offres et un User-Agent identifiant.
**Aucune donnée vous concernant n'est transmise.** Les ATS ne peuvent pas
savoir qui consulte.

Vous pouvez personnaliser le User-Agent (`INGEST_USER_AGENT`) pour y mettre un
contact ; c'est un usage courant et poli, mais cela vous rend identifiable
auprès des ATS. À vous de choisir.

### Vers un fournisseur de modèle, si vous en activez un

**Par défaut, jamais.** Le fournisseur est `none` et toutes les fonctions
principales sont déterministes.

Si vous activez un fournisseur **local** (Ollama), rien ne quitte la machine.

Si vous activez un fournisseur **distant**, voici exactement ce qui part :

| Transmis                                                   | Non transmis                                     |
| ---------------------------------------------------------- | ------------------------------------------------ |
| Intitulé, entreprise et description de l'offre (publiques) | Votre nom                                        |
| Vos réalisations, reformulées ou non                       | Votre courriel, téléphone, adresse               |
| Vos compétences et niveaux                                 | Vos réponses aux questions sensibles             |
| Vos diplômes et certifications                             | Vos prétentions salariales                       |
| Votre région (« Québec, CA »)                              | Votre adresse précise                            |
| —                                                          | Le nom de vos employeurs, sauf demande explicite |

Le profil est pseudonymisé avant l'envoi : vous y êtes `LE_CANDIDAT`, vos
employeurs `ENTREPRISE_1`, `ENTREPRISE_2`. Un contrôle mécanique bloque la
requête si une donnée identifiante s'y trouve malgré tout.

Le consentement est **distinct de la configuration** : enregistrer une clé ne
vaut pas accord pour transmettre vos données. Changer de fournisseur
réinitialise le consentement.

### Nulle part ailleurs

Aucune télémétrie, aucun rapport d'erreur automatique, aucune analyse d'usage,
aucune police ni ressource distante dans l'interface.

---

## Vos données restent les vôtres

### Tout récupérer

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
     http://127.0.0.1:4000/profile/export > mes-donnees.json
```

JSON complet et déchiffré : profils, candidatures, notes, événements,
rappels, documents en texte, sources et journal d'audit. Aucun format
propriétaire, aucun outil requis pour le relire.

Les PDF générés sont dans `STORAGE_DIR` — de simples fichiers.

### Tout effacer

```bash
curl -X POST -H "Authorization: Bearer $API_TOKEN" \
     -H "content-type: application/json" \
     -d '{"confirm":"SUPPRIMER"}' \
     http://127.0.0.1:4000/profile/purge
```

La confirmation littérale est exigée : un simple `DELETE` ne suffit pas à
établir l'intention pour une opération irréversible.

Sont supprimés : profil, réponses sensibles, candidatures, notes, événements,
rappels, documents, sources, paramètres et journal d'audit. L'entrée d'audit
correspondante est écrite **avant** la suppression — après, elle disparaîtrait
avec le reste et l'opération ne laisserait aucune trace.

Les offres, publiques, ne sont pas touchées. Les PDF déjà écrits sur disque
sont à supprimer manuellement : Boussole ne supprime pas de fichiers qu'il
n'a pas créés dans la même opération.

---

## Questions sensibles

Certaines réponses ont des conséquences légales ou peuvent servir à
discriminer : autorisation de travail, besoin de parrainage, handicap, genre,
origine, statut de vétéran, données EEO, prétentions salariales,
disponibilité, adresse exacte, antécédents judiciaires, consentements légaux.

Trois états seulement, et **aucune valeur n'est jamais devinée** :

- **répondu** — vous avez fourni la réponse exacte, réutilisable telle quelle ;
- **à renseigner** — aucune réponse enregistrée ; l'assistant s'arrête et vous
  demande, il ne remplit rien ;
- **refus de répondre** — jamais pré-rempli.

Une réponse marquée « répondu » mais vide retombe automatiquement sur « à
renseigner » : une chaîne vide ne doit pas pouvoir se glisser dans un
formulaire d'employeur.

Ces valeurs sont chiffrées, ne sont jamais renvoyées par l'interface (seul
leur état l'est), et ne sont **jamais** transmises à un modèle de langage,
quelle que soit la configuration.

---

## Ce que Boussole ne fera pas

- soumettre une candidature à votre place ;
- écrire dans un document une compétence, un diplôme, une certification, une
  durée ou un chiffre absent de votre profil ;
- envoyer un courriel à un employeur ;
- stocker vos identifiants LinkedIn, Indeed ou d'un site d'emploi ;
- contourner une protection anti-robot ;
- transmettre vos données à un tiers sans consentement explicite.
