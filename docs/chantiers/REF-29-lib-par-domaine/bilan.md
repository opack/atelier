# Bilan : REF-29 lib/ rangé par domaine

## 1. Résumé
`lib/core.mjs` (1799 lignes) et `lib/cli.mjs` (1096 lignes) sont découpés en 14 modules purs `lib/<domaine>.mjs` et 14 modules d'entrées / sorties `lib/cli/<domaine>.mjs`, sur les domaines des tests de REF-16. `cli.mjs` ne garde que la table des commandes et `main`, et `core.mjs` devient une façade de réexports. Un test d'architecture garde les règles. Le comportement est inchangé, prouvé déclaration par déclaration par `check-moves.mjs` : 340 tests de la base plus 10 d'architecture, tous verts. Deuxième lot d'EPIC-17.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 : chaque déclaration dans le module que donne la table du plan, aucun fichier de `lib/` au-delà de 400 lignes, `cli.mjs` réduit à la table et à `main` | livré | `check-moves.mjs` (placement contre la table, 199 déclarations déplacées sur 201, les 2 restantes sont `commands` et `main`) ; `architecture.test.mjs` (taille) ; plus long module : `review-points.mjs`, 301 lignes |
| CA-2 : la façade exporte les 83 noms de la base, identiques, et ne contient que des réexports | livré | `check-moves.mjs` (noms, `typeof`, `toString()`) ; `architecture.test.mjs`, « une façade qui contient autre chose que des réexports est signalée [REF-29 CA-4] » |
| CA-3 : `check-moves.mjs` vert contre la base `f3ec902` | livré | `check-moves.mjs --self-test` : 350 tests, fichiers de tests conformes aux différences tolérées, 8 mutations et modules fabriqués détectés |
| CA-4 : test d'architecture, chaque règle éprouvée sur un exemple fabriqué | livré | `architecture.test.mjs`, 8 tests `[REF-29 CA-4]` |
| CA-5 : aucun test n'importe `lib/core.mjs`, imports nommés | livré | `architecture.test.mjs`, 2 tests `[REF-29 CA-5]` (première moitié) ; imports nommés vérifiés par lecture et par `check-moves.mjs` |
| CA-6 : `CLAUDE.md` décrit le rangement et les deux règles de la façade | livré | `CLAUDE.md:8` et `:19-21`, relus en revue de la tranche 6 et du chantier |
| CA-7 : médiane de `hook-guard` au plus 20 ms au-dessus de la base | livré | `measure-hook.mjs` : de +2,7 à +8,9 ms selon les séances, +6,0 ms à la revue du chantier (32,5 ms contre 38,5 ms), même décision |

Écart par rapport à la spec initiale, tracé en amendement : le 2026-11-24, une troisième exception aux noms de tests figés renomme un test de `spec-ellipsis.test.mjs`, qui citait CA-17 et CA-18 hors de son étiquette. C'est le point D2 laissé par REF-16. Vérification manuelle du §4 : `status` et `hook-session-start` donnent la même sortie, octet pour octet, que le plugin de la base.

## 3. Choix techniques
- La preuve se fait déclaration par déclaration, pas par relecture. `check-moves.mjs` extrait chaque déclaration de niveau 0 de la base et la retrouve une seule fois, identique, dans le module que donne la table. Il vérifie que les imports sont complets avec son propre analyseur, indépendant de `move.mjs`, et que la façade exporte les mêmes noms et les mêmes fonctions.
- Les déplacements se font par script versionné (`move.mjs`), qui régénère tous les en-têtes d'import. Un commit par domaine, en partant des feuilles du graphe d'import.
- `core.mjs` est gardé en façade plutôt que supprimé. Depuis RD14, cette protection ne sert plus aucune branche (voir §6).
- Les placements ambigus sont tranchés dans `decisions.md`, pas par une réécriture, par exemple `specStatus` dans `common` et `codeFilesSince` dans `cli/slices` pour éviter un cycle.
- Le test d'architecture lit les instructions `import`, pas les corps. Ses règles sont des fonctions pures de textes, éprouvées sur des exemples fabriqués. Les chemins sont normalisés en posix pour Windows.
- La latence est mesurée dans la même séance contre la base extraite par `git archive`, sur le même chemin du hook. Le chargement paresseux prévu en parade n'a pas été nécessaire.

## 4. Éléments de code principaux
- `CLAUDE.md` (Structure et Conventions) : où va une nouvelle logique. À lire en premier.
- `plugins/atelier/lib/cli.mjs` : table des commandes et `main`, le point d'entrée de `bin/atelier`.
- `plugins/atelier/lib/common.mjs` et `lib/cli/common.mjs` : le socle partagé. `common.mjs` contient la configuration, le front matter, les chemins et motifs, et l'analyse de sortie git. `cli/common.mjs` contient `git`, `pluginRoot`, `requireConfig` et la lecture de stdin.
- `plugins/atelier/lib/<domaine>.mjs` et `lib/cli/<domaine>.mjs` : `identifiers`, `relations`, `spec`, `docs`, `slices`, `tdd`, `review-points`, `review`, `close`, `checks`, `next-step`, `write-guard`, `stop-hook`.
- `plan.md`, table « déclaration → module » et graphe d'import : où est passée chaque fonction de l'ancien `core.mjs` et de l'ancien `cli.mjs`. C'est la table que suivront les branches à rebaser.
- `plugins/atelier/test/architecture.test.mjs` : les règles de structure de `lib/` et de `test/`.
- `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs`, `move.mjs`, `measure-hook.mjs` : la preuve et l'outillage. Ils ne valent qu'au commit de clôture, car la base et le nombre de tests y sont écrits en dur.

