# Bilan : FEAT-7 Cycle tests, build, revue par tranche

## 1. Résumé
Atelier mène désormais un chantier tranche par tranche, selon le découpage du plan : tests d'abord, build, puis revue de chaque tranche ; une revue du chantier entier clôt le cycle. Les chantiers lancés avant cette version se terminent comme avant. Les 27 critères sont livrés et testés (180 tests verts), la revue est validée en deux tours ; plugin en version 0.3.0.

## 2. Livré vs spécifié
Tous les tests sont dans `plugins/atelier/test/core.test.mjs` ; chaque nom de test cite son critère.

| Critère | Statut | Test |
|---|---|---|
| CA-1, CA-2 : nombre de tranches lu dans le plan | Livré | `CA-1`, `CA-2` |
| CA-3, CA-4 : tranche en cours ; chantiers de l'ancien modèle traités comme une tranche unique | Livré | `CA-3`, `CA-4` |
| CA-5 : `slice`, `slice_base`, `last_slice` protégés contre l'agent | Livré | `CA-5` |
| CA-6 à CA-11 : gel et réouverture des tests par tranche ; refus si `slice_base` n'est plus un ancêtre | Livré | `CA-6` à `CA-11` |
| CA-12, CA-13, CA-17 : hooks d'écriture dans les nouveaux états | Livré | `CA-12`, `CA-13`, `CA-17` |
| CA-14 à CA-16, CA-18, CA-19 : `set-reviewed` passe à la tranche suivante, à la revue du chantier, ou enregistre la revue | Livré | `CA-14` à `CA-16`, `CA-18`, `CA-19` |
| CA-20 : refus « tranche vide » (en TDD, fichiers de test exclus) | Livré, amendé | `CA-20` (2 tests) |
| CA-21 à CA-23 : contrôles de clôture | Livré | `CA-21` à `CA-23` |
| CA-24, CA-26 : prochaine étape et rappel de session préfixés « Tranche N/M » | Livré | `CA-24`, `CA-26` |
| CA-25 : `SPIKE` en TDD dans le cycle ; sans TDD ou lancé avant les tranches, dispensé de revue | Livré, amendé | `CA-25` (3 tests) |
| CA-27 : plus de « tour » de revue dans les skills, l'agent, les templates, le site et le README | Livré | `CA-27` |

Écarts : amendement du 2026-11-21, à l'issue du premier tour de revue. CA-20 était inopérant en TDD : le commit des tests comptait comme du code. CA-25 contredisait la section « Compatibilité » pour un `SPIKE` en TDD lancé avant les tranches.

## 3. Choix techniques
- Une seule fonction, `sliceState`, interprète `slice`, `last_slice` et le plan, et classe le chantier : `sliced`, `single`, `legacy` ou `none`. La compatibilité tient à cette classification, jamais à la version du plugin.
- On passe à la tranche suivante en validant la revue de tranche (`set-reviewed`) : il n'y a pas de commande dédiée.
- Les tests des tranches précédentes sont contrôlés ligne à ligne par `git diff` au gel, avec préfixes et options imposés pour ne pas dépendre de la configuration git. S'y ajoutent les listes de fichiers supprimés et binaires.
- Si `slice_base` n'est plus un ancêtre de `HEAD` (rebase), la commande refuse sans recalculer : l'utilisateur corrige ce champ à la main.
- Le chantier lui-même a été mené avec atelier 0.2.0, donc selon l'ancien modèle (`decisions.md`).

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs` :
  - `sliceState` et `planSliceCount` : état des tranches, à lire en premier ;
  - `freezeTestsRefusal` et `removedTestLines` : gel par tranche ;
  - `reopenTestsRefusal` : réouverture des tests ;
  - `setReviewedRefusal` et `setReviewedUpdate` : validation de la revue et passage de tranche ;
  - `closeProblems` et `isReviewExempt` : clôture ;
  - `nextStep` : prochaine étape affichée.
- `plugins/atelier/lib/cli.mjs` :
  - `testFilesWithRemovedLines` : collecte git pour le gel ;
  - `sliceCodeFiles` : code commité dans la tranche ;
  - commandes `status`, `freeze-tests`, `reopen-tests`, `set-reviewed`, `close-check`.
- Skills `write-tests`, `build`, `review`, `close`, l'agent `reviewer`, les templates et le site, qui décrivent le cycle par tranche.

## 5. Pistes écartées
- Passer le texte du plan à chaque fonction : toutes les signatures auraient changé, sans bénéfice. `readChantier` lit le plan une fois.
- Une commande « tranche suivante » : redondante avec la validation de la revue.
- Un passage de cohérence dans la dernière revue de tranche, au lieu d'une revue du chantier séparée.
- `git diff --text` pour le gel : il ne règle ni les fichiers vides ni les chemins entre guillemets.
- Concaténer les problèmes de tranche et de revue à la clôture (point D5 du tour 1) : écarté, rien n'est faux.

## 6. Dette et suites
- Aucun test ne couvre le message « tests déjà rouverts » en `slice: chantier`. Exception acceptée en revue.
- Aucun test ne vérifie qu'un chantier sans base de comparaison n'est pas soumis au contrôle « tranche vide ». Le test qui le faisait ne prouvait rien et a été retiré.
- Le cycle par tranche n'a pas encore été vécu en vrai : le prochain chantier, mené avec 0.3.0, le rodera.

## 7. Verdict de revue
Repris de `revue.md` :
- **Tour 1** (commit 23a09b1) : aucun bloquant.
  - D1, D2 : spec amendée, tests ajoutés, code corrigé.
  - D3, D4 : corrigés.
  - D5 : écarté.
- **Tour 2** (commit 473acf5) : aucun bloquant.
  - D1 : exception acceptée par l'utilisateur (pas de test pour le message de réouverture).
  - D2 : `revue.md` complété.

- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-21
