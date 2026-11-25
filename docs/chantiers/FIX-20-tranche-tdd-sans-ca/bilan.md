# Bilan : FIX-20 TDD décidé tranche par tranche

## 1. Résumé
Le TDD ne se décide plus seulement pour tout le chantier : le `tdd` de la spec vaut par défaut, et chaque tranche du plan le redéfinit (`— TDD : oui|non`). Une tranche de documentation, de site ou de version avance sans test de complaisance, et une tranche de logique pure peut suivre le TDD dans un chantier qui ne l'impose pas. Les tests déjà figés restent figés, et l'agent ne peut pas sortir des « tests d'abord » en éditant le plan. Nouvelle commande `atelier check-plan`, plugin en 0.7.0. État final : 6 tranches et la revue du chantier validées, 454 tests verts.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 : lecture des tranches du plan (numéro, CA, TDD ; commentaires, sous-listes, CRLF) | livré | `plan.test.mjs` : « lit le numéro, les CA et le TDD de chaque tranche » (+ 3) |
| CA-2 : tranche « TDD : non » d'un chantier TDD → phase `none`, écriture libre | livré | `tdd-slice.test.mjs` : « une tranche « TDD : non » d'un chantier TDD n'a pas de phase « tests d'abord » » |
| CA-3 : tranche « TDD : oui » d'un chantier sans TDD → `writing-tests` ; SPIKE sans TDD hors cycle | livré | `tdd-slice.test.mjs` : « une tranche « TDD : oui » d'un chantier sans TDD commence par les tests » |
| CA-4 : sans `slice_tdd`, comportement d'avant (non-régression) | livré | `tdd-slice.test.mjs` : « sans slice_tdd, la phase suit le tdd du chantier… » (+ 3) |
| CA-5 : tests figés prioritaires sur le plan | livré | `tdd-slice.test.mjs` : « des tests figés restent figés, quoi que dise le TDD de la tranche » |
| CA-6 : `set-reviewed` écrit le TDD de la tranche suivante et renvoie vers la bonne étape | livré | `tdd-slice.test.mjs` : « la revue de la tranche 1 écrit le TDD de la tranche 2… » (+ 2, dont la tranche 1 « TDD : non » avant tout `slice` écrit, note §6 de la spec) |
| CA-7 : revue du chantier après une dernière tranche « TDD : non » | livré | `tdd-slice.test.mjs` : « après une dernière tranche « TDD : non », la revue du chantier ne réclame pas de test » |
| CA-8 : `slice_tdd` réservé aux commandes | livré | `write-guard.test.mjs` : « le hook refuse que l'agent change ou retire slice_tdd d'une spec signée » |
| CA-9 : `set-tdd` change la tranche courante, refus si tests figés ou réouverture en attente | livré | `tdd-slice.test.mjs` : « set-tdd no en tranche 2 écrit slice_tdd… » (+ 1) |
| CA-10 : `freeze-tests` / `reopen-tests` refusés en tranche sans TDD | livré | `tdd-slice.test.mjs` : « en tranche sans TDD, freeze-tests et reopen-tests sont refusés… » (+ 1) |
| CA-11 : problèmes du plan (`planProblems`) | livré | `plan.test.mjs` : « signale une tranche sans TDD déclaré… » (+ 6) |
| CA-12 : valeurs écrites par `check-plan` et commande | livré | `plan.test.mjs` : « écrit slice_tdd d'après la tranche 1… », « atelier check-plan : 0 et slice_tdd écrit… » (+ 5) |
| CA-13 : tests comptés comme code dans une tranche sans TDD | livré | `tdd-slice-status.test.mjs` : 4 tests (`set-reviewed` et `codeCommitted`, dans les deux sens) |
| CA-14 : `sliceTdd` dans `status --json`, « TDD : oui/non » dans le texte | livré | `tdd-slice-status.test.mjs` : 4 tests (tranche numérotée, tranche unique, absence) |
| CA-15 : `reopen-tests` en revue d'ensemble si une tranche a figé des tests | livré | `tdd-slice.test.mjs` : 3 tests |

Écarts par rapport à la spec :
- La spec cite `lib/core.mjs` et `lib/cli.mjs` : REF-29 a rangé `lib/` par domaine entre-temps. La logique est dans `lib/slices.mjs`, `lib/tdd.mjs`, `lib/review.mjs`, `lib/next-step.mjs`, les entrées / sorties dans `lib/cli/` (decisions.md, 2026-11-24).
- `check-plan` est plus strict que la spec : il n'écrit rien après une réouverture ou un regel (OB3), pour un EPIC ou un SPIKE sans TDD (RD9), ni d'après un autre fichier que le `plan.md` du chantier (RD8).

**Cause réelle** : confirmée. Le TDD était une décision du chantier (`tdd`) alors que le cycle tests → build → revue tourne par tranche. `testDrivenPhase`, `setReviewedUpdate`, la prochaine étape et le décompte du code de la tranche (`sliceCodeFiles`, `codeCommittedFact`) lisaient tous `tdd` du chantier. Tous lisent désormais le TDD effectif (`effectiveTdd` : `slice_tdd`, sinon `tdd`), défini à un seul endroit.

**Même schéma ailleurs** : le décompte du code de la tranche lisait aussi `tdd` du chantier : corrigé ici (CA-13). Les messages du modèle `single` (`reopenTestsRefusal`, prochaine étape) parlent encore du chantier : voir RD15 en suites.

