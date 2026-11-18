# Principes

Neuf principes guident atelier. Quand une situation n’est pas prévue par ce site, revenez à eux.

## 1. Aucun agent n’est fiable par défaut

On **contraint** ce que l’agent peut faire, on **vérifie** ce qu’il produit, et l’**autorité** (signer, accepter, fusionner) reste hors de la boucle qui génère. Ce n’est pas de la défiance : c’est la même règle que pour une dépendance externe.

## 2. L’intention est signée avant la production

Pas de code sans spec signée par un humain. Les critères d’acceptation portent des identifiants (`CA-1`, `CA-2`…) réutilisés dans les tests.

## 3. Chaque transition a une porte

Un contrôle **automatique** (types, lint, tests, complétude d’un document) et, quand le jugement ne se délègue pas, une **validation humaine**.

## 4. Deux niveaux de gouvernance

Un **socle commun** à tous vos projets (stack, décisions transverses, politique de test, sécurité), dont chaque **projet** hérite et qu’il complète. Voir [Deux niveaux de gouvernance](../projet/gouvernance).

## 5. La trace est produite avec le logiciel

Intention → décision → exécution → verdict restent liés et versionnés. Le prochain changement part d’un système inspectable.

## 6. Historiser, ne pas réécrire

Une spec signée ou une décision ne s’écrase pas : on l’**amende** avec une entrée datée. Git fait le reste.

## 7. Des contrats exécutables plutôt que de la prose

Une règle qui peut devenir un test, une règle de lint ou un schéma doit le devenir. Le `CLAUDE.md` ne garde que ce qu’une machine ne peut pas vérifier.

## 8. Mesurer les contrôles, pas le volume

Ce qui compte : combien d’artefacts générés ont été rejetés ou corrigés, et à quelle porte. Pas le nombre de lignes produites.

## 9. La vitesse vient de specs courtes, pas du contournement

Un petit chantier a une spec de quelques lignes, **jamais zéro** : le *pourquoi* est toujours tracé.

::: info Ce qu’atelier ne reprend pas
Machine à états, orchestrateur, magasin d’artefacts immuable, exécution en vagues : utiles à l’échelle industrielle, de la sur-ingénierie pour un développeur ou une petite équipe. Des fichiers Markdown versionnés couvrent l’essentiel.
:::
