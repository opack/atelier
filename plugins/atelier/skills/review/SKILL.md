---
description: Revue indépendante du chantier actif — contrôles, relecture par le sous-agent reviewer, traitement de chaque point (correction, test, amendement ou exception acceptée), autant de tours que nécessaire, puis enregistrement du commit revu dans la spec.
---

# Faire relire le chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

La revue porte sur un commit précis. La clôture (`/atelier:close`) vérifie ensuite qu'aucun code n'a changé depuis ce commit : toute correction se fait donc **ici**, pas à la clôture.

## 1. Contrôles

- `atelier status --json` : il faut une spec **signée**. Pour un `SPIKE` (code jetable, non fusionné), la revue est facultative : demande à l'utilisateur s'il la veut.
- `atelier checks` : tous les contrôles doivent être verts. Sinon, arrête-toi : retour à `/atelier:build`.
- En TDD (`testDrivenPhase` ≠ `none`) : les tests doivent être figés (`implementing`), et `atelier tests-changed` ne doit signaler aucun test modifié depuis leur gel. Sinon, arrête-toi et explique-le à l'utilisateur.
- Le travail doit être commité (`git status --porcelain` sans code modifié), chaque commit du chantier portant `[<ID>]`.

## 2. Relecture indépendante

Base de comparaison : `git merge-base HEAD <branche par défaut>` (en général `main` ; sinon `git symbolic-ref --short refs/remotes/origin/HEAD`).

Lance le sous-agent `atelier:reviewer` en lui donnant : le chemin de la spec, du plan, de `decisions.md` et de `revue.md` s'ils existent (les tours précédents disent ce qui a déjà été tranché), et la base. Présente ses points classés **bloquant** / **à discuter**, avec `fichier:ligne`.

## 3. Traiter chaque point

Pour chaque point, propose un traitement et laisse l'utilisateur décider :
- **correction du code** : en suivant `/atelier:build` (résumé, accord de l'utilisateur, commit `[<ID>]`) ;
- **test manquant ou faux** : `/atelier:write-tests` (en TDD, il rouvre les tests figés, raison à l'appui) ;
- **spec fausse ou incomplète** : `/atelier:amend` ;
- **exception** : acceptée **explicitement** par l'utilisateur, avec sa raison ;
- **écarté** : le point n'est pas fondé (dis pourquoi).

Après des corrections, relance l'étape 1 puis l'étape 2 : c'est un nouveau tour. **Continue jusqu'à zéro point bloquant** non traité.

## 4. Consigner

Dans le dossier du chantier, `revue.md` (créé depuis `atelier template revue` s'il n'existe pas ; remplace `{{ID}}`, `{{TITLE}}`, `{{DATE}}`) : une section par tour, avec la date, le commit revu (`git rev-parse --short HEAD`), la base, les points et leur traitement.

## 5. Enregistrer la revue

Quand le dernier tour n'a plus de point bloquant non traité et que tout est commité :
1. `atelier set-reviewed` : écrit `reviewed_commit` (hash complet de `HEAD`) dans la spec. La commande refuse sans spec signée, avec du code non commité, avec des changements non commités de `spec.md`, ou en TDD si les tests ne sont pas figés ou ont changé depuis leur gel.
2. Commite aussitôt la spec et `revue.md` : `git add <dossier du chantier>/spec.md <dossier du chantier>/revue.md` puis `git commit -m "docs(chantiers): [<ID>] review"`.
3. Suite : `/atelier:close`. Tout commit de code après ce point (tests compris), tout amendement de la spec ou tout rebase rendra la revue obsolète : il faudra repasser par `/atelier:review`.
