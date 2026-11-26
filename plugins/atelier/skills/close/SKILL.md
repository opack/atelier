---
description: Clôture le chantier actif — vérifications déterministes (revue à jour, travail commité, contrôles verts), bilan, verdict humain, PR. Ne fait pas la revue (/atelier:review).
disable-model-invocation: true
---

# Clôturer le chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

La clôture ne relit pas et ne corrige pas le code : c'est le rôle de `/atelier:review`. Ici, on vérifie que le code clôturé est bien celui qui a été relu, on écrit le bilan et on recueille le verdict.

## 1. Préalables

- `atelier status --json` : il faut une spec **signée**. Un chantier mené en débrayage doit avoir sa spec écrite et signée avant la clôture.
- **EPIC** : clôture sur une branche `epic/<ID>-<slug>` (réutilisée si elle existe, sinon recréée depuis `baseBranch` à jour, en général la branche par défaut). Sans branche d'intégration, pas de revue (il n'a pas de code). Tous ses enfants doivent être clos **dans cette branche** (fusionnés) et au moins l'un d'eux `done` ; sinon la vision n'a pas été réalisée : propose `atelier set-status abandoned` (les enfants encore ouverts sont listés, sans cascade). Un chantier compte comme enfant dès qu'une de ses versions, sur n'importe quelle branche, déclare `rel_parent` vers l'EPIC : un enfant inattendu vient souvent d'une vieille branche (locale ou distante non élaguée) qui porte encore un ancien rattachement ; supprime-la ou élague (`git fetch --prune`).
- **EPIC à branche d'intégration** (`integration_branch: yes`) : sa branche `epic/<ID>-<slug>` est la branche d'intégration où ses enfants ont été fusionnés ; la clôture s'y fait. Contrairement à un EPIC sans l'option, une **revue d'ensemble** à jour est exigée (`reviewState` : `current`) : sinon, renvoie vers `/atelier:review`. Les revues des enfants doivent être encore dans l'historique (aucun enfant fusionné par squash, aucun rebase de la branche d'intégration) : `close-check` nomme l'enfant fautif ; rétablis l'historique (reflog, branche distante) et fusionne les enfants par un commit de fusion. Un point bloquant de la revue d'ensemble se corrige par un **enfant correctif** (`FIX` ou `REF`, `rel_parent` vers l'EPIC) fusionné dans la branche d'intégration, puis une nouvelle revue d'ensemble, jamais par du code écrit sur la branche de l'EPIC.
- **La branche par défaut avance** pendant l'EPIC : fusionne-la dans la branche d'intégration (`git merge`, commit `[<ID de l'EPIC>] merge <branche par défaut>`), **jamais de rebase** : un rebase réécrit les commits revus des enfants, et leurs revues ne prouveraient plus rien. Une résolution de conflits sur du code passe par le débrayage (`atelier bypass`) et périme la revue d'ensemble ; une fusion sans conflit sur du code la laisse à jour. Les enfants ouverts fusionnent ensuite la branche d'intégration dans leur propre branche s'ils en ont besoin, avec le message `[<ID de l'enfant>] merge <branche d'intégration>`.
- Hors `SPIKE` sans TDD et `EPIC` sans branche d'intégration, `reviewState` doit valoir `current`. S'il vaut `none` ou `stale`, arrête-toi et propose `/atelier:review` (les raisons sont dans `reviewProblems`).
- Chantier à plusieurs tranches : `slice` doit valoir `"chantier"` et la revue à jour est celle de la revue du chantier. Une tranche encore en cours, ou une tranche ajoutée au plan après la dernière revue de tranche, bloque la clôture : retour au cycle de la tranche (`/atelier:write-tests` ou `/atelier:build`, puis `/atelier:review`).
- Vérifie que chaque commit du chantier porte `[<ID>]`, en les comptant avec `git log --first-parent <baseBranch>..HEAD` (`baseBranch` de `atelier status --json`), pour l'EPIC comme pour l'enfant : les commits apportés par une fusion ne comptent pas. Sur la branche d'un EPIC à branche d'intégration, les commits de fusion de ses enfants en sont dispensés ; une fusion de la branche par défaut ou de la branche d'intégration s'écrit `[<ID>] merge <branche>`.

## 2. Bilan

À partir de la spec, du plan, de `decisions.md`, du diff et de `revue.md`, écris `bilan.md` depuis `atelier template bilan` :
- **Livré vs spécifié** : chaque `CA` avec son statut et le test qui le couvre.
- **Choix techniques**, **éléments de code principaux** (ce qu'un nouveau venu doit lire en premier), **pistes écartées**, **dette et suites**.
- **Verdict de revue** : repris de `revue.md` (revues de tranche et du chantier), puis un point par identifiant (`RB1`, `RD1`…) avec son traitement final, celui de sa dernière occurrence (exceptions acceptées comprises). Un point `reporté` vers « Dette et suites » figure aussi dans la section « Dette et suites » du bilan.
- Pour un `FIX` : la cause réelle, confirmée ou non par rapport à la cause probable, et les autres endroits où le même schéma existe.
- Pour un `SPIKE` : la réponse à la question, et la suite (ADR, nouveau chantier, abandon).
- Pour un `EPIC` : le prévu (`plan.md`) confronté au réalisé (enfants donnés par `atelier status`, avec leur statut), les écarts de `decisions.md`, et l'atteinte de chaque CA global. Pas de section de revue, sauf pour un EPIC à branche d'intégration : le verdict de sa revue d'ensemble.
- Une décision qui dépasse le chantier : propose un ADR dans `docs/decisions/` (`atelier template adr`).

Fais relire le bilan à l'utilisateur.

## 3. Verdict

Demande le verdict à l'utilisateur : **accepté**, **accepté avec exceptions** (lesquelles), ou **refusé** (que faut-il reprendre). Seule sa réponse explicite vaut verdict. Reporte-le dans la section « Verdict de revue » du bilan avec son nom et la date.

- **Refusé** : ne clôture pas. Selon ce qui est à reprendre : `/atelier:build`, `/atelier:write-tests` ou `/atelier:amend`, puis `/atelier:review`.
- **Accepté** :
  1. `atelier close-check`, maintenant et pas avant : il vérifie les tranches (toutes revues, revue du chantier faite) et la revue (présente, ancêtre de `HEAD`, aucun commit de code ni amendement depuis ; sauf `SPIKE` sans TDD et `EPIC` sans branche d'intégration), les dépendances (`rel_depends_on` : toutes `done` dans cette branche), les enfants d'un EPIC, l'absence de code non commité, les tests figés en TDD, les points de `revue.md` (aucun `RB` ni `RD` sans traitement, aucun encore `reporté (tranche N)`, `revue.md` commité ; sauf `SPIKE` sans TDD et `EPIC` sans branche d'intégration), et lance les contrôles. S'il échoue, présente les problèmes et renvoie vers `/atelier:review` (pour un SPIKE sans TDD ou un EPIC sans branche d'intégration, sans revue : corriger puis relancer `/atelier:close` ; une dépendance pas livrée ou pas fusionnée : la livrer, puis fusionner la branche par défaut, ou la branche d'intégration pour l'enfant d'un EPIC à branche d'intégration ; un chantier hors de l'EPIC qui dépend d'un enfant livré seulement dans la branche d'intégration attend la clôture de l'EPIC ; une dépendance abandonnée : la retirer par `/atelier:amend` ou dépendre du chantier qui la remplace).
  2. `atelier set-status done` (qui refait les mêmes vérifications) ; `atelier bypass off`.
  3. Commite : `docs(chantiers): [<ID>] close` (spec et bilan).
  4. Propose la PR : titre `[<ID>] <titre>`, description avec le résumé du bilan et les liens vers `spec.md`, `revue.md` et `bilan.md`. Ne la crée que si l'utilisateur le demande. Sa cible est `baseBranch` (`atelier status --json`) :
     - **enfant d'un EPIC à branche d'intégration** : la PR vise la branche d'intégration et se fusionne par un **commit de fusion**, ni squash ni rebase (ils effaceraient le commit revu, et la clôture de l'EPIC le refuserait) ; dis-le à l'utilisateur. Un dépôt réglé pour n'accepter que le squash ne peut pas utiliser l'option ;
     - **EPIC à branche d'intégration** : une seule PR fusionne la branche d'intégration dans sa `baseBranch` (en général la branche par défaut ; la branche d'intégration du parent pour un sous-EPIC), elle aussi par un commit de fusion ;
     - sinon : `baseBranch`, en général la branche par défaut.
