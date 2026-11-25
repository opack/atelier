# Plan : FEAT-7 Cycle tests, build, revue par tranche

## Approche
Logique dans des fonctions pures de `core.mjs` ; la CLI ne fait que lire git et `plan.md`.
- `readChantier` lit aussi `plan.md` (`chantier.plan`, texte ou `null`) : `nextStep`, `closeProblems`, `setReviewedRefusal`, `reopenTestsRefusal` gardent leur signature.
- `sliceState(chantier)` → `{ model: 'sliced' | 'single' | 'legacy' | 'none', slice, sliceCount }` : seul point qui lit `slice` / `last_slice` et porte la compatibilité (CA-4) et l'exception `SPIKE` sans TDD (`none`).
- `setReviewedUpdate(chantier, head)` → champs à écrire et message (avancer, passer à la revue du chantier, ou `reviewed_commit`).
- Gel : la CLI fournit `git diff --no-renames --ignore-all-space --ignore-cr-at-eol <slice_base> -- <tests>` ; `removedTestLines(diff)` en extrait les fichiers à lignes retirées, `freezeTestsRefusal` décide (réouverture en cours via `isRefreeze`).
- Hooks : aucune règle nouvelle, la phase vient toujours de `tests_commit` (vidé au passage de tranche) ; CA-12, 13, 17 sont des tests de non-régression sur les nouveaux états.
- Tranche vide (CA-20) et ascendance de `slice_base` (CA-11) réutilisent `reviewCodeFiles` et `merge-base --is-ancestor` comme `reviewFacts`.

## Fichiers et couches touchés
- `plugins/atelier/lib/core.mjs` : `planSliceCount`, `sliceState`, `removedTestLines`, `freezeTestsRefusal`, `setReviewedUpdate` ; `COMMAND_SPEC_FIELDS`, `readChantier`, `reopenTestsRefusal`, `setReviewedRefusal`, `closeProblems`, `nextStep`.
- `plugins/atelier/lib/cli.mjs` : `status` (texte, `--json`), `freeze-tests`, `reopen-tests`, `set-reviewed`, `close-check`, rappel de session.
- `plugins/atelier/test/core.test.mjs` : tests de chaque CA.
- `plugins/atelier/skills/` : `plan`, `write-tests`, `build`, `review`, `close`, `status` ; `agents/reviewer.md`.
- `plugins/atelier/templates/` : `plan.md`, `revue.md`, `bilan.md`.
- `site/cycle/*.md`, `site/guide/vue-ensemble.md` (SVG), `site/reference/commandes.md`, `site/reference/glossaire.md`, page de l'en-tête de spec, `README.md` ; version du plugin (mineure).

## Tranches
1. État des tranches : `planSliceCount`, `sliceState`, `chantier.plan`, nouveaux champs protégés, `slice` / `sliceCount` dans `status --json` — CA couverts : CA-1, CA-2, CA-3, CA-4, CA-5
2. Gel par tranche : `freeze-tests` écrit `slice: 1`, refuse les lignes de tests antérieurs modifiées et un `slice_base` non ancêtre ; `reopen-tests` en tranche N > 1 et en `slice: chantier` ; non-régression des hooks — CA couverts : CA-6, CA-7, CA-8, CA-9, CA-10, CA-11, CA-12, CA-13
3. Passage de tranche : `set-reviewed` avance, passe à la revue du chantier ou enregistre `reviewed_commit` ; refus tranche vide et `slice_base` non ancêtre — CA couverts : CA-11, CA-14, CA-15, CA-16, CA-17, CA-18, CA-19, CA-20
4. Clôture, prochaine étape, affichage : `closeProblems`, `nextStep` (« Tranche N/M : »), `status` texte, rappel de session, tranche absente du plan — CA couverts : CA-21, CA-22, CA-23, CA-24, CA-25, CA-26
5. Skills, agent, templates : cycle par tranche dans les skills, validation explicite et commit `review <tranche>`, mandat transversal du reviewer pour la revue du chantier, templates ; « tour » retiré (test de recherche) — CA couverts : CA-27 (plugin)
6. Site, README, version : pages du cycle, SVG, commandes, glossaire, en-tête de spec, montée mineure — CA couverts : CA-27 (site, README)

## Risques et points d'attention
- Ce chantier est mené avec atelier 0.2.0 (ancien modèle) : tests de tous les CA écrits d'un coup, revue unique. Accepté (voir `decisions.md`).
- `slice_base` invalidé par un rebase : refus sans recalcul ; le champ est protégé contre l'agent, seul l'utilisateur peut le corriger à la main : le message de refus le dit.
- À relire ligne à ligne : le contrôle du gel (un faux négatif laisse passer une modification de test) et la compatibilité CA-4 (une erreur fait changer de modèle un chantier en cours).
- Lecture du plan : seules les entrées numérotées de premier niveau de « Tranches » ; commentaires HTML retirés, sous-listes ignorées ; tester un plan en CRLF.
