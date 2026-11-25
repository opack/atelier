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
