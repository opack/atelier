---
description: Écrit les tests d'abord pour le chantier actif — un test par critère d'acceptation, qui échoue pour la bonne raison — puis s'arrête pour relecture.
---

# Tests d'abord

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

## 1. Préalables

- `atelier status --json` : il faut une spec **signée**.
- Repère le framework de tests et les conventions du projet (emplacement, nommage, utilitaires de test existants). La commande de tests est dans `.claude/atelier.json`.

## 2. Écrire les tests

Selon le type :
- **FEAT** : au moins un test par `CA-x`. Le nom ou la description du test cite l'identifiant (`CA-2 : refuse un montant négatif`).
- **FIX** : un test qui reproduit le bug, lié au `CA` de non-régression.
- **REF** : des **tests de caractérisation** qui figent le comportement actuel. Eux doivent **passer** avant le refactor.
- **TEC / SPIKE** : pas d'étape tests d'abord, sauf si la spec le prévoit.

Règles :
- Teste le comportement observable, pas l'implémentation.
- Pas de mock de la couche testée.
- N'écris **aucun code de production** à cette étape, hormis le strict nécessaire pour que les tests compilent (signatures vides), et dis-le.

## 3. Vérifier

Lance les tests. Pour chaque test (FEAT, FIX), vérifie qu'il **échoue pour la bonne raison** : l'assertion métier attendue, pas une erreur d'import, de syntaxe ou de configuration. Présente un tableau : test, `CA` couvert, résultat, raison de l'échec. Signale tout test qui passe déjà (critère déjà satisfait, ou test inutile).

## 4. S'arrêter

Les tests sont la spécification exécutable : **demande à l'utilisateur de les relire** avant toute implémentation. Après son accord :
1. `atelier set-tests-written`.
2. Commite : `test(<scope>): [<ID>] add failing tests for CA-1..CA-n` (ou `characterization tests` pour un REF).
3. Suite : construire tranche par tranche, un commit par tranche avec l'ID, puis `/atelier:close`.
