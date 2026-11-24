# Plan : FIX-20 TDD décidé tranche par tranche

## Approche
Une seule fonction pure décide du TDD effectif : `effectiveTdd(chantier)` = `slice_tdd` s'il est renseigné, sinon le `tdd` du chantier. `testDrivenPhase` s'appuie dessus (tranche numérotée, revue d'ensemble, `tests_commit` prioritaire, SPIKE, legacy) : le hook de garde, le hook Stop, la revue et la clôture l'appellent déjà et suivent sans changement local. Les commandes (`check-plan`, `set-reviewed`, `set-tdd`) se contentent d'écrire `slice_tdd` au bon moment ; le plan n'est lu qu'à ces moments-là, jamais pour décider d'une écriture.

## Fichiers et couches touchés
- `plugins/atelier/lib/core.mjs` : `planSlices`, `planSliceCount`, `effectiveTdd`, `testDrivenPhase`, `COMMAND_SPEC_FIELDS`, `setReviewedUpdate`, `setTddRefusal` et entrée d'amendement, `reopenTestsRefusal`, messages de `freeze-tests`, `planProblems`, `nextStep` / `phaseStep`.
- `plugins/atelier/lib/cli.mjs` : commande `check-plan`, `set-tdd` sur la tranche courante, `freeze-tests`, `sliceCodeFiles`, `status` (`sliceTdd`).
- `plugins/atelier/test/` : un fichier de test par domaine (`plan.test.mjs` pour la lecture du plan dès la tranche 1), selon la convention de `CLAUDE.md`.
- `plugins/atelier/skills/` : `plan`, `new`, `write-tests`, `build`.
- `plugins/atelier/templates/plan.md` : format de tranche.
- `site/cycle/conception.md`, `site/cycle/tests.md`, `site/cycle/implementation.md`, `site/reference/commandes.md` ; version du plugin.

## Tranches
1. Lecture du plan : `planSlices`, `planSliceCount` qui s'appuie dessus — CA couverts : CA-1 — TDD : oui
2. Phase effective : `slice_tdd` réservé aux commandes, `effectiveTdd`, `testDrivenPhase` (tranche, revue d'ensemble, tests figés prioritaires, SPIKE, legacy) — CA couverts : CA-2, CA-3, CA-4, CA-5, CA-7, CA-8 — TDD : oui
3. Transitions et commandes : `set-reviewed` écrit `slice_tdd`, `set-tdd` sur la tranche, `reopen-tests` en revue d'ensemble, messages de `freeze-tests` et `reopen-tests` — CA couverts : CA-6, CA-9, CA-10, CA-15 — TDD : oui
4. `check-plan` : `planProblems`, valeurs écrites, commande — CA couverts : CA-11, CA-12 — TDD : oui
5. Status et code de tranche : `sliceTdd` dans `status`, libellé « sans TDD pour cette tranche », `sliceCodeFiles` — CA couverts : CA-13, CA-14 — TDD : oui
6. Skills, template, site, version — CA couverts : aucun — TDD : non

## Risques et points d'attention
- `testDrivenPhase` est appelée par le hook de garde, le hook Stop, la revue et la clôture : la relire ligne à ligne, et garder les tests existants verts (CA-4 est la non-régression).
- Amorçage : la tranche 6 bute sur le bug corrigé. En lançant le plugin de la branche (`claude --plugin-dir ./plugins/atelier`), `atelier set-tdd no <raison>` la débloque ; sinon débrayage ponctuel (`/atelier:off`), tracé.
- Conflit avec REF-16 (découpage de `core.test.mjs` par domaine, signée, non commencée) et le lot 2 d'EPIC-17 : FIX-20 passe en premier, il débloque TEC-15 ; REF-16 se recale ensuite.
- Le plan est un chemin libre : `slice_tdd` ne doit jamais se déduire du plan hors des commandes qui l'écrivent (CA-8, CA-12).
