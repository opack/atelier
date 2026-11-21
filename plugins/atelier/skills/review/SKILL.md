---
description: Revue indépendante du chantier actif — revue de la tranche en cours, puis revue du chantier après la dernière tranche — contrôles, relecture par le sous-agent reviewer, traitement de chaque point (correction, test, amendement ou exception acceptée), autant de revues que nécessaire, validation de l'utilisateur, puis passage à la tranche suivante ou enregistrement du commit revu.
---

# Faire relire la tranche ou le chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Chaque passage du sous-agent reviewer est une **revue** ; après correction des points, on relance une revue, jusqu'à zéro point bloquant. Elle porte sur un commit précis : toute correction se fait **ici**, pas à la clôture.

`atelier status --json` donne la portée :
- **revue de tranche** (`slice` est un numéro) : le diff de la tranche en cours. Sa validation fait passer à la tranche suivante ;
- **revue du chantier** (`slice` vaut `"chantier"`, après la dernière tranche d'un chantier à plusieurs tranches) : tout le diff, avec un mandat transversal ;
- **chantier à tranche unique** (`slice` vaut `null`) : tout le diff, ligne à ligne, comme une revue de tranche ; il n'a pas de revue du chantier.

## 1. Contrôles

- `atelier status --json` : il faut une spec **signée**. Pour un `SPIKE` sans TDD (code jetable, non fusionné), la revue est facultative : demande à l'utilisateur s'il la veut. Un `SPIKE` en TDD suit le process complet : revues obligatoires.
- `atelier checks` : tous les contrôles doivent être verts. Sinon, arrête-toi : retour à `/atelier:build`.
- En TDD (`testDrivenPhase` ≠ `none`) : les tests doivent être figés (`implementing`), et `atelier tests-changed` ne doit signaler aucun test modifié depuis leur gel. Sinon, arrête-toi et explique-le à l'utilisateur.
- Le travail doit être commité (`git status --porcelain` sans code modifié), chaque commit du chantier portant `[<ID>]`.

## 2. Relecture indépendante

Base de comparaison :
- revue de tranche, à partir de la tranche 2 : `slice_base` (en-tête de la spec), le commit revu qui a clos la tranche précédente ;
- tranche 1, revue du chantier, chantier à tranche unique : `git merge-base HEAD <branche par défaut>` (en général `main` ; sinon `git symbolic-ref --short refs/remotes/origin/HEAD`).

Lance le sous-agent `atelier:reviewer` en lui donnant : le chemin de la spec, du plan, de `decisions.md` et de `revue.md` s'ils existent (les revues précédentes disent ce qui a déjà été tranché), la base, et la portée : « revue de la tranche N (CA couverts : … selon `plan.md`) », « revue du chantier » ou « chantier à tranche unique ». Présente ses points classés **bloquant** / **à discuter**, avec `fichier:ligne`.

## 3. Traiter chaque point

Pour chaque point, propose un traitement et laisse l'utilisateur décider :
- **correction du code** : en suivant `/atelier:build` (résumé, accord de l'utilisateur, commit `[<ID>]`) ;
- **test manquant ou faux** : `/atelier:write-tests <raison>` (en TDD, il rouvre les tests figés) ;
- **spec fausse ou incomplète** : `/atelier:amend` ;
- **exception** : acceptée **explicitement** par l'utilisateur, avec sa raison ;
- **écarté** : le point n'est pas fondé (dis pourquoi).

Après des corrections, relance l'étape 1 puis l'étape 2 : c'est une nouvelle revue. **Continue jusqu'à zéro point bloquant** non traité.

## 4. Consigner

Dans le dossier du chantier, `revue.md` (créé depuis `atelier template revue` s'il n'existe pas ; remplace `{{ID}}`, `{{TITLE}}`, `{{DATE}}`) : une section par revue, avec sa portée (« tranche N » ou « chantier »), la date, le commit revu (`git rev-parse --short HEAD`), la base, les points et leur traitement.

## 5. Faire valider, puis enregistrer

Quand la dernière revue n'a plus de point bloquant non traité et que tout est commité, présente le résultat à l'utilisateur et **demande-lui explicitement s'il valide** la revue de la tranche (ou du chantier). Sans son « oui », n'écris rien : la tranche reste en cours.

Seulement après son accord :
1. `atelier set-reviewed`. Selon la portée :
   - tranche N avant la dernière : passe à la tranche N+1 (`slice`, `slice_base` ; `tests_commit` vidé) ;
   - dernière tranche (ou tranche retirée du plan entre-temps) : passe à la revue du chantier (`slice: chantier`, `last_slice`, `slice_base` ; tests toujours figés) ;
   - revue du chantier ou chantier à tranche unique : écrit `reviewed_commit` (hash complet de `HEAD`).

   La commande refuse sans spec signée, avec du code non commité, avec des changements non commités de `spec.md`, en TDD si les tests ne sont pas figés ou ont changé depuis leur gel, si `slice_base` n'est plus un ancêtre de `HEAD` (seul l'utilisateur corrige ce champ), ou pour une tranche sans aucun commit de code (« tranche vide »).
2. Commite aussitôt la spec et `revue.md` : `git add <dossier du chantier>/spec.md <dossier du chantier>/revue.md` puis `git commit -m "docs(chantiers): [<ID>] review <tranche>"` (`<tranche>` : son numéro, ou `chantier` ; rien pour un chantier à tranche unique).
3. Suite, donnée par la commande :
   - tranche suivante : `/atelier:write-tests` en TDD, sinon `/atelier:build` ;
   - revue du chantier : `/atelier:review` ;
   - revue enregistrée : `/atelier:close`. Tout commit de code après ce point (tests compris), tout amendement de la spec ou tout rebase rendra la revue obsolète : il faudra repasser par `/atelier:review`.
