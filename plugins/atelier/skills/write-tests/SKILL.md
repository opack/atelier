---
description: Écrit les tests du chantier actif (TDD, étapes 1 à 3) — à partir des critères d'acceptation, vérifie qu'ils échouent, les fait relire puis les commite et les fige. Relançable à tout moment pour rouvrir des tests figés (cas oublié, test faux, spec amendée). Aucune implémentation à cette étape.
argument-hint: "[raison, pour rouvrir des tests figés]"
---

# Écrire les tests (TDD, étapes 1 à 3)

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Arguments reçus : `$ARGUMENTS`

**Nous faisons du développement piloté par les tests (TDD).** À cette étape, tu écris **uniquement des tests**. Tu n'écris **aucun code d'implémentation**, ni réel ni factice : pas de stub, pas de mock de la fonctionnalité à construire, pas de valeur codée en dur pour faire passer un test, même pour une fonctionnalité qui n'existe pas encore dans le code. Le hook d'atelier refuse d'ailleurs toute écriture hors des fichiers de test pendant cette phase.

## 0. Préalables

`atelier status --json` : il faut une spec **signée**. `slice` et `sliceCount` donnent la tranche en cours (`null` pour un chantier à tranche unique ; `"chantier"` pendant la revue du chantier). Puis, selon `testDrivenPhase` :
- **`none`** : l'utilisateur a choisi de ne pas mener ce chantier en TDD (`tdd: no`). Il n'y a ni phase « tests d'abord » ni gel : dis-le et propose `/atelier:build`, où les tests s'ajoutent avec le code.
- **`writing-tests`** : tests de la tranche en cours, ou tests déjà rouverts. Va à l'étape 1. Si un test d'une tranche précédente doit changer (argument fourni), rouvre-le d'abord comme ci-dessous : c'est possible dès la tranche 2.
- **`implementing`** : les tests sont figés. Les rouvrir est une décision de l'utilisateur.

Rouvrir des tests figés :
1. Demande la raison, sauf si elle est dans les arguments ou déjà donnée dans la conversation.
2. `atelier reopen-tests <raison>` : vide `tests_commit` s'il est renseigné et ajoute à la spec l'entrée « tests rouverts (gel quitté : <hash>) : <raison> ». Elle refuse une deuxième réouverture avant le regel (« tests déjà rouverts »).
3. Commite aussitôt la spec seule : `git add <dossier du chantier>/spec.md` puis `git commit -m "docs(chantiers): [<ID>] reopen tests"`.
4. Va à l'étape 1, en ne traitant que ce que la raison justifie.

Puis :
- Repère le framework de tests et les conventions du projet : emplacement, nommage, utilitaires de test existants. La commande de tests est dans `.claude/atelier.json`.
- Si en cours de route le TDD s'avère inadapté (ex. rendu purement visuel), ne contourne pas : propose à l'utilisateur `atelier set-tdd no <raison>`, tracé dans la spec. C'est sa décision. Après la commande, commite aussitôt la spec seule : `docs(chantiers): [<ID>] set tdd`.

## Tests de la tranche seulement

Pour un chantier à plusieurs tranches, lis dans `plan.md` les `CA` couverts par la tranche en cours et n'écris **que leurs tests** : ceux des tranches suivantes s'écriront après la revue de celle-ci, avec ce qu'elle aura appris. Le reviewer le vérifie.

Les tests des tranches précédentes (et ceux du projet antérieurs au chantier) restent figés : on **ajoute** des tests, on ne modifie ni ne supprime les leurs. `atelier freeze-tests` refuse le gel si une de leurs lignes a été modifiée ou supprimée, sauf après une réouverture.

## Ajouter, modifier, supprimer un test

- **Ajouter** un test (cas oublié, remarque de revue) est normal.
- **Modifier** un test existant seulement s'il était faux, ou si la spec a été amendée (`/atelier:amend`).
- **Supprimer** un test seulement si un critère a disparu, donc après un amendement.

Dans le doute, demande à l'utilisateur avant de modifier ou de supprimer.

## 1. Écrire les tests à partir des paires entrée / sortie attendues

Pars des critères d'acceptation de la spec : chaque `CA-x` donne une situation (entrée) et un résultat attendu (sortie).

- **Pas de test pour le principe** : un test par comportement qui compte, pas de test redondant ni de test de détail d'implémentation.
- **FEAT** : au moins un test par `CA-x` de la tranche. Le nom du test cite l'identifiant (`CA-2 : refuse un montant négatif`).
- **FIX** : un test qui reproduit le bug, lié au `CA` de non-régression.
- **REF** : des **tests de caractérisation** qui figent le comportement actuel. Exception à la règle suivante : eux doivent **passer** dès maintenant, puisque le code existe et ne doit pas changer de comportement.

Règles :
- Teste le comportement observable, pas l'implémentation.
- Ne mocke pas la couche testée. Les dépendances externes (réseau, horloge, base) peuvent être simulées.
- Importe le code à tester depuis l'emplacement où il **devra** exister, même s'il n'existe pas encore.

## 2. Lancer les tests et confirmer qu'ils échouent

Lance les tests. **N'écris toujours aucune implémentation.**

Pour chaque test nouveau ou modifié (FEAT, FIX), vérifie qu'il échoue **pour la bonne raison** :
- bonne raison : l'assertion métier échoue, ou le module / la fonction à construire n'existe pas encore ;
- mauvaise raison : erreur de syntaxe, de configuration, d'import d'un module qui existe déjà, test mal écrit. Corrige alors le **test**, jamais en ajoutant du code de production.

Après une réouverture, les tests déjà satisfaits par l'implémentation existante passent : c'est normal. Seuls les tests nouveaux ou modifiés doivent échouer, sauf s'ils décrivent un comportement déjà en place (dis-le).

Présente un tableau : test, `CA` couvert, résultat, raison de l'échec. Signale tout test qui passe sans raison : le critère est déjà satisfait, ou le test ne teste rien.

## 3. Faire relire, puis commiter et figer les tests

Les tests sont la spécification exécutable du chantier. **Arrête-toi et demande à l'utilisateur de les relire.** Corrige-les selon ses retours, puis relance-les.

Seulement quand l'utilisateur s'en déclare satisfait :
1. Commite **les tests seuls** : `test(<scope>): [<ID>] add failing tests for CA-1..CA-n` (les `CA` de la tranche ; `add characterization tests` pour un REF ; après une réouverture, une description de ce qui change, ex. `cover CA-4 empty budget`).
2. Fige-les : `atelier freeze-tests`. La commande refuse s'il reste des tests non commités, si le dernier commit ne contient pas de test, si une ligne d'un test d'une tranche précédente a changé sans réouverture (elle liste les fichiers : présente-les à l'utilisateur, qui décide de `/atelier:amend` et / ou `/atelier:write-tests <raison>` ; pas d'option pour passer outre), ou si le début de la tranche (`slice_base`) n'est plus un ancêtre de `HEAD` (seul l'utilisateur corrige ce champ). Après une réouverture, elle ajoute à la spec l'entrée « tests regelés : <hash> ».
3. La commande écrit `tests_commit` dans la spec (au premier gel, aussi `slice: 1`, et l'entrée de regel le cas échéant) : commite aussitôt la spec seule, à chaque gel : `docs(chantiers): [<ID>] freeze tests`. Rien de ce qu'écrit la commande ne reste non commité.
4. Indique la suite : `/atelier:build` (la tranche en cours). Conseille de repartir d'un contexte propre : les tests et le plan portent la mémoire.

Une fois figés, les tests ne sont plus modifiables par l'agent jusqu'à la prochaine réouverture par cette commande.
