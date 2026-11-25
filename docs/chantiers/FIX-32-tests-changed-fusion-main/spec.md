---
id: FIX-32
type: FIX
title: Les tests venus de main comptent comme tests modifiés depuis le gel
status: signed
tdd: yes
created_at: 2026-11-25
source: FIX-20, revue de la tranche 2 après fusion de main (14753db)
rel_origin: FIX-20
signed_by: Opack
signed_at: 2026-11-25
---

# FIX-32 Les tests venus de main comptent comme tests modifiés depuis le gel

## 1. Problème
<!-- Observé, attendu, impact (qui, combien, gravité), source (lien Sentry / issue, release, plateforme). -->
- Observé : en implémentation (tests figés), dès que `main`, fusionnée dans la branche, a modifié un fichier de test, `atelier tests-changed` le signale comme « test modifié depuis le commit <tests_commit> » et sort en 2. Le hook Stop bloque la session et `atelier set-reviewed` refuse la revue pour la même raison. Cas réel : `fix/FIX-20-tranche-tdd-sans-ca` après la fusion de `main` (14753db) : `plugins/atelier/test/tdd.test.mjs` est signalé alors que les tests figés du chantier sont intacts.
- Attendu : seuls comptent les fichiers de test modifiés par le chantier lui-même depuis le gel (ses commits et la résolution de ses fusions) et les fichiers de test non commités, comme `freeze-tests` depuis FIX-31 et le code du chantier depuis FIX-28.
- Impact : bloquant pour tout chantier en TDD qui fusionne `main` pendant l'implémentation, si `main` a touché un test. Ni revue ni fin de session possibles sans contournement. FIX-20 est bloqué.
- Source : FIX-20 (revue de la tranche 2, après fusion de `main` le 2026-11-25).

## 2. Reproduction
<!-- Étapes, environnement, données, compte. Reproduit en local : oui / non (si non : comment prouvera-t-on la correction ?).
Question si manquant : arrive-t-on à reproduire ? Sinon, quel signal prouvera que c'est corrigé ? -->
Reproduit sur la branche de FIX-20, et reproductible sur dépôt jetable (helpers de `test/helpers.mjs`) :
1. Chantier en TDD, tests commités et figés (`tests_commit` posé).
2. Sur `main`, un commit modifie un fichier de test ; `main` est fusionnée dans la branche sans conflit.
3. `atelier tests-changed` → sortie 2, cite le fichier de test de `main`. `atelier set-reviewed` → refus pour le même fichier.

## 3. Cause probable
<!-- Hypothèse AVEC sa preuve (ligne de code, trace, breadcrumb). Confiance : forte / moyenne / faible.
Question si manquant : qu'est-ce qui prouve la cause, au-delà de l'intuition ? -->
Confiance forte. `testFilesChangedSince` (`plugins/atelier/lib/cli/tdd.mjs:37`) lance `git diff --name-only <tests_commit> --` : il compare deux états du dépôt, donc tout ce que `main` a apporté par fusion depuis le gel y figure. Ses trois appelants en héritent : `commandTestsChanged` (même fichier), le hook Stop (`lib/cli/stop-hook.mjs:42`) et `set-reviewed` (`lib/cli/review.mjs:92`). FIX-28 (`codeFilesSince`, `lib/cli/slices.mjs`) et FIX-31 (`testFilesWithRemovedLines`) ont corrigé ce schéma ailleurs, pas ici.

