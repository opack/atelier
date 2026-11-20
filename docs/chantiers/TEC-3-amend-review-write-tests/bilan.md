# Bilan : TEC-3 Amender la spec, rouvrir les tests, séparer revue et clôture

## 1. Résumé
Le plugin atelier passe en 0.2.0. Ce chantier s'adresse aux utilisateurs d'atelier et à l'agent qui suit la méthode. Cinq évolutions :
- une spec signée ne se modifie plus que par un amendement daté, imposé par le hook ;
- les tests figés se rouvrent explicitement par `/atelier:write-tests` (ex-`/atelier:tests`) ;
- la revue (`/atelier:review`) est séparée de la clôture (`/atelier:close`) ;
- la clôture vérifie de façon déterministe que le code clôturé est celui qui a été relu ;
- le site et le README décrivent le nouveau cycle, avec un schéma SVG.

État final : relu en 4 tours, tous les points de vérification sont satisfaits. TEC-3 lui-même a été revu et clôturé avec la 0.2.0 locale (option A du plan).

## 2. Livré vs spécifié
Un TEC n'a pas de `CA` : le tableau suit les points de vérification du §6.

| Critère | Statut | Test |
|---|---|---|
| Garde, spec non brouillon : refus (corps ou `title` sans entrée, entrée non datée, modifiée, supprimée ou insérée avant, section en double, `id`/`type`/`tdd`, `Write` sur `abandoned` ou sur une spec supprimée mais signée dans `HEAD`, `reviewed_commit`, erreur git) | Livré | `core.test.mjs`, describe « write guard on a spec that is no longer a draft » ; rejeu |
| Garde : acceptations (entrée datée, plusieurs éditions par rapport à `HEAD`, section créée, chemin de casse différente), CRLF, brouillon libre | Livré | `core.test.mjs` ; cas « casse différente » accepté ajouté en revue (tour 1, D4) ; rejeu |
| Décision de clôture : refus (sans revue, commit de code ou de test, fusion, renommage, `.claude/atelier.json`, non commité, non ancêtre, introuvable, amendement, contrôles rouges, TDD non figé) et acceptations (nominal, `SPIKE`, documentation) | Livré | `core.test.mjs`, describe « close decision » et « review state » ; rejeu (commit de code, commit `.claude`, commit de documentation, nominal) |
| Refus de `reopen-tests`, `set-reviewed`, `set-status draft` | Livré | `core.test.mjs` ; `reopen-tests` refuse aussi une spec non signée (ajouté en revue, tour 1, D3) |
| Prochaine étape et `reviewState` | Livré | `core.test.mjs`, describe « next step » et « review state » ; rejeu (`stale` après un commit de code) |
| Entrées d'amendement et détection du regel | Livré | `core.test.mjs`, describe « amendments section » et « refreeze detection » ; rejeu (premier gel sans entrée, réouverture et regel tracés) |
| `claude plugin validate .` et `./plugins/atelier` | Livré | Validation passée (2026-11-20) |
| `npm run build` du site sans erreur ni lien mort | Livré | Build passé (2026-11-20, VitePress échoue sur lien mort) |
| Schéma SVG : captures Playwright clair et sombre, bureau et mobile | Livré | Fait en tranche 6 (`decisions.md`) |
| Rejeu de bout en bout sur dépôt jetable | Livré | 35 vérifications sur 35 conformes (git 2.45.1, Node 22), détail ci-dessous |
| Plus aucune référence à `/atelier:tests` | Livré | Recherche dans le plugin, le README et le site : aucune |

`npm test` : 72 tests, tous verts.

**Rejeu de bout en bout** (2026-11-20, dépôt git jetable, chantier `FEAT-1` en TDD). La CLI est lancée telle quelle et le hook `hook-guard` reçoit le JSON de Claude Code. Une édition acceptée est appliquée pour de vrai :
- **amendement** :
  - édition du corps sans entrée : refusée ;
  - entrée datée ajoutée, puis deux éditions du corps : acceptées ;
  - entrée existante modifiée : refusée ;
  - `Write` complet : refusé ;
  - `tdd` modifié par édition : refusé ;
  - `set-status draft` : refusé ;
- **réouverture** :
  - code refusé avant le gel ;
  - premier gel sans entrée ;
  - tests refusés une fois figés ;
  - `reopen-tests` trace `tests rouverts (gel quitté : <hash>) : <raison>` ;
  - pendant la réécriture des tests, le code est refusé et les tests acceptés ;
  - le regel trace `tests regelés : <hash>` ;
- **revue et clôture** :
  - `close-check` est refusé sans revue ;
  - `set-reviewed` écrit le hash complet de `HEAD` ;
  - `reviewed_commit` n'est pas modifiable par l'outil d'édition ;
  - `close-check` est accepté après la revue et après un commit de documentation ;
  - `close-check` et `set-status done` sont refusés après un commit de code, et la revue passe à `stale` ;
  - `set-reviewed` est refusé avec un `.claude/atelier.json` non commité ;
  - `close-check` est refusé après un commit sous `.claude/` ;
  - `close-check` puis `set-status done` sont acceptés dans le cas nominal.

Premier passage : 5 écarts, tous dus à une erreur du script (`node --test test/` ne prend pas un dossier sous Node 22). Ils montrent que `close-check` refuse bien quand les contrôles sont rouges.

**Écarts à la spec** : aucun. Une précision a été faite par amendement (2026-11-20 : « sort » remplacé par « traitement » pour les points de revue).

