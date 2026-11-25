# Bilan : FEAT-30 Calibrer la rigueur des relectures

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
<!-- 3 lignes : ce qui a été fait, pour qui, état final. -->

Les trois relecteurs (`spec-critic`, `overfit-checker`, `reviewer`) donnent désormais, pour chaque point, bloquant compris, le coût de la correction, le coût de la non-correction (échec silencieux ou bruyant dans l'usage réel du projet) et un verdict, avec l'option la moins chère quand la correction est disproportionnée. Une relance (revue 2 et suivantes d'une même portée) ne retient que ce que les corrections ont causé, plus les bloquants ; le reste devient une idée sans traitement exigé. Les skills présentent chaque point avec un résumé, les deux coûts, le verdict et l'avis de l'agent ; le site et le README décrivent ces règles.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 bilan de chaque point dans les trois agents | Livré | `docs.test.mjs` : `… demande le bilan de chaque point … [FEAT-30 CA-1]` (×3) |
| CA-2 usage réel tiré de `CLAUDE.md` / `README` | Livré | `… tire l'usage réel de CLAUDE.md et du README [FEAT-30 CA-2]` (×3) |
| CA-3 règle de proportion, bloquants compris | Livré | `… énonce la règle de proportion [FEAT-30 CA-3]` (×3) |
| CA-4 premier passage / relance, idées sans identifiant | Livré | `… distingue premier passage et relance … [FEAT-30 CA-4]` (×3) |
| CA-5 relance transmise par `review`, `sign`, `build` ; issue → traitement | Livré | `review définit la relance … [FEAT-30 CA-5]`, `… transmet la relance … [FEAT-30 CA-5]` (×2) |
| CA-6 présentation : résumé, deux coûts, verdict, avis | Livré | `… présente chaque point avec un résumé … [FEAT-30 CA-6]` (×3) |
| CA-7 site (Signature, Implémentation, Revue) et README | Livré | `… décrit le bilan des points, la proportion et la relance [FEAT-30 CA-7]` (×4) |
| CA-8 `npm test` vert, tests de présence | Livré | suite complète : 375 tests verts |

Écart par rapport à la spec : ajout, à la demande de Didier (RD6), d'une convention de consignation des revues numérotées par portée dans `revue.md` (`## Revue 2 : tranche 1`, ligne `Corrections depuis la revue 1 :`). La spec ne la demandait pas ; elle la complète sans la contredire.

## 3. Choix techniques
<!-- Les décisions structurantes, une ligne chacune. -->

- Un bloc compact au même libellé (« Bilan de chaque point », « Relance ») dans les trois agents, adapté en une ligne à chacun ; les skills le reprennent sans le répéter en entier.
- Le bilan s'applique aussi aux bloquants : il justifie leur gravité, et l'option la moins chère d'un bloquant doit supprimer le problème.
- Aucune nouvelle notion de traitement : ne pas corriger → `exception acceptée`, chantier séparé → `reporté`, limite documentée → `corrigé`.
- Tests de présence : un marqueur stable par règle dans `docs.test.mjs`, pas de phrases entières.
- Chantier hors `lib/` : consignes et documentation seulement, en `tdd: no`.

## 4. Éléments de code principaux
<!-- Points d'entrée, modules / composants / fonctions créés ou modifiés, avec leur rôle. Ce qu'un nouveau venu doit lire en premier. -->

- `plugins/atelier/agents/reviewer.md`, sections « Bilan de chaque point » et « Relance » : la règle de référence (identique dans `spec-critic.md` et `overfit-checker.md`).
- `plugins/atelier/skills/review/SKILL.md` : relance (§2), correspondance issue → traitement (§3), idées hors des tableaux et numérotation des revues (§4).
- `plugins/atelier/skills/sign/SKILL.md`, `build/SKILL.md` : présentation des points et relance.
- `site/cycle/revue.md`, sous-sections « Bilan de chaque point » et « Relance » ; `signature.md`, `implementation.md` et `README.md` y renvoient.
- `plugins/atelier/test/docs.test.mjs`, blocs `calibrated review points` (tranche 1) et `… in the documentation` (tranche 2).

## 5. Pistes écartées
<!-- Ce qui a été envisagé ou essayé puis abandonné, et pourquoi. -->

- Ajout au lot 3 d'EPIC-17 : son hors-périmètre exclut le contenu des agents et skills hors rangement.
- Grille d'étiquettes probabilité × gravité, quota de points par passage, réglage par projet des domaines de relecture, retrait des cas limites génériques des grilles, nouveau vocabulaire de traitement : refusés par Didier pendant le cadrage (voir `decisions.md`).
- Bilan réservé aux points à discuter (première version de la spec, SD3) : les bloquants sont ceux qui imposent les corrections les plus lourdes.
- Mention « (relance) » dans les titres de `revue.md` : remplacée par la numérotation des revues, plus claire (RD6).

## 6. Dette et suites
<!-- Ce qui reste à faire, raccourcis assumés, chantiers à ouvrir. -->

- Mesurer l'effet au fil des prochains chantiers : part des points à discuter corrigés et nombre de revues par portée, à comparer avec TEC-15 (26 points corrigés sur 28) et REF-29. Sur FEAT-30 lui-même : 6 points à discuter, tous à une ligne, chaque portée convergée dès la revue 2 (revue 3 pour le chantier, à cause d'un changement de convention demandé).
- Les sessions sur ce dépôt utilisent le plugin de `main` : les nouvelles règles ne s'appliquent qu'après fusion et mise à jour du plugin installé (sur ce chantier, elles ont été passées à la main au reviewer).
- Idée non retenue (revue 3 du chantier) : aligner les titres `Revue : …` des fixtures des tests `review-points-*` sur la numérotation, sans effet fonctionnel.
- Version du plugin montée en 0.5.0 (comportement des relecteurs modifié) ; FEAT-27 visera 0.6.0 si besoin.

## 7. Verdict de revue
<!-- Repris de revue.md : revues de tranche et du chantier, puis un point par identifiant (RB1, RD1…) avec son traitement final, exceptions acceptées comprises. -->

Tranche 1 : revue 1 (RD1, RD2), revue 2 sans point. Tranche 2 : revue 1 (RD3, RD4), revue 2 sans point. Chantier : revue 1 (RD5, RD6), revues 2 à 4 sans point (revue 4 : version 0.5.0). Aucun bloquant.

| Point | Traitement |
|---|---|
| RD1. Exemples de relance tirés du code dans spec-critic | corrigé (d417792) |
| RD2. Deux règles centrales sans marqueur de présence | corrigé (d417792) |
| RD3. Règle de proportion absente de la page Implémentation | corrigé (81bfe38) |
| RD4. Apostrophe typographique isolée dans le README | corrigé (81bfe38) |
| RD5. Le site présente un échec bruyant comme à corriger plus tard | corrigé (8909015) |
| RD6. Forme d'une relance dans revue.md non décrite | corrigé (8909015, cf28add), contre le verdict « ne pas corriger » du relecteur : Didier veut un historique homogène |

- Verdict : accepté
- Validé par : Didier (Opack)
- Date : 2026-11-25
