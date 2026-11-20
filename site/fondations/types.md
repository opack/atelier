# Types de chantier

Cinq types, pas plus. Le type choisit le template de spec, les questions posées et les étapes.

## FEAT : fonctionnalité

Une fonctionnalité à créer ou à améliorer, avec un **impact utilisateur**.

- **Étapes** : toutes. Conception obligatoire.
- **Spec** : contexte, description, critères d’acceptation, non-fonctionnel (sécurité, performance, accessibilité, données personnelles).
- **TDD** : souvent oui.

## FIX : correction

Un bug à corriger, signalé par Sentry, un utilisateur ou une issue.

- **Étapes** : en [voie rapide](../cycle/correction), sans conception.
- **Spec** courte : problème, reproduction, cause probable **avec sa preuve**, solution, critère de non-régression.
- **TDD** : souvent oui, avec un test qui reproduit le bug.

## REF : refactor

Une restructuration du code, **sans changement de comportement**.

- **Étapes** : toutes. Conception obligatoire.
- **Spec** : périmètre, pourquoi maintenant, état cible, preuve de non-régression, stratégie, critère de fin.
- **TDD** : quand c’est oui, ce sont des **tests de caractérisation**, qui figent le comportement actuel et doivent passer avant le refactor.

::: warning Règle d’or
Si le comportement change, ce n’est pas un REF : c’est un FEAT ou un FIX.
:::

## TEC : chantier technique

Sans impact utilisateur direct : CI, outillage, dépendances, configuration (ESLint…), sécurité, infra, migration de données.

- **Étapes** : spec, signature, implémentation, clôture. Conception si le chantier est gros.
- **Spec** : quoi, pourquoi, vérification. Pour une **petite maintenance**, ces trois lignes suffisent.
- **TDD** : souvent non.

Une petite maintenance est un `TEC` avec une spec de trois lignes, jamais un chantier sans spec : on veut toujours savoir **pourquoi** la règle ESLint a changé.

## SPIKE : exploration

Une exploration **bornée dans le temps** pour répondre à une question.

- **Spec** : la question, pourquoi, le budget de temps, ce qui compte comme réponse.
- **Code jetable, jamais fusionné.** Le livrable est une réponse dans le bilan, puis selon le cas une décision, un nouveau chantier ou l’abandon.

## Pourquoi pas plus de types ?

Chaque type supplémentaire ajoute un template, des questions et des règles à retenir. Cinq types couvrent la quasi-totalité des cas. Le contenu (marketing, textes) qui n’est pas du code reste hors d’atelier.
