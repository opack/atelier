# Bilan : REF-36 Supprimer la façade lib/core.mjs

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
La façade `lib/core.mjs` (83 lignes de réexports gardées par REF-29 pour les branches ouvertes avant lui) est supprimée, avec ses règles dans `test/architecture.test.mjs` et dans `CLAUDE.md`. Les trois commentaires de `lib/cli/` qui y renvoyaient citent désormais le module qui déclare la fonction. Comportement du plugin inchangé, pas de montée de version, site non touché.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 : `core.mjs` absent, `grep -rn "core.mjs" plugins/atelier/lib plugins/atelier/test CLAUDE.md` vide | Livré | vérifié en revues 1 et 2 |
| CA-2 : `npm test` vert, noms des tests = avant moins les seuls tests de la façade | Livré | 498 → 495 ; noms comparés sur deux worktrees (base 971c3a6, HEAD) : seuls « aucun test ni module de lib/ n’importe la façade [REF-29 CA-5] », « un test ou un module de lib/ qui importe la façade est signalé [REF-29 CA-5] » et « une façade qui contient autre chose que des réexports est signalée [REF-29 CA-4] » disparaissent |
| CA-3 : commentaires de `lib/cli/close.mjs`, `stop-hook.mjs`, `review.mjs` vers `lib/close.mjs`, `lib/stop-hook.mjs`, `lib/review.mjs` | Livré | vérifié en revue 1 (déclarations aux lignes 75, 16, 22) |

Écart : la puce de `CLAUDE.md` « Les tests importent par noms les modules de domaine » est retirée en entier, pas seulement sa fin « jamais `lib/core.mjs` » (RD1, choix de Didier) : sans cette fin, elle ne disait plus rien et aucun test ne la vérifiait.

## 3. Choix techniques
- Aucune règle d'architecture de remplacement : un import du fichier disparu échoue déjà au chargement des tests (`decisions.md`).
- `importProblems` perd son exception `core.mjs` : un futur `core.mjs` serait un module pur ordinaire.
- Pas de montée de version : rien de visible pour les usagers.

## 4. Éléments de code principaux
- `plugins/atelier/test/architecture.test.mjs` : les règles qui restent (taille, noms de tests, imports de `lib/`).
- `CLAUDE.md`, sections Structure et Conventions.

## 5. Pistes écartées
- Garder la puce « Les tests importent par noms les modules de domaine » (RD1) : rien ne la vérifiait.
- Une règle « pas de fichier `lib/core.mjs` » : sans objet, voir §3.

## 6. Dette et suites
Aucune. Le processus a dévié sur un point, sans conséquence sur le code : la spec a été signée sans relecture `spec-critic` ; la revue 1 a donc vérifié aussi le périmètre de la spec (aucune autre mention de `core.mjs` hors des documents des chantiers clos).

## 7. Verdict de revue
Revue 1 (bd8032c, base 971c3a6) : aucun bloquant, RD1. Revue 2 (30d7124, relance après 544caf7) : aucun point. Revue enregistrée au commit bbd7e13.

| Point | Traitement |
|---|---|
| RD1. Règle « Les tests importent par noms les modules de domaine » vidée de son sens | corrigé (544caf7) : puce retirée, choix de Didier |

- Verdict :
- Validé par :
- Date :
