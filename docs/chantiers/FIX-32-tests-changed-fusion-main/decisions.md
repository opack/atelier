# FIX-32 Décisions

- 2026-11-25 : spec amendée après essai sur la branche FIX-20. L'implémentation de la spec signée passait tous les tests mais FIX-20 restait bloqué : sa fusion de `main` avait un conflit dans `tdd.test.mjs` (deux `describe` ajoutés en fin de fichier), la limite assumée de SD1. Didier a choisi de regarder les lignes (option écartée : garder la spec et rouvrir puis regeler les tests à chaque conflit, avec un commit de test factice exigé par `freeze-tests`).
- 2026-11-25 : lignes ajoutées comparées aux versions fusionnées sans aucun espace (`withoutSpaces`), comme le diff en `--ignore-all-space` (OD2) ; une version `trim()` signalait une résolution reformatée.
- 2026-11-25 : OD1 écarté : git < 2.36 (avril 2022) est hors cible, décision de Didier.
- 2026-11-25 : OD3 traité : test ajouté (ligne ajoutée par le chantier dans un test figé), passe déjà avec l'implémentation.
