---
description: Étapes 1 à 3 du TDD pour le chantier actif — écrire les tests à partir des critères d'acceptation, vérifier qu'ils échouent, les faire relire puis les commiter. Aucune implémentation à cette étape.
---

# Tests d'abord (TDD, étapes 1 à 3)

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

**Nous faisons du développement piloté par les tests (TDD).** À cette étape, tu écris **uniquement des tests**. Tu n'écris **aucun code d'implémentation**, ni réel ni factice : pas de stub, pas de mock de la fonctionnalité à construire, pas de valeur codée en dur pour faire passer un test, même pour une fonctionnalité qui n'existe pas encore dans le code. Le hook d'atelier refuse d'ailleurs toute écriture hors des fichiers de test pendant cette phase.

## 0. Préalables

- `atelier status --json` : il faut une spec **signée**, et `testDrivenPhase` doit valoir `writing-tests`. Si la phase vaut `implementing`, les tests sont déjà figés : propose `/atelier:build`. Si elle vaut `none`, le chantier n'est pas soumis aux tests d'abord (TEC, SPIKE ou exception tracée).
- Repère le framework de tests et les conventions du projet : emplacement, nommage, utilitaires de test existants. La commande de tests est dans `.claude/atelier.json`.
- Si un test ne peut vraiment pas être écrit (ex. rendu purement visuel), ne contourne pas : propose à l'utilisateur `atelier skip-test-first <raison>`, qui trace l'exception dans la spec.

## 1. Écrire les tests à partir des paires entrée / sortie attendues

Pars des critères d'acceptation de la spec : chaque `CA-x` donne une situation (entrée) et un résultat attendu (sortie).

- **FEAT** : au moins un test par `CA-x`. Le nom du test cite l'identifiant (`CA-2 : refuse un montant négatif`).
- **FIX** : un test qui reproduit le bug, lié au `CA` de non-régression.
- **REF** : des **tests de caractérisation** qui figent le comportement actuel. Exception à la règle suivante : eux doivent **passer** dès maintenant, puisque le code existe et ne doit pas changer de comportement.

Règles :
- Teste le comportement observable, pas l'implémentation.
- Ne mocke pas la couche testée. Les dépendances externes (réseau, horloge, base) peuvent être simulées.
- Importe le code à tester depuis l'emplacement où il **devra** exister, même s'il n'existe pas encore.

## 2. Lancer les tests et confirmer qu'ils échouent

Lance les tests. **N'écris toujours aucune implémentation.**

Pour chaque test (FEAT, FIX), vérifie qu'il échoue **pour la bonne raison** :
- bonne raison : l'assertion métier échoue, ou le module / la fonction à construire n'existe pas encore ;
- mauvaise raison : erreur de syntaxe, de configuration, d'import d'un module qui existe déjà, test mal écrit. Corrige alors le **test**, jamais en ajoutant du code de production.

Présente un tableau : test, `CA` couvert, résultat, raison de l'échec. Signale tout test qui passe déjà : le critère est déjà satisfait, ou le test ne teste rien.

## 3. Faire relire, puis commiter les tests

Les tests sont la spécification exécutable du chantier. **Arrête-toi et demande à l'utilisateur de les relire.** Corrige-les selon ses retours, puis relance-les (ils doivent toujours échouer pour la bonne raison).

Seulement quand l'utilisateur s'en déclare satisfait :
1. Commite **les tests seuls** : `test(<scope>): [<ID>] add failing tests for CA-1..CA-n` (ou `add characterization tests` pour un REF).
2. Fige-les : `atelier freeze-tests`. La commande refuse s'il reste des tests non commités ou si le dernier commit ne contient pas de test.
3. Indique la suite : `/atelier:build`. Conseille de repartir d'un contexte propre : les tests et le plan portent la mémoire.

Une fois figés, les tests ne sont plus modifiables par l'agent. S'il faut vraiment les changer plus tard (critère mal compris, cas oublié), on les rouvre explicitement : `atelier reopen-tests <raison>` (tracé dans la spec), puis on repasse par cette commande.
