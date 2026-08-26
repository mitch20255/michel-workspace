# Module — CRM

Suit vos candidatures. Onze colonnes, transitions validées, aucune soumission
automatique.

## Colonnes

`À examiner` → `Shortlist` → `Documents générés` → `Prêt à candidater` →
`Candidature soumise` → `Relance prévue` → `Entretien` → `Test technique` →
`Offre`, plus `Rejet` et `Archivé`.

L'ordre du tableau est significatif : il sert à l'affichage et à détecter les
régressions de pipeline — revenir d'`Entretien` à `Shortlist` est un
événement notable.

## Transitions validées

Le CRM refuse les mouvements absurdes — passer d'`À examiner` directement à
`Offre` — pour que ses statistiques restent interprétables. Un taux de
conversion calculé sur des sauts arbitraires ne veut rien dire.

`Rejet` et `Archivé` restent atteignables depuis n'importe quelle étape : une
candidature peut mourir à tout moment.

L'interface ne propose que des transitions que l'API acceptera ; l'API reste
l'autorité.

## Aucune soumission automatique

Le passage à `Candidature soumise` est un bouton que l'utilisateur clique.
Aucune route ne le déclenche automatiquement, et `appliedAt` n'est renseigné
qu'à ce moment-là.

C'est la garantie centrale du produit, et elle est couverte par un test
d'intégration.

## Copie de l'offre

Une copie complète de l'offre est enregistrée au moment où la candidature est
créée. Les ATS retirent leurs annonces ; sans copie locale, le contexte de sa
propre candidature disparaît — impossible de relire ce à quoi on a postulé
avant un entretien.

L'offre elle-même n'est jamais supprimée non plus : elle passe à `inactive` et
l'interface signale « annonce retirée » sur la carte.

## Historique

Chaque changement d'étape crée un événement horodaté, avec l'étape d'origine,
l'étape d'arrivée et l'auteur (`user` ou `system`). Un CRM sans historique ne
répond ni à « quand ai-je postulé ? » ni à « depuis combien de temps est-ce
sans nouvelles ? », qui sont les deux questions qu'on lui pose.

## Statistiques

Les taux sont calculés sur les candidatures **réellement soumises**, pas sur
le total. Rapporter les entretiens à toutes les offres suivies inclurait celles
jamais envoyées et produirait un taux artificiellement bas.

Sans candidature soumise, le taux vaut `null` et l'interface affiche « — » :
un taux calculé sur zéro n'est pas zéro, il n'existe pas.
