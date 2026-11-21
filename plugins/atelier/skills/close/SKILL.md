---
description: Clôture le chantier actif — vérifications déterministes (revue à jour, travail commité, contrôles verts), bilan, verdict humain, PR. Ne fait pas la revue (/atelier:review).
disable-model-invocation: true
---

# Clôturer le chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

La clôture ne relit pas et ne corrige pas le code : c'est le rôle de `/atelier:review`. Ici, on vérifie que le code clôturé est bien celui qui a été relu, on écrit le bilan et on recueille le verdict.

## 1. Préalables

- `atelier status --json` : il faut une spec **signée**. Un chantier mené en débrayage doit avoir sa spec écrite et signée avant la clôture.
- **EPIC** : clôture sur une branche `epic/<ID>-<slug>` (réutilisée si elle existe, sinon recréée depuis la branche par défaut à jour). Pas de revue (il n'a pas de code). Tous ses enfants doivent être clos **dans cette branche** (fusionnés) et au moins l'un d'eux `done` ; sinon la vision n'a pas été réalisée : propose `atelier set-status abandoned` (les enfants encore ouverts sont listés, sans cascade). Un chantier compte comme enfant dès qu'une de ses versions, sur n'importe quelle branche, déclare `rel_parent` vers l'EPIC : un enfant inattendu vient souvent d'une vieille branche (locale ou distante non élaguée) qui porte encore un ancien rattachement ; supprime-la ou élague (`git fetch --prune`).
- Hors `SPIKE` et `EPIC`, `reviewState` doit valoir `current`. S'il vaut `none` ou `stale`, arrête-toi et propose `/atelier:review` (les raisons sont dans `reviewProblems`).
- Vérifie que chaque commit du chantier porte `[<ID>]`.

## 2. Bilan

À partir de la spec, du plan, de `decisions.md`, du diff et de `revue.md`, écris `bilan.md` depuis `atelier template bilan` :
- **Livré vs spécifié** : chaque `CA` avec son statut et le test qui le couvre.
- **Choix techniques**, **éléments de code principaux** (ce qu'un nouveau venu doit lire en premier), **pistes écartées**, **dette et suites**.
- **Verdict de revue** : repris de `revue.md` (tours, points bloquants traités, exceptions acceptées).
- Pour un `FIX` : la cause réelle, confirmée ou non par rapport à la cause probable, et les autres endroits où le même schéma existe.
- Pour un `SPIKE` : la réponse à la question, et la suite (ADR, nouveau chantier, abandon).
- Pour un `EPIC` : le prévu (`plan.md`) confronté au réalisé (enfants donnés par `atelier status`, avec leur statut), les écarts de `decisions.md`, et l'atteinte de chaque CA global. Pas de section de revue.
- Une décision qui dépasse le chantier : propose un ADR dans `docs/decisions/` (`atelier template adr`).

Fais relire le bilan à l'utilisateur.

## 3. Verdict

Demande le verdict à l'utilisateur : **accepté**, **accepté avec exceptions** (lesquelles), ou **refusé** (que faut-il reprendre). Seule sa réponse explicite vaut verdict. Reporte-le dans la section « Verdict de revue » du bilan avec son nom et la date.

- **Refusé** : ne clôture pas. Selon ce qui est à reprendre : `/atelier:build`, `/atelier:write-tests` ou `/atelier:amend`, puis `/atelier:review`.
- **Accepté** :
  1. `atelier close-check`, maintenant et pas avant : il vérifie la revue (présente, ancêtre de `HEAD`, aucun commit de code ni amendement depuis ; sauf `SPIKE` et `EPIC`), les dépendances (`rel_depends_on` : toutes `done` dans cette branche), les enfants d'un EPIC, l'absence de code non commité, les tests figés en TDD, et lance les contrôles. S'il échoue, présente les problèmes et renvoie vers `/atelier:review` (pour un SPIKE ou un EPIC, sans revue : corriger puis relancer `/atelier:close` ; une dépendance pas livrée ou pas fusionnée : la livrer, puis fusionner la branche par défaut ; une dépendance abandonnée : la retirer par `/atelier:amend` ou dépendre du chantier qui la remplace).
  2. `atelier set-status done` (qui refait les mêmes vérifications) ; `atelier bypass off`.
  3. Commite : `docs(chantiers): [<ID>] close` (spec et bilan).
  4. Propose la PR : titre `[<ID>] <titre>`, description avec le résumé du bilan et les liens vers `spec.md`, `revue.md` et `bilan.md`. Ne la crée que si l'utilisateur le demande.
