# Types de chantier

Six types, pas plus. Le type choisit le template de spec, les questions posées et les étapes.

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

- **Étapes** : spec, signature, implémentation, revue, clôture. Conception si le chantier est gros.
- **Spec** : quoi, pourquoi, vérification. Pour une **petite maintenance**, ces trois lignes suffisent.
- **TDD** : souvent non.

Une petite maintenance est un `TEC` avec une spec de trois lignes, jamais un chantier sans spec : on veut toujours savoir **pourquoi** la règle ESLint a changé.

## SPIKE : exploration

Une exploration **bornée dans le temps** pour répondre à une question.

- **Spec** : la question, pourquoi, le budget de temps, ce qui compte comme réponse.
- **Code jetable, jamais fusionné** : pas de revue obligatoire avant la clôture. Le livrable est une réponse dans le bilan, puis selon le cas une décision, un nouveau chantier ou l’abandon.

## EPIC : ensemble de chantiers

Une vision plus large qu’un chantier, que **plusieurs chantiers rattachés** réalisent : « Module gestion client » se concrétise par « Création client », « Contact client »… L’EPIC n’implémente rien : il pose le cadre commun et suit l’avancement.

- **Étapes** : spec, signature, plan (le découpage), chantiers enfants, clôture.
- **Spec** : vision, pourquoi, critères d’acceptation globaux, cadre fonctionnel et technique commun, hors périmètre.
- **Plan** : les lots prévus, avec leur type, leur ordre et leurs dépendances pressenties. Écrit une fois puis laissé tel quel : les écarts vont dans `decisions.md`, la confrontation prévu / réalisé dans le bilan.
- **TDD** : jamais (`tdd: no` d’office). Aucun code sur sa branche `epic/<ID>-<slug>`, ni revue (sauf la revue d’ensemble d’un [EPIC à branche d’intégration](#epic-a-branche-d-integration)).
- **Clôture** : quand tous ses enfants sont clos et qu’au moins l’un d’eux est `done`. Sinon la vision n’a pas été réalisée : l’EPIC est abandonné.

Un chantier s’y rattache par `rel_parent` (voir [les relations entre chantiers](./chantier#relations-entre-chantiers)). Un EPIC peut lui-même appartenir à un EPIC ; au-delà de deux niveaux, le découpage est sans doute trop fin.

Quand une demande couvre plusieurs livrables indépendants, `/atelier:new` propose d’ouvrir un EPIC ; `/atelier:plan` signale un FEAT ou un REF dont le découpage dépasse un chantier. À l’inverse, un EPIC pour un seul livrable est un FEAT.

### EPIC à branche d’intégration

Par défaut, chaque enfant d’un EPIC part de la branche par défaut et y est fusionné dès qu’il est livré. Quand les lots ne doivent rejoindre la branche par défaut qu’**ensemble** (une fonctionnalité incomplète tant que tous ne sont pas livrés), l’EPIC déclare dans l’en-tête de sa spec :

```yaml
integration_branch: yes
```

Sa branche `epic/<ID>-<slug>` devient alors la **branche d’intégration** de ses enfants, du début à la fin de l’EPIC :

- **Ouverture d’un enfant** : `/atelier:new` demande le parent avant de créer la branche ; `atelier base --parent <ID>` donne le point de départ, la branche d’intégration à jour.
- **Revue d’un enfant** : sa base est la branche d’intégration, pas la branche par défaut. Fusionner la branche d’intégration dans un enfant déjà revu ne périme pas sa revue, sauf résolution de conflits sur du code.
- **Clôture d’un enfant** : sa PR vise la branche d’intégration et se fusionne par un **commit de fusion**, ni squash ni rebase.
- **La branche par défaut avance** : on la fusionne dans la branche d’intégration (`git merge`), **jamais de rebase**, qui réécrirait les commits revus des enfants.
- **Clôture de l’EPIC** : une **revue d’ensemble** est obligatoire (cohérence entre lots, critères globaux, résolutions de conflits), puis une seule PR fusionne la branche d’intégration dans la branche par défaut. Un point bloquant se corrige par un **enfant correctif** (`FIX` ou `REF` rattaché à l’EPIC), jamais par du code sur la branche de l’EPIC.

Un enfant peut être lui-même un EPIC : la base d’un chantier est la branche d’intégration de l’EPIC ancêtre **le plus proche** qui déclare l’option, à défaut la branche par défaut. L’option se fige à la signature de l’EPIC, et un dépôt réglé pour n’accepter que le squash ne peut pas l’utiliser. Un chantier hors de l’EPIC qui dépend d’un enfant livré seulement dans la branche d’intégration attend la clôture de l’EPIC.

## Pourquoi pas plus de types ?

Chaque type supplémentaire ajoute un template, des questions et des règles à retenir. Six types couvrent la quasi-totalité des cas. Le contenu (marketing, textes) qui n’est pas du code reste hors d’atelier.
