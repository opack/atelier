# Revue : FIX-20 TDD décidé tranche par tranche

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Revue : tranche 1 : 2026-11-24
- Commit revu : 84fa3d9
- Base : f662c5b (merge-base avec main)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Tolérances de lecture du plan (« – », texte après oui/non, CA en minuscules) sans test | plugins/atelier/lib/core.mjs:1055 | reporté (tranche 4) : cas ajoutés aux tests de `check-plan` (CA-11), qui lisent le plan via `planSlices` ; accord de Didier |
| RD2. Plan annonçant les tests dans `core.test.mjs` alors que la tranche crée `plan.test.mjs` | docs/chantiers/FIX-20-tranche-tdd-sans-ca/plan.md:9 | corrigé (4dc1b71) |

- Bilan de la revue : aucun bloquant ; tranche 1 validée par Didier le 2026-11-24. FIX-20 mis en pause ensuite (ordre FIX-28, REF-29, puis FIX-20).

## Revue : tranche 2 : 2026-11-25
- Commit revu : 50ea25b
- Base : 4dc1b71 (slice_base ; fusions de main REF-29, FIX-31, FIX-32 exclues de la relecture)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD3. Correction OB1 (tests figés d'un chantier repassé en `tdd: no`) sans test | plugins/atelier/lib/tdd.mjs:31 | corrigé (f881bdf), reporté de la tranche 2 : test « un chantier repassé en tdd: no après le gel… » [FIX-20 CA-4] ; accord de Didier |
| RD4. `slice_tdd` de valeur inconnue désactive le TDD ; lecture sans casse non testée | plugins/atelier/lib/tdd.mjs:13 | corrigé (b989ddb), reporté de la tranche 2 : test (f881bdf) puis retour au `tdd` du chantier hors `yes`/`no` ; commentaire recoupé (423cdca) ; accord de Didier |
| RD5. `plan.md` cite encore `core.mjs` et `cli.mjs` | docs/chantiers/FIX-20-tranche-tdd-sans-ca/plan.md:7 | corrigé (895512d) |

- Bilan de la revue : aucun bloquant ; tranche 2 validée par Didier le 2026-11-25.

## Revue : tranche 3 : 2026-11-25
- Commit revu : b989ddb
- Base : 895512d (slice_base ; fusion de main 7b57185 exclue de la relecture)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD6. Revue d'ensemble d'un chantier `tdd: no` dont une tranche était en TDD : la phase retombe à `none` malgré `tests_commit` | plugins/atelier/lib/tdd.mjs:66 | reporté (tranche 4) : test (`tdd: no`, `slice: chantier`, `tests_commit` → `implementing`) puis condition dans `testDrivenPhase` ; accord de Didier |
| RD7. Règle « `slice_tdd` sinon `tdd` » réécrite dans `review.mjs` et `next-step.mjs` | plugins/atelier/lib/review.mjs:101 | corrigé (6d2d1b2) |

- Bilan de la revue : aucun bloquant ; RD3 et RD4 (tranche 2) réglés ; tranche 3 validée par Didier le 2026-11-25.
