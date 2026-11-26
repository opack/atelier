---
id: REF-36
type: REF
title: Supprimer la façade lib/core.mjs
status: signed
tdd: no              # suppression de code mort : la suite existante est la preuve
rel_parent: EPIC-17
rel_origin: REF-29
created_at: 2026-11-26
signed_by: Opack
signed_at: 2026-11-26
slice_tdd: no
reviewed_commit: bbd7e133278ba9061db268898cebb52c75f03712
slice: 1
---

# REF-36 Supprimer la façade lib/core.mjs

<!-- Règle d'or : le comportement ne change pas. S'il change, c'est un FEAT ou un FIX. -->

## 1. Périmètre
<!-- Modules, fichiers, couches concernés. Hors périmètre explicite. -->

- `plugins/atelier/lib/core.mjs` : supprimé.
- `plugins/atelier/test/architecture.test.mjs` : retrait des règles qui ne protègent plus que la façade (`facadeProblems`, `coreImportProblems`, l'exception `core.mjs` de `importProblems`) et des tests qui les éprouvent.
- Commentaires qui renvoient à `lib/core.mjs` (RD8 de REF-29) : `lib/cli/close.mjs`, `lib/cli/stop-hook.mjs`, `lib/cli/review.mjs` ; ils renvoient au module de domaine qui porte la fonction citée.
- `CLAUDE.md` : description de `lib/core.mjs` et règles de la façade retirées.

Hors périmètre : toute autre retouche de `lib/` ou des tests ; les specs, plans et bilans des chantiers clos, qui gardent leurs mentions de `core.mjs`.

## 2. Pourquoi maintenant
<!-- La douleur, si possible mesurable : bugs récurrents, temps perdu, duplication, feature bloquée.
Question si manquant : quel bénéfice concret, et pour quand ? -->

REF-29 a gardé `core.mjs` en façade pour les branches ouvertes avant lui. Ces branches (FIX-20, FEAT-27, FEAT-21) sont fusionnées, et le test d'architecture interdit déjà à tout test ou module de l'importer : 83 lignes sans aucun usager. Elle coûte pourtant : `CLAUDE.md` porte deux règles sur elle, que chaque session lit, et trois commentaires envoient le lecteur vers un fichier qui ne contient pas le code cité. Décision du 2026-11-24 dans le `decisions.md` d'EPIC-17, mise en œuvre en parallèle de REF-34 (décision du 2026-11-26).

## 3. État actuel → état cible
<!-- Ce qui existe, ce qu'on veut obtenir. -->

- Actuel : `lib/core.mjs` réexporte les noms de l'ancien module ; le test d'architecture vérifie qu'il ne contient que des réexports et que personne ne l'importe.
- Cible : `lib/core.mjs` n'existe plus ; le test d'architecture ne parle plus de façade ; aucun fichier de `lib/` ni `CLAUDE.md` ne mentionne `core.mjs`.

## 4. Preuve de non-régression
<!-- Tests existants qui couvrent la zone ; tests de caractérisation à ajouter AVANT de toucher au code ; vérifications manuelles restantes.
Question si manquant : les tests actuels détecteraient-ils une régression ici ? -->

- Aucun module ni test n'importe la façade (vérifié par le test d'architecture actuel) : la supprimer ne peut casser qu'un import oublié, que `npm test` ferait échouer au chargement.
- Comparaison des noms de tests rapportés par `node --test` avant / après : 498 tests aujourd'hui, 495 après. Les 3 retirés sont ceux de la façade : « aucun test ni module de lib/ n'importe la façade [REF-29 CA-5] », « une façade qui contient autre chose que des réexports est signalée [REF-29 CA-4] », « un test ou un module de lib/ qui importe la façade est signalé [REF-29 CA-5] ». Tous les autres gardent leur nom et passent. Le test « ce dépôt respecte toutes les règles [REF-29 CA-4] » perd sa ligne sur la façade et garde son nom.
- `claude plugin validate ./plugins/atelier` passe ; `bin/atelier status` tourne.

## 5. Stratégie
<!-- Étapes petites et réversibles, chacune fusionnable seule.
Question si manquant : peut-on découper pour que chaque étape soit fusionnable seule ? -->

Une seule tranche : suppression du fichier, retrait des règles et tests de façade, commentaires, `CLAUDE.md`. Le tout tient en un diff de moins de 150 lignes, surtout des suppressions.

## 6. Risques
<!-- Ce qui peut casser, impact données, performance, migration. Optionnel. -->

- Une branche ouverte qui importerait encore `core.mjs` : aucune aujourd'hui (FEAT-35 et REF-34 n'ont pas de code qui l'importe, EPIC-14 n'a que de la documentation). Une branche qui le ferait échouerait déjà au test d'architecture actuel.
- Conflit avec REF-34, qui tourne en parallèle : aucun fichier en commun (REF-34 touche `spec.mjs`, `tdd.mjs`, `slices.mjs`, `write-guard.mjs`, `review-points.mjs`, `common.mjs` et des fichiers de tests neufs). Si REF-34 ajoute une règle à `architecture.test.mjs`, la seconde PR fusionne `main` avant sa revue.

## 7. Critère de fin
<!-- Quand s'arrête-t-on ? Qu'est-ce qui est volontairement laissé en l'état ? -->

- CA-1 : Étant donné le dépôt à la fin de REF-36, quand on liste `plugins/atelier/lib/`, alors `core.mjs` n'existe pas, et `grep -rn "core.mjs" plugins/atelier/lib plugins/atelier/test CLAUDE.md` ne renvoie rien.
- CA-2 : Étant donné la suite de tests, quand `npm test` tourne, alors tous les tests passent, et la liste de leurs noms est celle d'avant REF-36 moins les seuls tests de la façade, nommés dans la revue.
- CA-3 : Étant donné les trois commentaires de `lib/cli/` qui renvoyaient à `lib/core.mjs`, quand on les lit, alors chacun cite le module de domaine qui déclare la fonction mentionnée : `closeProblems` dans `lib/close.mjs`, `decideStop` dans `lib/stop-hook.mjs`, `reviewProblems` dans `lib/review.mjs`.

Laissé en l'état : les mentions de `core.mjs` dans les documents des chantiers clos.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
