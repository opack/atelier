# 4. Tests d’abord (TDD)

**Objectif** : écrire la spécification **exécutable** du chantier avant le code, pour que l’agent puisse ensuite se vérifier lui-même.

Cette étape ne s’applique qu’aux chantiers où vous avez choisi `tdd: yes`.

## Pourquoi les tests d’abord ?

Écrits **après** le code, par le même agent, les tests épousent l’implémentation, bugs compris. Écrits **avant**, à partir des critères d’acceptation, ils décrivent ce que le code **doit** faire. L’agent dispose alors d’une cible claire, et vous d’une preuve.

atelier suit le workflow « write tests, commit; code, iterate, commit » recommandé par [Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices) :

1. Écrire les tests à partir des paires entrée / sortie attendues.
2. Les lancer et confirmer qu’ils échouent, **sans écrire d’implémentation**.
3. Les commiter une fois satisfait.
4. Écrire le code qui les fait passer, **sans modifier les tests** ([Implémentation](./implementation)).
5. Commiter le code une fois satisfait.

Cette page couvre les étapes 1 à 3.

## Avec atelier

```text
/atelier:tests
```

### Étape 1 : écrire les tests

Chaque `CA-x` de la spec donne au moins un test, dont le nom cite l’identifiant :

```js
test('CA-2 : refuse un montant négatif', () => { … })
```

- **FEAT** : un test par critère d’acceptation.
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
2. `atelier freeze-tests` : refuse s’il reste des tests non commités ou si le dernier commit ne contient aucun test, et note le commit dans la spec (`tests_commit`).

À partir de là, les tests sont **figés** : l’agent ne peut plus les modifier.

## Pas de test pour le principe

Un test par comportement qui compte. Pas de test redondant, pas de test d’un détail d’implémentation. Mille tests inutiles ralentissent autant que zéro test.

## Et si un test s’avère faux ?

On ne le corrige pas en douce : on le rouvre explicitement, raison à l’appui.

```bash
atelier reopen-tests "CA-3 mal compris : le seuil est inclusif"
```

La raison est tracée dans la spec, et on repasse par `/atelier:tests`.

## Et si le TDD s’avère inadapté ?

```bash
atelier set-tdd no "rendu purement visuel, test sans valeur"
```

Tracé aussi. C’est votre décision, pas celle de l’agent : tant que la spec est en brouillon, le champ `tdd` se modifie librement ; une fois signée, seule cette commande peut le changer, et elle l’inscrit dans les amendements.