## 3. Choix techniques
- **Garde contre la version commitée** : la référence est la spec de `HEAD` si elle n'est pas en brouillon. On écrit l'entrée d'abord, puis on modifie le corps en autant d'éditions que nécessaire.
- **Toute écriture de la CLI dans la spec est commitée aussitôt** (`freeze-tests` compris, dès le premier gel). Aucune entrée ne sert ainsi de passe-droit pour modifier le corps.
- **Un changement de TDD dans un amendement est une décision à part** : accord, `set-tdd` et commit, avant toute modification de la spec (tour 2 de revue).
- **Regel détecté par la position des entrées**, avec des libellés fixes, sans champ supplémentaire.
- **`.claude/**` compte toujours comme code pour la revue**, quels que soient les chemins libres (tour 1, D1).
- **Commits de code détectés par `git log --no-renames --diff-merges=first-parent`** : un renommage apparaît comme une suppression suivie d'un ajout, et les fusions sont inspectées. Il faut git 2.31 ou plus.
- **Revue obsolète, sans plantage, sur toute erreur git** ; `close-check` liste une erreur git comme un problème.
- **Refus de la CLI écrits comme fonctions pures** dans `core.mjs`, testés sans dépôt ; le vrai git est couvert par le rejeu.
- **Amorçage, option A** : TEC-3 est revu et clôturé avec la 0.2.0 locale.

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs` :
  - amendements : `parseAmendments`, `appendAmendmentEntry`, `isRefreeze` ;
  - garde : `specWriteRefusal`, appelée par `decideWrite` ;
  - refus de la CLI : `reopenTestsRefusal`, `setReviewedRefusal`, `setStatusRefusal` ;
  - revue : `reviewCodeFiles`, `reviewState`, `reviewProblems` ;
  - clôture : `closeProblems` ;
  - `nextStep(chantier, reviewState)`.
- `plugins/atelier/lib/cli.mjs` :
  - lecture git : `committedFileText` (spec de `HEAD`, chemin résolu par `ls-files :(icase,literal)`), `reviewFacts`, `closeCheckProblems` ;
  - commandes `set-reviewed`, `close-check`, `reopen-tests`, `freeze-tests`, `set-tdd` ;
  - hook `hookGuard`.
- `plugins/atelier/skills/` : `write-tests` (ex-`tests`), `amend`, `review` (nouveaux), `close` (réécrit).
- `plugins/atelier/templates/revue.md` (nouveau) ; agent `reviewer` (description).
- `plugins/atelier/test/core.test.mjs` : tous les cas du §6.
- `site/` :
  - `cycle/revue.md` et `cycle/amendement.md` (nouvelles pages) ;
  - schéma SVG dans `guide/vue-ensemble.md`.
- `README.md`.

À lire en premier : `specWriteRefusal` et `closeProblems` dans `core.mjs`, puis les skills `amend` et `review`.

## 5. Pistes écartées
- Exiger l'entrée d'amendement dans la même édition que la modification du corps : il faudrait des éditions géantes.
- Vérifier que l'entrée décrit bien la modification : c'est invérifiable, la re-signature humaine juge le contenu.
- Laisser l'entrée de `set-tdd` en attente pendant l'amendement (correction du tour 1), ou amender la spec pour l'autoriser : cela affaiblit la garantie « pas de passe-droit ».
- Tests d'intégration sur des dépôts git temporaires : lents et fragiles sous Windows, remplacés par le rejeu.
- Clôturer TEC-3 avec la 0.1.1 : on aurait clôturé sans revue le chantier qui la rend obligatoire.
- Documenter `claude -p` et la CLI par `node` : fragile, et c'est un détail d'implémentation.

## 6. Dette et suites
- **Exception acceptée** : une erreur git en lisant la spec commitée bloque aussi l'édition d'une spec en brouillon (fail-closed). Le message le dit.
- `formatStatus` (texte du rappel de début de session) n'est pas testé ; seule la logique derrière l'est.
- Le rejeu de bout en bout est un script ponctuel, gardé hors du dépôt. Pour couvrir le vrai git en continu, il faudrait en faire un test d'intégration.
- `site/cycle/amendement.md`, étape 5 : le passage à `/atelier:write-tests` après un passage en TDD reste implicite (point écarté au tour 4).
- Le `main` local du dépôt est en retard sur `origin/main` : à resynchroniser.
- La dette de TEC-1 hors périmètre reste ouverte : écritures par le shell, budget du hook de fin, casse sous macOS.

## 7. Verdict de revue
Repris de `revue.md` : 4 tours, base `307b77a`, commit revu final `f0ecc01`.
- **Tour 1** :
  - 2 bloquants corrigés : premier gel non commité ; commit séparé de `set-tdd` en plein amendement ;
  - 4 points à discuter corrigés : `.claude/**` contournable, plantage de `close-check` sur une erreur git, `reopen-tests` sur un chantier non signé, test du cas « casse différente » ;
  - 1 exception acceptée : erreur git sur une spec en brouillon ;
  - 1 point écarté : `formatStatus`.
- **Tour 2** :
  - 1 bloquant corrigé : la correction du tour 1 contredisait la spec §4, d'où l'option (b) ;
  - 3 points à discuter corrigés (documentation du site, `revue.md`) ;
  - 1 point écarté.
  - Amendement de vocabulaire (« traitement »).
- **Tour 3** : aucun bloquant, 2 points de documentation de `amend` corrigés.
- **Tour 4** : aucun bloquant, 1 point écarté (étape 5 de la page Amender la spec).

- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-20
