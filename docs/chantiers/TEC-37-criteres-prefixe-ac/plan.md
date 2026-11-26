# Plan : TEC-37 Préfixe AC pour les critères d'acceptation

## Approche
<!-- 2 à 5 lignes : la solution retenue et pourquoi elle plutôt qu'une autre. -->

Un module pur `lib/criteria.mjs` porte le préfixe `AC` et ses expressions (identifiant, critère en tête d'élément de liste, identifiants d'un segment de couverture, étiquette finale d'un nom de test) ; `lib/slices.mjs`, `lib/spec.mjs` et `test/architecture.test.mjs` l'importent, et le libellé `coverage` de `lib/vocabulary.mjs` (REF-34) devient « AC couverts ». Les tests existants sont migrés par un script rejouable, `docs/chantiers/TEC-37-criteres-prefixe-ac/migrate-tests.mjs`, sur le modèle de `check-moves.mjs` (REF-16) : le rejouer sur la base redonne le diff, ce qui rend la migration relisible. Base : `main` après la fusion de REF-34 et FEAT-35.

## Fichiers et couches touchés
<!-- - chemin : rôle du changement -->

- `plugins/atelier/lib/criteria.mjs` (nouveau) : préfixe et expressions des critères, pur, sans import de `lib/`.
- `plugins/atelier/lib/slices.mjs`, `plugins/atelier/lib/spec.mjs` : lecture des critères par `criteria.mjs`, insensible à la casse ; messages en `AC`.
- `plugins/atelier/lib/vocabulary.mjs` : `plan.coverage` → « AC couverts ».
- `plugins/atelier/lib/next-step.mjs` : message « AC globaux ».
- `plugins/atelier/test/criteria.test.mjs` (nouveau) : AC-1 à AC-4, exemples refusés en `CA` et `V`.
- `plugins/atelier/test/*.test.mjs`, `helpers.mjs` : migration mécanique (`CA-n`, `ca-n`, `V-n`, `CA couverts`, expressions sur les messages, « CA » en prose) ; `architecture.test.mjs` importe `criteria.mjs` ; `spec-ellipsis.test.mjs` cherche `AC-1 :` dans les templates.
- `plugins/atelier/test/migration.test.mjs` (nouveau) : AC-5.
- `docs/chantiers/EPIC-14-atelier-sur-tout-depot/spec.md` et `plan.md`, `docs/chantiers/EPIC-17-plugin-lisible/spec.md`, `plan.md` et `decisions.md` : migration et traces.
- `plugins/atelier/templates/*.md`, `plugins/atelier/skills/*/SKILL.md`, `plugins/atelier/agents/*.md`, `CLAUDE.md`, `README.md`, `site/**/*.md`, `site/.vitepress/config.*` : textes en `AC`, page `site/reference/nomenclature.md`, glossaire, barre latérale.
- `plugins/atelier/test/docs.test.mjs` : AC-6 et AC-7.
- `plugins/atelier/.claude-plugin/plugin.json` : version mineure.

## Tranches
<!-- Une entrée numérotée de premier niveau par tranche, dans l'ordre : atelier y lit le nombre de tranches.
Chaque tranche : livrable seule, relisible en moins de 15 minutes ; tests, build et revue se font par tranche.
Une tranche garde son numéro ; on ne retire du plan que des tranches à venir.
Chaque tranche déclare son TDD : une tranche qui n'a rien à tester (doc, site, version) se déclare « TDD : non » ; « TDD : oui » exige au moins un CA.
1. <tranche> — CA couverts : CA-1, CA-2 — TDD : oui|non -->

1. Code et migration des tests : à l'étape tests, `migrate-tests.mjs` exécuté sur les tests existants et `criteria.test.mjs` écrit ; à l'implémentation, `criteria.mjs`, branchement de `slices.mjs` et `spec.mjs`, vocabulaire, messages de `lib/` — AC couverts : AC-1, AC-2, AC-3, AC-4 — TDD : oui
2. Migration des documents ouverts : `migration.test.mjs`, puis spec et plan d'EPIC-14 et d'EPIC-17 en `AC` avec leurs entrées d'amendement, entrée dans `decisions.md` d'EPIC-17 — AC couverts : AC-5 — TDD : oui
3. Textes et site : templates (TEC et REF compris), skills, agents, `CLAUDE.md`, `README.md`, pages du site et consignes `CA-2 : …` alignées sur l'étiquette finale, page `reference/nomenclature.md` avec barre latérale et renvois du glossaire, tests AC-6 et AC-7 dans `docs.test.mjs` écrits avec les textes, version mineure — AC couverts : AC-6, AC-7, AC-8 — TDD : non

## Risques et points d'attention
<!-- - risque : parade -->

- Faux positif du remplacement mécanique : le script ne touche que `\bCA-\d`, `\bca-\d`, `CA couverts`, `\bV-\d` et une liste fermée de motifs (expressions sur les messages, « CA » en prose), et affiche chaque ligne modifiée ; la revue de la tranche 1 relit cette liste.
- Tests arrivés après le gel : REF-34 et FEAT-35 doivent être dans `main` avant l'étape tests de la tranche 1 ; `main` est fusionnée juste avant.
- Amorçage : le plugin installé ne lit pas `AC`, `check-plan` échoue sur ce plan (consigné dans `decisions.md`) ; la tranche 1 est « TDD : oui » pour que `tdd: yes` tienne lieu de `slice_tdd`.
- Règle de vocabulaire de REF-34 (`architecture-vocabulary.test.mjs`) : « AC couverts » reste dans `vocabulary.mjs`, les messages n'en citent que l'interpolation ou le mot « couvert » hors vocabulaire, comme aujourd'hui.
- Taille des fichiers de test : le renommage ne change aucun nombre de lignes.
