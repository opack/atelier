---
description: Étapes 4 et 5 du TDD pour le chantier actif — implémenter jusqu'à ce que tous les tests passent sans jamais les modifier, vérifier l'absence de surapprentissage avec un sous-agent indépendant, puis commiter après validation.
argument-hint: "[tranche à implémenter]"
---

# Implémenter (TDD, étapes 4 et 5)

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Tranche demandée : `$ARGUMENTS` (sinon : la prochaine tranche non faite de `plan.md`, ou tout le chantier s'il n'y a pas de plan).

## 0. Préalables

- `atelier status --json` : spec **signée**. Si `testDrivenPhase` vaut `writing-tests`, arrête-toi : les tests ne sont pas encore écrits et commités, propose `/atelier:tests`.
- Lis la spec, `plan.md` et `decisions.md` s'ils existent, puis les tests figés du chantier.

## 1. Implémenter jusqu'à ce que tous les tests passent

**Règle absolue : ne modifie pas les tests.** Ils sont commités et figés : le hook d'atelier refuse toute écriture dans un fichier de test, et le contrôle de fin signale tout test modifié par un autre moyen. Si un test te semble faux ou impossible à satisfaire, **arrête-toi et explique pourquoi à l'utilisateur** ; c'est à lui de décider de le rouvrir (`/atelier:tests` après `atelier reopen-tests <raison>`).

Puis :
1. Écris le code qui fait passer les tests de la tranche, en respectant les conventions du projet et `plan.md`.
2. Lance les tests et les contrôles (`atelier checks`).
3. **Continue jusqu'à ce que tous les tests passent** : corrige, relance, recommence, sans demander l'avis de l'utilisateur à chaque itération. Le hook de fin te renverra au travail tant qu'un contrôle échoue.
4. Note dans `decisions.md` toute décision prise en route (une entrée datée, option écartée et raison).

Écris le code le plus simple qui satisfait réellement la spec, pas seulement les tests : aucune valeur attendue codée en dur, aucun cas particulier pour les données de test.

## 2. Vérifier l'absence de surapprentissage

Quand tout est vert, lance le sous-agent `atelier:overfit-checker` avec le chemin de la spec, la liste des fichiers de test et des fichiers d'implémentation de la tranche. Il vérifie, sans rien modifier, que l'implémentation résout le problème général et ne se contente pas de satisfaire les tests.

Présente ses points. Corrige ceux qui sont fondés, toujours sans toucher aux tests, puis relance tests et contrôles. Si un point révèle un test trop faible, ne le renforce pas toi-même : signale-le à l'utilisateur.

## 3. Faire valider, puis commiter

Présente un résumé de la tranche : fichiers modifiés, tests passés, points du sous-agent traités ou écartés. **Demande à l'utilisateur s'il est satisfait.**

Seulement après son accord :
1. Vérifie `atelier tests-changed` : aucun test ne doit avoir changé depuis leur commit.
2. Commite la tranche : `<prefix>(<scope>): [<ID>] <description>` (un commit par tranche).
3. S'il reste des tranches dans le plan, propose la suivante (`/atelier:build <tranche>`). Sinon : `/atelier:close`.