## 3. Choix techniques
- `slice_tdd` dans l'en-tête de la spec, écrit seulement par les commandes (`check-plan`, `set-reviewed`, `set-tdd`) : le plan est un chemin libre, la spec signée non.
- Une seule règle de résolution, `effectiveTdd` (`lib/tdd.mjs`), appelée par la phase, la revue, la prochaine étape, `status` et le décompte du code.
- `tests_commit` renseigné l'emporte sur le plan : des tests figés ne se libèrent que par une réouverture tracée.
- `check-plan` n'écrit `slice_tdd` qu'une fois, avant tout gel et toute revue de la tranche 1 ; ensuite le plan ne le change plus (OD10 : fenêtre restante acceptée par Didier).

## 4. Éléments de code principaux
- `plugins/atelier/lib/tdd.mjs` : `effectiveTdd`, `declaredSliceTdd`, `testDrivenPhase`, `setTddRefusal` / `setTddUpdate`, `reopenTestsRefusal`, refus de `freeze-tests`.
- `plugins/atelier/lib/slices.mjs` : `planSlices`, `planProblems`, `checkPlanValues`, `sliceState`, `hasReopeningEntry`.
- `plugins/atelier/lib/review.mjs` : `setReviewedUpdate` (TDD de la tranche suivante).
- `plugins/atelier/lib/cli/slices.mjs` : commande `check-plan`, `sliceCodeFiles`, `slicePosition` (`sliceTdd`).
- `plugins/atelier/lib/cli/next-step.mjs` : `status` (texte et JSON), `codeCommittedFact`.
- Skills `plan`, `new`, `write-tests`, `build`, `review` ; `templates/plan.md` ; site (conception, tests, implémentation, revue, signature, commandes, configuration, glossaire) ; README.

## 5. Pistes écartées
- `/atelier:plan` qui refuse une tranche TDD sans CA : déplace le problème et pousse à inventer des critères.
- Gel « vide » : un faux événement.
- Tranche « sans CA » qui hérite du gel (première version de la spec) : déduit le TDD de l'absence de CA, trop implicite.
- Lire le TDD dans `plan.md` à chaque décision : un agent bloqué en tests d'abord en sortirait en éditant le plan.
- `set-tdd no` qui viderait `tests_commit` (OB2) : permettrait de quitter le TDD en abandonnant des tests figés.

## 6. Dette et suites
- **Garde technique des tests figés en tranche « TDD : non »** (RD14) : pendant une telle tranche et pendant la revue du chantier qui la suit, aucun gel ne protège les tests des tranches précédentes, seule la revue. Piste : contrôler leurs lignes au `set-reviewed` d'une tranche sans TDD. Chantier à ouvrir.
- **Messages du modèle `single`** (RD15) : un chantier `tdd: yes` dont l'unique tranche est « TDD : non » reçoit « ne suit pas le TDD (tdd: yes) » de `reopen-tests` et « sans TDD pour ce chantier » en prochaine étape. Messages seulement, aucune garde.
- **`review-ids` et `close-check` divergent** sur un point dont la dernière occurrence est « reporté (tranche N) » : `review-ids` le dit fermé, `close-check` le refuse. Constaté à la clôture de ce chantier.
- Spec de FEAT-4 : commentaire HTML jamais refermé qui avale CA-6 à CA-8 (idée restante de FIX-22 : le signaler dans `check-spec`).
- TEC-15 peut, une fois FIX-20 fusionné, déclarer sa tranche documentaire « TDD : non » (`atelier set-tdd no <raison>`) au lieu de son CA-19.

## 7. Verdict de revue
Revues : tranches 1 à 6 (une par tranche, relance après corrections pour la tranche 6) et revue du chantier (relancée deux fois après corrections), consignées dans `revue.md`. Aucun bloquant (RB) sur l'ensemble du chantier. Points de surapprentissage (OB / OD) traités dans `decisions.md`.

| Point | Traitement |
|---|---|
| RD1 | corrigé (d0cd3c3) : test de tolérance de lecture du plan |
| RD2 | corrigé (4dc1b71) |
| RD3 | corrigé (f881bdf) : test du chantier repassé en `tdd: no` |
| RD4 | corrigé (b989ddb) : valeur inconnue de `slice_tdd` → `tdd` du chantier |
| RD5 | corrigé (895512d) |
| RD6 | corrigé (2235812) : condition `slice === 'chantier'`, test d0cd3c3 |
| RD7 | corrigé (6d2d1b2) : règle de résolution unique |
| RD8 | corrigé (b15ce46) : `check-plan` n'écrit que pour le `plan.md` du chantier |
| RD9 | corrigé (b15ce46) : utilitaire partagé, refus EPIC dans la logique pure |
| RD10 | corrigé (e0e6019) |
| RD11 | corrigé (e0e6019) |
| RD12 | écarté : la correction modifierait une ligne d'un test figé, pour un import en double sans effet ; accord de Didier |
| RD13 | corrigé (bf50d62) : README et site présentent le TDD par chantier, redéfini par tranche |
| RD14 | corrigé (bf50d62, 82f1135) côté doc et skill ; garde technique en suites |
| RD15 | écarté, en suites : cas rare, messages seulement ; accord de Didier |
| RD16 | test ajouté (bf50d62) |
| OD10 | exception acceptée par Didier le 2026-11-25 : avant le premier gel de la tranche 1, éditer le plan puis lancer `check-plan` change le TDD de la tranche 1 ; fenêtre étroite, édition visible au diff et à la revue |
| OD15 | écarté : casse des chemins dans `check-plan`, défaut prudent ; accord de Didier |

- Verdict :
- Validé par :
- Date :
