# Décisions : REF-34 Regrouper le vocabulaire des documents lu par le code

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-25 : la typographie des deux-points reste unique, sans clé de vocabulaire
- Contexte : relecture de spec, SD2 (« Libellé : » et « - AAAA-MM-JJ : » dépendent du français).
- Écarté : une clé `colon` (` :` / `:`), parce que construire une chaîne en concaténant des clés est une usine à gaz pour un gain nul (choix de Didier) ; uniformiser sans espace, parce que cela changerait le comportement, interdit à un REF.
- Conséquence : convention française pour toutes les langues ; date AAAA-MM-JJ fixe (elle se trie).

## 2026-11-25 : un mot employé dans une phrase n'est pas du vocabulaire
- Contexte : relecture de spec, SD4 (« reporté à une tranche » dans un message).
- Écarté : interpoler les mots d'une phrase, parce que c'est traduire mot à mot (accord, ordre des mots).
- Conséquence : seules les citations entre « » sont tirées du vocabulaire ; les phrases se traduiront entières dans le catalogue de messages d'EPIC-14. Le test de CA-2 ne vise que les positions de grammaire.

## 2026-11-25 : la preuve de traduisibilité (pseudo-langue) va dans EPIC-14
- Contexte : à la conception, Didier note que REF-34 ne prouve rien sur la traduction.
- Écarté : la faire ici, parce qu'il faudrait rendre le vocabulaire injectable, ce qui revient à concevoir EPIC-14 en avance.
- Conséquence : REF-34 ne prouve que la non-régression en français ; le fil d'EPIC-14 est prévenu (critère pseudo-langue pour son premier chantier multilingue).

## 2026-11-25 : nouveaux tests dans des fichiers neufs, aucun fichier de test existant modifié
- Contexte : CA-1 exige des tests identiques hormis ceux ajoutés.
- Écarté : ajouter le test de CA-2 dans `architecture.test.mjs` et partager son `readLiteral`, parce que déplacer du code de test compliquerait la preuve, et que le lecteur de code de CA-2 doit de toute façon gérer expressions régulières et commentaires.
- Conséquence : `test/architecture-vocabulary.test.mjs` et `test/vocabulary.test.mjs` ; `check-tests.mjs` vérifie qu'aucune ligne des fichiers de test existants n'est retirée.

## 2026-11-26 : REF-34 démarre avant les lots 3 et 4 d'EPIC-17
- Contexte : FIX-20, FEAT-27 et FEAT-21, qui touchaient les mêmes modules, sont fusionnés ; les lots 3 et 4 ne sont pas ouverts.
- Écarté : attendre les lots 3 et 4, parce que rien ne bloque et que le lot 3 n'aura qu'à ajouter les sections de critères TEC et REF au vocabulaire.
- Conséquence : accord de Didier le 2026-11-26, consigné dans le decisions.md d'EPIC-17 (PR #30). Base de non-régression : fusion de main 5ef9b80, 498 tests.

## 2026-11-26 : tranche 1, clés et forme du vocabulaire
- Contexte : le plan ne fixait pas les noms des clés de section.
- Décision : clés anglaises en camelCase (`acceptanceCriteria`, `whyNow`, `answerCriteria`…), `why` propre à chaque type ; `criteria.<TYPE>` porte le nom de la clé de section, pas le texte ; `review.markers.formerly` vaut `ex-` pour reconstruire `(ex-RBn)` à l'identique en tranche 2.
- Écarté : garder une liste `REQUIRED_SECTIONS` écrite dans `spec.mjs`, parce qu'elle recopierait les termes ; elle est dérivée de `sections.<TYPE>` (ordre d'insertion conservé).
- Conséquence : expressions régulières construites une fois au niveau du module (`AMENDMENTS_HEADING`, `SLICES_HEADING`, `REOPENING_ENTRY`).

## 2026-11-26 : le test d'`escapeRegExp` reste dans `vocabulary.test.mjs` (RD3)
- Contexte : revue 1 de la tranche 1 ; ce test relève du domaine `common`.
- Écarté : l'ajouter à `common.test.mjs`, parce que la décision du 2026-11-25 interdit de toucher un fichier de test existant pendant le chantier (preuve de CA-1).
- Conséquence : le déplacer vers `common.test.mjs` est une suite possible après le chantier.

## 2026-11-26 : limites laissées à EPIC-14 (RD6 et idée de la revue 2 de la tranche 1)
- Contexte : avec « oui » / « non » dans le vocabulaire, le `\b` final de `TDD_SEGMENT` ne trouve pas de frontière après une lettre accentuée en fin de terme (« sí ») ; les identifiants `CA-n`, `RB`, `RD` sont eux aussi de la grammaire.
- Écarté : passer à `(?![\p{L}\p{N}_])` avec le drapeau `u`, parce que cela change des cas limites (« ouié »), interdit à un REF ; vocabulariser les identifiants, parce qu'ils sont neutres et que le chantier s'étirerait à chaque revue (limite tracée avec Didier).
- Conséquence : à reprendre dans le premier chantier multilingue d'EPIC-14 (la pseudo-langue le révélera).

## 2026-11-26 : tranche 2, branchement de `review-points.mjs`
- Décision : les valeurs internes de `marker` (`repris`, `ex-<ID>`) dérivent de `review.markers` ; la liste des colonnes attendues du message d'en-tête non reconnu est interpolée (énumération de termes, pas une phrase) ; `EMPTY_POINT_PATTERN` garde la casse du vocabulaire (« Aucun ») avec le drapeau `i`, comportement identique.
- Écarté : exporter `POINT_TABLES`, `POINT_COLUMNS` et `TREATMENTS` pour CA-3, parce que des tests par comportement (`isTreatment`, `parseReviewPoints`) prouvent la même chose sans élargir l'interface.
- Conséquence : deux tests ajoutés à la fin de `vocabulary.test.mjs` (aucune ligne existante modifiée) ; comportement vérifié identique par comparaison JSON ancien / nouveau module sur trois `revue.md`.
