# Bilan : FIX-31 freeze-tests plante sur un gros diff et compte les tests venus de main

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
`atelier freeze-tests` ne plante plus sur un gros diff depuis `slice_base` et ne refuse plus le gel pour un test que seule une fusion de `main` a modifié. Le contrôle des tests des tranches précédentes ne porte plus que sur les fichiers de test touchés par le chantier (calcul de FIX-28), et les diffs sont limités à ces fichiers. Débloque FIX-20, dont chaque gel plantait depuis la fusion de REF-29.

**Cause réelle** : confirmée, les deux. `testFilesWithRemovedLines` lançait un `git diff <slice_base> HEAD` sur tout le dépôt, filtré sur `testPaths` après coup : la sortie dépassait le tampon de 1 Mo d'`execFileSync` (`gitRaw`). Le même diff, comparant deux états du dépôt, comptait ce que `main` avait apporté par fusion.

**Autres endroits où le schéma existe** : `testFilesChangedSince` (`lib/cli/tdd.mjs`) liste aussi les fichiers sans pathspec, mais en `--name-only` (sortie petite) et couverte par le tampon agrandi ; tout autre appel de `gitRaw` en profite aussi.

## 2. Livré vs spécifié
Tous les tests sont dans `plugins/atelier/test/tdd.test.mjs`, describe « gel après un gros diff ou une fusion de la branche par défaut ».

| Critère | Statut | Test |
|---|---|---|
| CA-1 : diff > 1 Mo hors tests → gel accepté | Livré | `fige les tests quand le diff depuis slice_base dépasse 1 Mo hors fichiers de test` |
| CA-2 : test modifié par `main` et fusionné → pas de refus | Livré (git ≥ 2.36, voir §6) | `ne refuse pas le gel pour un test modifié par la branche par défaut…` |
| CA-3 : test d'une tranche précédente modifié par le chantier → refus, ce fichier seul | Livré | `refuse le gel en ne citant que le test d’une tranche précédente modifié par le chantier…` |

Aucun écart à la spec, aucun amendement.

## 3. Choix techniques
- Candidats : `codeFilesSince(projectRoot, slice_base, 'first-parent')` filtré sur `testPaths` ; aucun candidat, aucun diff.
- Les trois `git diff` (texte, supprimés, binaires) reçoivent les candidats en pathspecs `:(literal)`.
- `gitRaw` : `maxBuffer` 256 Mo, comme la lecture des branches (`lib/cli/relations.mjs`).
- Repli `first-parent` sur git ancien plutôt que sans option : un faux refus contournable vaut mieux qu'une résolution de conflit non contrôlée (decisions.md).

## 4. Éléments de code principaux
- `plugins/atelier/lib/cli/tdd.mjs` : `testFilesWithRemovedLines`, appelée par `commandFreezeTests`.
- `plugins/atelier/lib/cli/slices.mjs` : `codeFilesSince` (FIX-28), réutilisée telle quelle.
- `plugins/atelier/lib/cli/common.mjs` : `gitRaw`.
- Site : inchangé, la règle y est décrite pour les modifications du chantier, ce que le correctif rétablit.

## 5. Pistes écartées
- Tampon agrandi seul : corrigeait le plantage, pas le faux refus.
- Diff commit par commit (`git log -p --diff-merges=remerge`) : aurait signalé les retouches de tests ajoutés dans la tranche même.

## 6. Dette et suites
- Sur git < 2.36 ou sans ref de la branche par défaut, le faux refus de CA-2 revient (repli de FIX-28, OD1 accepté) ; le plantage reste corrigé.
- Un fichier de test modifié à la fois par le chantier et par `main` est comparé en entier : une ligne retirée par `main` y fait refuser le gel (regel possible).

## 7. Verdict de revue
Une revue (chantier à tranche unique, 2026-11-25, commit revu 1f2ed1d, base a16af62) : aucun point. Vérification de surapprentissage : OD1 accepté (decisions.md).

| Point | Traitement |
|---|---|
| Aucun | |

- Verdict :
- Validé par :
- Date :