## 4. Solution proposée
<!-- Correction de la cause, pas du symptôme (sinon le dire et pourquoi). Fichiers touchés.
Questions si manquant : corrige-t-on la cause ou le symptôme ? Des données déjà corrompues sont-elles à réparer ? -->
- Dans `testFilesChangedSince` : partir des fichiers modifiés par le chantier depuis `tests_commit` (`codeFilesSince(projectRoot, commit, 'first-parent')`, la logique de FIX-28 avec son repli sur git ancien), garder ceux qui sont dans `testPaths`, puis ne garder que ceux qui diffèrent réellement de leur état au gel (`git diff --name-only <tests_commit> -- <candidats>`, pathspecs littéraux). Le second filtre conserve le comportement actuel pour un test modifié puis rétabli à l'identique. Aucun candidat : aucun diff lancé. Les fichiers de test non commités restent signalés comme aujourd'hui.
- Si `tests_commit` n'est plus un ancêtre de HEAD (rebase après le gel), garder le calcul actuel (diff complet) : l'historique du chantier depuis le gel n'est plus lisible (SD3).
- Les trois appelants bénéficient de la correction sans changement.
- Message du hook Stop (`decideStop`, `lib/stop-hook.mjs`) : il conseille aujourd'hui `git checkout <tests_commit> -- <fichier>`, ce qui, pour un test dont la modification vient de la résolution d'un conflit avec `main`, effacerait les apports de `main`. Ajouter que si la modification vient d'une fusion de la branche par défaut, il ne faut rien restaurer : rouvrir les tests (`/atelier:write-tests <raison>`) puis les figer à nouveau (SD1).
- Fichiers touchés : `plugins/atelier/lib/cli/tdd.mjs`, `plugins/atelier/lib/stop-hook.mjs`, `plugins/atelier/test/tdd.test.mjs`, le fichier de test du hook Stop. Site : préciser dans `site/reference/commandes.md` que `tests-changed` ne liste que les tests modifiés par le chantier.

## 5. Critère de non-régression
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors … (le test échoue avant la correction). -->
- [ ] CA-1 : Étant donné un chantier aux tests figés et un fichier de test modifié par `main` après le gel puis apporté par une fusion sans conflit, quand `atelier tests-changed` est lancé, alors il sort en 0 sans citer ce fichier.
- [ ] CA-2 : Étant donné le même chantier où un commit du chantier modifie aussi un test figé, quand `atelier tests-changed` est lancé, alors il sort en 2 et cite ce test, et lui seul.
- [ ] CA-3 : Étant donné la situation de CA-1 et une implémentation commitée, quand `atelier set-reviewed` est lancé, alors la revue n'est pas refusée à cause du fichier venu de `main`.
- [ ] CA-4 : Étant donné un chantier aux tests figés et un fichier de test modifié sans être commité, quand `atelier tests-changed` est lancé, alors il sort en 2 et cite ce fichier (comportement inchangé).
- [ ] CA-5 : Étant donné un test figé modifié par un commit du chantier puis rétabli à l'identique par un commit suivant, quand `atelier tests-changed` est lancé, alors il sort en 0 (comportement inchangé).
- [ ] CA-6 : Étant donné un test figé que le chantier et `main` modifient tous deux, et une fusion de `main` dont le conflit sur ce fichier est résolu et commité, quand `atelier tests-changed` est lancé, alors il sort en 2 et cite ce fichier (la résolution est une modification du chantier).
- [ ] CA-7 : Étant donné des tests figés modifiés, quand le hook Stop bloque, alors son message indique, pour une modification venue d'une fusion de la branche par défaut, de rouvrir les tests (`/atelier:write-tests`) au lieu de les restaurer.

## 6. Notes complémentaires
<!-- Hors périmètre, contournement temporaire, communication utilisateur, autres endroits où ce schéma existe. Optionnel. -->
- Le hook Stop n'a pas de test dédié : il appelle la même fonction que `tests-changed` et `set-reviewed`, couverts par CA-1 à CA-3.
- Limite assumée (comme FIX-31) : un fichier de test touché par le chantier depuis le gel (commit, ou résolution d'un conflit de fusion) est comparé en entier à son état au gel ; une modification de `main` sur ce fichier le fait signaler, y compris si le chantier l'avait rétabli à l'identique (SD2). Dans ce repo les fichiers `<domaine>.test.mjs` sont partagés : un conflit de fusion sur un test figé arrivera. Recours : rouvrir les tests et les figer à nouveau, que le message du hook indique désormais (CA-7).
- Hors périmètre : pendant une fusion en cours, les fichiers de test de `main` sont des modifications non commitées et restent signalés. Ceux fusionnés sans conflit disparaissent au commit de la fusion ; ceux en conflit relèvent de la limite ci-dessus.
- Contournement temporaire : aucun propre ; FIX-20 attend ce correctif.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