## 5. Pistes écartées
- Supprimer `core.mjs` dans REF-29 : les tests figés des branches ouvertes casseraient. Depuis RD14, ils doivent de toute façon être rouverts ; la suppression devient un chantier à part (§6).
- Assouplir la règle RD14 pour laisser les tests importer la façade : la façade survivrait indéfiniment pour éviter une réouverture de tests qui ne coûte qu'une ligne d'import (RD18).
- Assouplir la règle des critères dans les noms de tests (critère seulement en tête de nom) : elle laisserait passer des critères en milieu de nom. Le test fautif a été renommé par amendement.
- Corriger les commentaires qui renvoient à `lib/core.mjs` (RD8) : la spec interdit de retoucher le texte d'une déclaration déplacée.
- Laisser `cli/slices` importer `core.mjs` durablement : l'import, transitoire en tranche 3, a été retiré en tranche 4.
- Réécrire l'historique pour donner un scope aux 4 commits de RD15 : la branche était déjà poussée.

## 6. Dette et suites
- **Supprimer la façade `core.mjs`** (RD18), par un petit chantier, dès les rebases de FIX-20 et FEAT-27. Depuis RD14, aucun test ni module de `lib/` ne peut l'importer : elle n'a plus d'usager. La procédure de rebase est dans `decisions.md` :
  - FIX-20 rouvre ses tests (`describe('FIX-20 …')`, `import * as core`) et rejoue `planSliceCount` dans `lib/slices.mjs` ;
  - FEAT-27 rouvre ses tests pour l'import de `parseFrontMatter`, qui doit venir de `lib/common.mjs` ;
  - FEAT-21 n'a que sa spec.
- **Renvois à `lib/core.mjs` dans des commentaires** (RD8), à corriger par le chantier qui supprimera la façade : `lib/cli/close.mjs:16`, `lib/cli/stop-hook.mjs:15`, `lib/cli/review.mjs:29`, `lib/cli/slices.mjs:17` (`grep -rn "lib/core.mjs" plugins/atelier/lib`).
- **Idée de FIX** : les tests qui créent des dépôts jetables héritent de `GIT_DIR`, `GIT_WORK_TREE` ou `GIT_INDEX_FILE` s'ils sont définis. Lancés ainsi, ils ont déplacé les références de ce dépôt pendant la revue de la tranche 4 (incident réparé, rien poussé). `check-moves.mjs` filtre désormais ces variables ; les helpers de test devraient faire de même.
- Restes de REF-16 traités ici : D2 par l'amendement. D1 (`spec-ellipsis.test.mjs` duplique des helpers) et D6 (commentaire d'en-tête `// FIX-22:`) restent ouverts : les noms et corps de tests étaient figés par la spec.
- `write-guard.test.mjs` (322 lignes) et `identifiers.test.mjs` (314) approchent du seuil de 400 lignes, que le test d'architecture fait maintenant respecter.
- `check-moves.mjs` échouera dès qu'une déclaration ou un test sera ajouté après REF-29. C'est attendu.
- Suites d'EPIC-17 : lot 3 (FIX des règles des skills et du reviewer) et lot 4 (gel des tests tolérant les déplacements). Branches en pause qui reprennent après la fusion : FIX-20, FEAT-27, puis FEAT-21.

## 7. Verdict de revue
9 revues, toutes consignées dans `revue.md` : 2 revues pour chacune des tranches 1 et 6, 1 pour chacune des tranches 2 à 5, 1 pour le chantier. Aucun point bloquant. 19 points à discuter :

| Point | Traitement |
|---|---|
| RD1. Titres de section hérités dans `common.mjs` et `cli/common.mjs` | corrigé (07a90a8) |
| RD2. `check-moves.mjs` ne contrôlait pas que les imports sont complets | corrigé (260e69b, puis f14508d à la reprise) |
| RD3. La remesure de la base ne mesurait pas le même chemin du hook | corrigé (260e69b) |
| RD4. Lecture des `import` / `export` non bornée, réexports tolérés hors façade | corrigé (260e69b) |
| RD5. `blankLiterals` pouvait boucler sans fin | corrigé (f14508d) |
| RD6. `measure-hook.mjs` laissait son dossier temporaire | corrigé (f14508d) |
| RD7. Titres de section vides empilés dans `core.mjs` | corrigé (d9f84dc) |
| RD8. Commentaires déplacés qui renvoient à `lib/core.mjs` | reporté (« Dette et suites ») |
| RD9. Graphe d'import du plan incomplet (tranche 3) | corrigé (1ea3fce) |
| RD10. Graphe d'import du plan : `close` importe aussi `common` | corrigé (2707371) |
| RD11. Test d'architecture cassé sous Windows | corrigé (348889b) |
| RD12. Un import sans `from` échappait aux règles d'import | corrigé (348889b) |
| RD13. `architecture.test.mjs` exempté de la règle des 400 lignes | corrigé (348889b) |
| RD14. Rien n'empêchait de réimporter `core.mjs` | corrigé (348889b) |
| RD15. Messages de commit sans scope | exception acceptée |
| RD16. En-tête du test d'architecture périmé | corrigé (ece4537) |
| RD17. CA-5 cité par aucun test | corrigé (ece4537) |
| RD18. La façade n'a plus d'usager possible | reporté (« Dette et suites ») |
| RD19. Comptes de modules périmés dans le plan | corrigé (73b2329) |

Une exception acceptée (RD15). Revue du chantier enregistrée au commit `73b2329`.

- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-24
