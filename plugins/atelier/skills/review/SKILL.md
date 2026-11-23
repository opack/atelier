---
description: Revue indépendante du chantier actif — revue de la tranche en cours, puis revue du chantier après la dernière tranche — contrôles, relecture par le sous-agent reviewer, traitement de chaque point RB/RD (correction, test, amendement, exception acceptée, écarté, reporté ou requalifié), autant de revues que nécessaire, validation de l'utilisateur, puis passage à la tranche suivante ou enregistrement du commit revu.
---

# Faire relire la tranche ou le chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Chaque passage du sous-agent reviewer est une **revue** ; après correction des points, on relance une revue, jusqu'à ce que chaque point ait un traitement. Elle porte sur un commit précis : toute correction se fait **ici**, pas à la clôture.

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

Avant de lancer le sous-agent, `atelier review-ids --json` donne les prochains numéros (`next.RB`, `next.RD`) et les points ouverts (`open` : `id`, `title`, `section`). Ajoute-y les points dont la dernière occurrence dans `revue.md` est `reporté (tranche N)` vers la tranche en cours (ou vers une tranche passée) : ils doivent être repris et traités dans cette revue.

Lance le sous-agent `atelier:reviewer` en lui donnant : le chemin de la spec, du plan, de `decisions.md` et de `revue.md` s'ils existent (les revues précédentes disent ce qui a déjà été tranché), la base, la portée (« revue de la tranche N (CA couverts : … selon `plan.md`) », « revue du chantier » ou « chantier à tranche unique »), les prochains numéros `RB` et `RD`, et la liste des points à reprendre. Le reviewer ne calcule pas les numéros lui-même. Présente ses points classés **bloquant** (`RB`) / **à discuter** (`RD`), chacun avec son identifiant et `fichier:ligne`.

## 3. Traiter chaque point

Désigne chaque point par son identifiant (« je corrige RB2, on écarte RD3 »). Pour chaque point, propose un traitement et laisse l'utilisateur décider ; le traitement consigné commence par le mot-clé entre parenthèses :
- **correction du code** (`corrigé`, avec le commit) : en suivant `/atelier:build` (résumé, accord de l'utilisateur, commit `[<ID>]` qui cite le point : `fix(<scope>): [<ID>] RB2 <description>`) ;
- **test manquant ou faux** (`test ajouté`) : `/atelier:write-tests <raison>` (en TDD, il rouvre les tests figés) ;
- **spec fausse ou incomplète** (`spec amendée`) : `/atelier:amend` ;
- **exception** (`exception acceptée`) : acceptée **explicitement** par l'utilisateur, avec qui et pourquoi ;
- **écarté** (`écarté`) : le point n'est pas fondé (dis pourquoi) ;
- **reporté** (`reporté`) : vers un autre chantier, vers la section « Dette et suites » du bilan, ou vers une tranche suivante de ce chantier (`reporté (tranche N)`) ; un point reporté à une tranche doit y être repris et traité, sinon la clôture est refusée ;
- **requalifié** (`requalifié (RB4)`) : le point change de gravité ; il reçoit un nouvel identifiant dans l'autre série, écrit `RB4 (ex-RD3)` dans le tableau de sa nouvelle gravité, dans la même revue ou une suivante ;
- **sans objet** (`sans objet`) : le point ne s'applique plus.

Un nouvel identifiant attribué pendant ce traitement (requalification) prend le numéro qui suit le plus grand de sa série déjà attribué, reviewer compris : `atelier review-ids` ne lit que `revue.md`, où cette revue n'est pas encore écrite, et redonnerait un numéro déjà pris. Un point repris que le reviewer juge désormais réglé reçoit son traitement (`corrigé (<commit>)`, `sans objet`…) dans sa dernière occurrence, la ligne d'une section précédente ; si cette cellule porte `reporté (tranche N)`, le traitement remplace le report en le citant : `corrigé (abc1234), reporté de la tranche 2`.

Avant de relancer, consigne cette revue dans `revue.md` (étape 4) : `atelier review-ids` et le reviewer suivant ne voient que ce qui y est écrit, et redonneraient sinon les mêmes numéros. Puis, après des corrections, relance l'étape 1 et l'étape 2 : c'est une nouvelle revue. **Continue jusqu'à ce que chaque point, bloquant ou à discuter, ait un traitement.**

## 4. Consigner

Dans le dossier du chantier, `revue.md` (créé depuis `atelier template revue` s'il n'existe pas ; remplace `{{ID}}`, `{{TITLE}}`, `{{DATE}}`) : une section `## ` par revue, avec sa portée (« tranche N » ou « chantier »), la date, le commit revu (`git rev-parse --short HEAD`), la base, les points et leur traitement.

Les points vont dans les tableaux `### Bloquant` (`RB`) et `### À discuter` (`RD`), titres exacts. La cellule « Point » a la forme `<ID>[ (repris)| (ex-<ID>)]. <intitulé>` :
- point nouveau : `RB2. Push non vérifié` ;
- point encore ouvert, repris d'une revue précédente : `RB2 (repris). Push non vérifié` (la dernière occurrence d'un point est celle qui compte) ;
- point requalifié : `RB4 (ex-RD3). Commit non signé`, et l'ancien fermé par `requalifié (RB4)` ;
- aucun point : `Aucun`, seul dans la cellule.

