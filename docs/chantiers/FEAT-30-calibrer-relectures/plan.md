# Plan : FEAT-30 Calibrer la rigueur des relectures

## Approche
<!-- 2 à 5 lignes : la solution retenue et pourquoi elle plutôt qu'une autre. -->

Uniquement des consignes en texte. Pour ne pas diluer les prompts des relecteurs, un seul bloc compact au même libellé dans les trois agents (« Bilan de chaque point », « Proportion », « Relance »), adapté à chacun en une ligne ; les skills renvoient à ce bloc plutôt que de le répéter. Les tests de présence (CA-8) cherchent un marqueur stable par règle, pas des phrases entières.

## Fichiers et couches touchés
<!-- - chemin : rôle du changement -->

- `plugins/atelier/agents/spec-critic.md`, `overfit-checker.md`, `reviewer.md` : bilan, usage réel tiré de `CLAUDE.md` / `README`, proportion, relance et idées.
- `plugins/atelier/skills/sign/SKILL.md`, `build/SKILL.md` : relance transmise (points précédents, sections ou fichiers modifiés), présentation des points.
- `plugins/atelier/skills/review/SKILL.md` : relance (commit de la revue précédente, corrections faites), idées hors des tableaux de `revue.md`, correspondance issue → traitement, présentation.
- `site/cycle/signature.md`, `implementation.md`, `revue.md`, `README.md` : description des règles.
- `plugins/atelier/test/docs.test.mjs` : tests de présence `[FEAT-30 CA-x]`.

## Tranches
<!-- Une entrée numérotée de premier niveau par tranche, dans l'ordre : atelier y lit le nombre de tranches.
Chaque tranche : livrable seule, relisible en moins de 15 minutes ; tests, build et revue se font par tranche.
Une tranche garde son numéro ; on ne retire du plan que des tranches à venir.
1. <tranche> — CA couverts : CA-1, CA-2 -->

1. Consignes du plugin : trois agents, skills `sign`, `build`, `review`, tests de présence — CA couverts : CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-8
2. Documentation : pages Signature, Implémentation, Revue du site, `README`, test de présence — CA couverts : CA-7, CA-8

## Risques et points d'attention
<!-- - risque : parade -->

- Vocabulaire interdit par `docs.test.mjs` (« tour de revue », « tour N », « à chaque tour ») dans `reviewer.md`, `review/SKILL.md`, le site et le README : écrire « relance » et « revue ».
- Prompts dilués par des ajouts trop longs : bloc compact commun, renvois depuis les skills.
- Tests de présence fragiles : un marqueur par règle, insensible à la reformulation.
- La revue de la tranche 1 se fait avec le plugin de `main`, donc avec les anciennes règles : voulu, point de comparaison.
