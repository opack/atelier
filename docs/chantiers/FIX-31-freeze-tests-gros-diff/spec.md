---
id: FIX-31
type: FIX
title: freeze-tests plante sur un gros diff et compte les tests venus de main
status: signed
tdd: yes
created_at: 2026-11-24
source: FIX-20, gel de la tranche 2 (decisions.md du 2026-11-24)
rel_origin: FIX-20
signed_by: Opack
signed_at: 2026-11-24
---

# FIX-31 freeze-tests plante sur un gros diff et compte les tests venus de main

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé :
  - `atelier freeze-tests`, en tranche 2 ou plus, plante avec `spawnSync git ENOBUFS` dès que le diff depuis `slice_base` dépasse 1 Mo, tous fichiers confondus. Cas réel : FIX-20 après la fusion de `main` (REF-29, 145 fichiers).
  - Une fois ce plantage contourné, le gel est refusé si `main`, fusionnée dans la branche après `slice_base`, a modifié un fichier de test : « des tests des tranches précédentes ont été modifiés ou supprimés » cite un test que le chantier n'a pas touché.
- Attendu : le gel ne regarde que les fichiers de test modifiés par le chantier lui-même (ses commits et la résolution de ses fusions), comme le fait déjà le calcul du code du chantier depuis FIX-28, et ne plante pas sur la taille du diff.
- Impact : bloquant pour tout chantier découpé en tranches qui fusionne `main` en cours de route ; contournement manuel par copie du plugin. FIX-20 replantera à chaque gel tant que ce n'est pas corrigé.
- Source : FIX-20, `docs/chantiers/FIX-20-tranche-tdd-sans-ca/decisions.md` (2026-11-24, gel de la tranche 2).

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?). -->
Reproduit sur dépôt jetable (helpers de `test/helpers.mjs`) :
1. Plantage : chantier en tranche 2 (`slice_base` posé), un commit de code de 2 Mo, un commit de test, `atelier freeze-tests` → sortie 1, `Error: spawnSync git ENOBUFS` dans `gitRaw`.
2. Faux refus : `main` ajoute `test/main.test.mjs`, fusionnée dans la branche avant `slice_base` ; après `slice_base`, `main` modifie une ligne de ce fichier et est refusionnée ; un commit de test du chantier ; `atelier freeze-tests` → sortie 2, refus qui cite `test/main.test.mjs`.

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible. -->
Confiance forte (les deux reproductions passent par là).
- `testFilesWithRemovedLines` (`plugins/atelier/lib/cli/tdd.mjs`) lance `git diff <slice_base> HEAD --` sans pathspec : le texte du diff de tout le dépôt passe par `gitRaw` (`lib/cli/common.mjs`), un `execFileSync` au tampon par défaut (1 Mo). Le filtre sur `testPaths` n'est appliqué qu'après coup.
- Le même diff compare deux états du dépôt : tout ce que `main` a apporté par fusion depuis `slice_base` y figure. FIX-28 a corrigé ce point pour le code du chantier (`codeFilesSince`, `lib/cli/slices.mjs`), pas pour le gel.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés. -->
- Dans `testFilesWithRemovedLines` : partir des fichiers modifiés par le chantier depuis `slice_base` (`codeFilesSince`, la logique de FIX-28, avec son repli sur git ancien), garder ceux qui sont dans `testPaths`, et ne lancer les trois `git diff` (texte, supprimés, binaires) que sur ces chemins, en pathspecs littéraux. Aucun fichier de test candidat : aucun diff lancé.
- Dans `gitRaw` : tampon porté à 256 Mo, comme la lecture des branches (`lib/cli/relations.mjs`), pour que les autres sorties git volumineuses ne plantent pas de la même façon.
- Fichiers touchés : `plugins/atelier/lib/cli/tdd.mjs`, `plugins/atelier/lib/cli/common.mjs`, `plugins/atelier/test/tdd.test.mjs`. Site : rien à changer (comportement documenté inchangé), à confirmer au plan.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un chantier en tranche 2 dont le diff depuis `slice_base` dépasse 1 Mo hors fichiers de test, quand `atelier freeze-tests` est lancé après un commit de test, alors les tests sont figés (sortie 0, `tests_commit` écrit).
- [ ] CA-2 : Étant donné un fichier de test modifié par `main` après `slice_base` et apporté par une fusion sans conflit, quand `atelier freeze-tests` est lancé, alors le gel n'est pas refusé à cause de ce fichier.
- [ ] CA-3 : Étant donné un test d'une tranche précédente dont le chantier modifie une ligne dans un commit de la tranche, avec une fusion de `main` dans la même tranche, quand `atelier freeze-tests` est lancé, alors le gel est refusé et cite ce fichier (et lui seul).

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- Contournement temporaire (FIX-20) : `freeze-tests` lancé depuis une copie du plugin au tampon agrandi.
- Limite assumée : un fichier de test modifié à la fois par le chantier et par `main` est comparé en entier entre `slice_base` et HEAD ; une ligne retirée par `main` y fait refuser le gel. Cas rare, contournable par `/atelier:write-tests <raison>` (regel).
- Autres diffs complets sans pathspec : `testFilesChangedSince` (`--name-only`, sortie petite) ; couvert par le tampon agrandi de `gitRaw`.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