Un `|` dans une cellule s'écrit `\|`. Un `revue.md` aux points sans identifiant (`B1.`, `1.`) est refusé : propose à l'utilisateur de les renommer et de compléter leurs traitements : `B1` → `RB1`, `D1` → `RD1` si le fichier n'a encore aucun `RB`/`RD` ; sinon à partir de `next.RB` / `next.RD` de `atelier review-ids`, pour ne pas reprendre un numéro existant.

## 5. Faire valider, puis enregistrer

Quand plus aucun point de `revue.md` n'est ouvert (`atelier review-ids` : aucun point ouvert ; il ne voit pas les lignes mal formées ni les doublons, que seul `set-reviewed` signale) et que tout est commité, présente le résultat à l'utilisateur et **demande-lui explicitement s'il valide** la revue de la tranche (ou du chantier). Sans son « oui », n'écris rien : la tranche reste en cours.

Seulement après son accord :
1. `atelier set-reviewed`. Selon la portée :
   - tranche N avant la dernière : passe à la tranche N+1 (`slice`, `slice_base` ; `tests_commit` vidé) ;
   - dernière tranche (ou tranche retirée du plan entre-temps) : passe à la revue du chantier (`slice: chantier`, `last_slice`, `slice_base` ; tests toujours figés) ;
   - revue du chantier ou chantier à tranche unique : écrit `reviewed_commit` (hash complet de `HEAD`).

   La commande refuse sans spec signée, avec du code non commité, avec des changements non commités de `spec.md`, en TDD si les tests ne sont pas figés ou ont changé depuis leur gel, si `slice_base` n'est plus un ancêtre de `HEAD` (seul l'utilisateur corrige ce champ), pour une tranche sans aucun commit de code (« tranche vide »), ou si `revue.md` (copie de travail) a un point sans traitement reconnu ou mal formé : elle liste alors les problèmes, à traiter à l'étape 3 ou 4.
2. Commite aussitôt la spec et `revue.md` : `git add <dossier du chantier>/spec.md <dossier du chantier>/revue.md` puis `git commit -m "docs(chantiers): [<ID>] review <tranche>"` (`<tranche>` : son numéro, ou `chantier` ; rien pour un chantier à tranche unique).
3. Suite, donnée par la commande :
   - tranche suivante : `/atelier:write-tests` en TDD, sinon `/atelier:build` ;
   - revue du chantier : `/atelier:review` ;
   - revue enregistrée : `/atelier:close`. Tout commit de code après ce point (tests compris), tout amendement de la spec ou tout rebase rendra la revue obsolète : il faudra repasser par `/atelier:review`.
