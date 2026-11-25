# 4. Tests d’abord (TDD)

**Objectif** : écrire la spécification **exécutable** du chantier avant le code, pour que l’agent puisse ensuite se vérifier lui-même.

Cette étape s’applique quand la tranche en cours est en TDD : déclarée `TDD : oui` dans le [plan](./conception) (recopié dans `slice_tdd`), ou à défaut `tdd: yes` du chantier. Une tranche `TDD : oui` d’un chantier `tdd: no` passe donc aussi par les tests d’abord. Une tranche `TDD : non` saute la phase « tests d’abord » : ses tests s’écrivent avec le code ([Implémentation](./implementation)).

## Pourquoi les tests d’abord ?

Écrits **après** le code, par le même agent, les tests épousent l’implémentation, bugs compris. Écrits **avant**, à partir des critères d’acceptation, ils décrivent ce que le code **doit** faire. L’agent dispose alors d’une cible claire, et vous d’une preuve.

atelier suit le workflow « write tests, commit; code, iterate, commit » recommandé par [Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices) :

1. Écrire les tests à partir des paires entrée / sortie attendues.
2. Les lancer et confirmer qu’ils échouent, **sans écrire d’implémentation**.
3. Les commiter une fois satisfait.
4. Écrire le code qui les fait passer, **sans modifier les tests** ([Implémentation](./implementation)).
5. Commiter le code une fois satisfait.

Cette page couvre les étapes 1 à 3.

## Par tranche

Le TDD se décide tranche par tranche : atelier recopie la déclaration de la tranche en cours dans la spec (`slice_tdd`), à l’écriture du plan pour la tranche 1, puis à la validation de la revue de chaque tranche. Ce champ n’est écrit que par les commandes.

Pour un chantier découpé en tranches, on n’écrit pas d’un coup les tests de tous les critères : seulement ceux des **CA de la tranche en cours** (le plan dit lesquels). Les tests des tranches suivantes s’écrivent après la revue de celle-ci, avec ce qu’elle a appris. Le cycle tests → implémentation → [revue](./revue) se répète pour chaque tranche.

Les tests des tranches précédentes restent figés : on **ajoute** des tests, on ne modifie ni ne supprime les leurs. Comme ils vivent souvent dans le même fichier, la règle est vérifiée **au gel**, ligne par ligne : `atelier freeze-tests` refuse si une ligne de test présente au début de la tranche a été modifiée ou supprimée (fichier supprimé ou renommé compris ; espaces et fins de ligne ignorés), en listant les fichiers. Le contrôle ne voit pas une assertion ajoutée au milieu d’un test existant : le relecteur, si.

## Avec atelier

```text
/atelier:write-tests
```

### Étape 1 : écrire les tests

Chaque `CA-x` de la spec donne au moins un test, dont le nom cite l’identifiant :

```js
test('CA-2 : refuse un montant négatif', () => { … })
```

- **FEAT** : un test par critère d’acceptation de la tranche.
- **FIX** : un test qui reproduit le bug.
- **REF** : des tests de caractérisation, qui figent le comportement actuel. Exception : eux doivent **passer** dès maintenant.

Le code est importé depuis l’endroit où il **devra** exister, même s’il n’existe pas encore.

::: danger Aucune implémentation, même factice
Pas de stub, pas de mock de la fonctionnalité à construire, pas de valeur codée en dur. Le hook d’atelier **refuse toute écriture hors des fichiers de test et des [chemins libres](../reference/configuration#claude-atelier-json)** pendant cette phase.
:::

### Étape 2 : confirmer qu’ils échouent pour la bonne raison

- **Bonne raison** : l’assertion métier échoue, ou le module à construire n’existe pas encore.
- **Mauvaise raison** : erreur de syntaxe, de configuration, test mal écrit. On corrige le **test**, jamais en ajoutant du code de production.

L’agent présente un tableau : test, critère couvert, résultat, raison. Un test qui passe déjà signale un critère déjà satisfait, ou un test qui ne teste rien.

### Étape 3 : relire, commiter, figer

Les tests sont la spécification exécutable : **relisez-les**. Puis :

1. commit des tests seuls ;
2. `atelier freeze-tests` : refuse s’il reste des tests non commités, si le dernier commit ne contient aucun test, ou si un test d’une tranche précédente a changé sans réouverture ; note le commit dans la spec (`tests_commit`, et `slice: 1` au premier gel) ;
3. commit de la spec seule, aussitôt (`freeze tests`).

À partir de là, les tests sont **figés** : l’agent ne peut plus les modifier.

## Pas de test pour le principe

Un test par comportement qui compte. Pas de test redondant, pas de test d’un détail d’implémentation. Mille tests inutiles ralentissent autant que zéro test.

## Et si un test manque ou s’avère faux ?

On ne le corrige pas en douce : on rouvre les tests explicitement, raison à l’appui, en relançant la même commande.

```text
/atelier:write-tests CA-3 mal compris : le seuil est inclusif
```

1. La raison est tracée dans la spec : `- AAAA-MM-JJ : tests rouverts (gel quitté : <hash>) : <raison>`, et la spec est commitée aussitôt.
2. Retour en phase « tests d’abord » : aucune implémentation, seulement des tests.
3. Les tests sont écrits ou corrigés, relus, commités, puis figés à nouveau. Le regel est tracé à son tour : `- AAAA-MM-JJ : tests regelés : <hash>`.

Ce qui est permis à la réouverture :

- **ajouter** un test (cas oublié, remarque de revue) est normal ;
- **modifier** un test existant, seulement s’il était faux ou si la spec a été [amendée](./amendement) ;
- **supprimer** un test, seulement si un critère a disparu, donc après un amendement.

Un test d’une **tranche précédente** se rouvre de la même façon, pendant la phase « tests d’abord » de la tranche en cours (à partir de la tranche 2) : le gel quitté est alors le début de la tranche. Si c’est la spec qui change, on l’[amende](./amendement) d’abord. Il n’y a pas d’option pour passer outre au moment du gel.

La réouverture est refusée pour une spec non signée, pour un chantier sans TDD ou une tranche `TDD : non` (pas de tests figés), pour des tests pas encore figés (phase « tests d’abord » de la tranche 1), et deux fois de suite avant le regel (« tests déjà rouverts »).

## Et si le TDD s’avère inadapté ?

L’agent vous propose alors de changer la décision : `atelier set-tdd yes|no <raison>`. Tracé aussi, et la spec est commitée aussitôt. Dans un chantier en tranches, elle ne change que la tranche courante (l’agent corrige aussi `plan.md`, avec une entrée dans `decisions.md`) ; elle est refusée si les tests de la tranche sont figés, et `no` l’est pendant une réouverture. C’est votre décision, pas celle de l’agent : tant que la spec est en brouillon, le champ `tdd` se modifie librement ; une fois signée, seule cette commande peut le changer, et elle l’inscrit dans les amendements.
