# Démarrage rapide

En dix minutes : installer le plugin, préparer un projet, mener un premier chantier.

## Prérequis

- [Claude Code](https://code.claude.com) installé.
- Un projet sous git, avec idéalement des commandes de **types**, **lint** et **tests** qui fonctionnent.

::: warning Des tests qui testent vraiment
Si la commande de tests de votre projet ne fait rien (`echo "No test" && exit 0`), les contrôles automatiques ne protègent rien. `/atelier:init` vous le signalera : faites-en votre premier chantier.
:::

## 1. Installer le plugin

Une fois pour toutes sur votre machine :

```bash
claude plugin marketplace add opack/atelier
```

```bash
claude plugin install atelier@atelier
```

## 2. Préparer le projet

Dans Claude Code, à la racine du projet :

```text
/atelier:init
```

atelier détecte vos commandes de contrôle, crée `docs/chantiers/` et `docs/decisions/`, ajoute une section « Process » au `CLAUDE.md` et déclare le plugin dans `.claude/settings.json` : vos coéquipiers se le verront proposer automatiquement.

## 3. Ouvrir un chantier

```text
/atelier:new FEAT Afficher le total des enveloppes sur le tableau de bord
```

atelier choisit le prochain identifiant (`FEAT-27`), crée la branche `feat/FEAT-27-total-enveloppes` et le dossier du chantier, puis construit la spec avec vous. Il **ne pose des questions que sur ce qui manque**, et vous demande toujours : **ce chantier se fait-il en TDD ?**

## 4. Signer

```text
/atelier:sign
```

Un agent critique relit la spec, vous tranchez ses remarques, puis vous signez. À partir de là, le code est débloqué.

## 5. Concevoir, tester, implémenter

```text
/atelier:plan
/atelier:tests
/atelier:build
```

- `plan` propose une approche et un découpage en tranches.
- `tests` écrit les tests à partir des critères d’acceptation, vérifie qu’ils échouent, et les commite (si TDD).
- `build` implémente jusqu’à ce que tout passe, sans toucher aux tests, puis commite après votre accord.

## 6. Clôturer

```text
/atelier:close
```

Contrôles, revue par un agent indépendant, bilan, **votre verdict**, puis proposition de PR.

## Et ensuite ?

- Perdu en route ? `/atelier:status` vous dit où vous en êtes et quoi faire.
- Pour comprendre chaque étape en détail : [Vue d’ensemble du cycle](./vue-ensemble).
