# Plan : FIX-28 Le code fusionné depuis main compte comme code du chantier

## Approche
Un seul calcul des fichiers de code apportés par le chantier depuis un commit, partagé par la revue obsolète (`reviewFacts`) et la tranche (`sliceCodeFiles`, donc « tranche vide » et prochaine étape de FIX-26). La logique décidable sans git (lecture de la version, choix des arguments de `git log`) va dans `lib/core.mjs` en fonctions pures ; `lib/cli.mjs` ne fait que lire les références, les ancêtres et la version, puis lancer la commande. Le calcul actuel de chaque appelant reste le repli.

## Fichiers et couches touchés
- `plugins/atelier/lib/core.mjs` : lecture de la version de git (`2.36.0`, `2.39.3 (Apple Git-146)`, `2.45.1.windows.1`, illisible → null) ; construction des arguments de `git log` (nouveau calcul ou repli de l'appelant) ; export de `defaultBranchName`.
- `plugins/atelier/lib/cli.mjs` : `codeFilesSince` (références de la branche par défaut existantes, distante et locale, exclues seulement si elles ne contiennent pas le plus ancien commit de la chaîne des premiers parents de HEAD après le début (OD2) ; version de git lue une fois) ; `reviewFacts` et `sliceCodeFiles` l'appellent.
- `plugins/atelier/test/merged-code.test.mjs` : dépôts réels (fusion sans conflit, conflit résolu, `main` local en avance, branche déjà fusionnée, dépôt sans branche par défaut) et fonctions pures (versions).
- `site/cycle/revue.md`, `site/reference/limites.md` : règle de la revue obsolète, git 2.36, autres branches d'intégration.
- `docs/chantiers/TEC-3-amend-review-write-tests/decisions.md` : renvoi vers FIX-28.

## Tranches
1. Calcul partagé du code du chantier, branché sur la revue et la tranche, site et décisions — CA couverts : CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-7, CA-8, CA-9

## Risques et points d'attention
- Liste vide à tort (exclusion d'une référence dont HEAD est ancêtre) : `close-check` ne verrait plus le code commité après la revue. Parade : exclusion décidée par les commits (SB1), CA-7. À relire ligne à ligne.
- `--diff-merges=remerge` rejoue chaque fusion : coût négligeable sur une branche de chantier.
- git < 2.36 introuvable en CI : CA-6 testé sur les fonctions pures.
