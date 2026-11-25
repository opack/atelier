# Démarrage rapide

En dix minutes : installer le plugin, préparer un projet, mener un premier chantier.

## Prérequis

- [Claude Code](https://code.claude.com) installé.
- [Node.js](https://nodejs.org) 20 ou plus récent : la commande `atelier` du plugin en a besoin.
- [git](https://git-scm.com) 2.36 ou plus récent (voir [La version de git](../reference/limites#la-version-de-git)).
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

atelier est un plugin Claude Code : ses commandes `/atelier:*` se lancent **dans une session Claude Code ouverte sur le répertoire du projet**, pas dans un terminal. Ouvrez Claude Code à la racine du projet, puis :

```text
/atelier:init
```

atelier détecte vos commandes de contrôle, crée `docs/chantiers/` et `docs/decisions/`, ajoute une section « Process » au `CLAUDE.md` et déclare le plugin dans `.claude/settings.json` : vos coéquipiers se le verront proposer automatiquement (sauf en session cloud, voir [Installation](../projet/installation#dans-une-session-cloud)).

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
/atelier:write-tests
/atelier:build
```

- `plan` propose une approche et un découpage en tranches.
- `write-tests` écrit les tests à partir des critères d’acceptation, vérifie qu’ils échouent, et les commite (si TDD).
- `build` implémente jusqu’à ce que tout passe, sans toucher aux tests, puis commite après votre accord.

`write-tests`, `build` et `review` se répètent **pour chaque tranche** du plan : `/atelier:status` indique la tranche en cours.

## 6. Faire relire

```text
/atelier:review
```

Un agent indépendant relit le chantier. Vous tranchez chaque point (correction, test, amendement ou exception), autant de revues que nécessaire. Pour un chantier découpé en tranches, cela se fait après chaque tranche, puis une dernière fois sur l’ensemble ; le commit relu est alors enregistré.

## 7. Clôturer

```text
/atelier:close
```

Bilan, **votre verdict**, vérification que le code n’a pas changé depuis la revue, puis proposition de PR.

## Et ensuite ?

- Perdu en route ? `/atelier:status` vous dit où vous en êtes et quoi faire.
- La spec signée s’avère fausse ou incomplète ? `/atelier:amend` : voir [Amender la spec](../cycle/amendement).
- Pour comprendre chaque étape en détail : [Vue d’ensemble du cycle](./vue-ensemble).
