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

## Revue : tranche 4 : 2026-11-25
- Commit revu : 2235812
- Base : 6d2d1b2 (slice_base)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD8. `check-plan <chemin>` écrit `slice_tdd` d'après un fichier qui n'est pas le `plan.md` du chantier | plugins/atelier/lib/cli/slices.mjs:68 | reporté (tranche 5) : contournement tordu, mais la correction tient en une condition (écrire `slice_tdd` seulement pour le `plan.md` du chantier) ; test avec ceux d'OD13 ; accord de Didier |
| RD9. Garde-fous de `checkPlanValues` en double (réouverture recopiée de `sliceState`) ou hors logique pure (EPIC), garde `legacy` sans effet | plugins/atelier/lib/slices.mjs:110 | reporté (tranche 5) : utilitaire partagé, refus EPIC dans `checkPlanValues`, garde réduite au modèle `none` ; test avec OB3 ; accord de Didier |

- Bilan de la revue : aucun bloquant ; RD1 et RD6 (reportés), OD3, OD6 et OD8 réglés et testés ; tranche 4 validée par Didier le 2026-11-25.
- Hors chantier : la spec de FEAT-4 contient un commentaire HTML jamais refermé qui avale CA-6 à CA-8 (idée restante de FIX-22).

## Revue : tranche 5 : 2026-11-25
- Commit revu : b15ce46
- Base : 2235812 (slice_base)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : aucun point ; RD8, RD9 (tranche 4), OB3, OD11, OD12 et OD13 réglés et testés ; OD14 et OD16 reportés en tranche 6 (decisions.md) ; tranche 5 validée par Didier le 2026-11-25.

## Revue : tranche 6 : 2026-11-25
- Commit revu : 847f299
- Base : b15ce46 (slice_base ; fusion de main 952d32f exclue de la relecture)
- Corrections depuis la première relecture : e0e6019

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD10. `slice_tdd` absent des listes de champs réservés à la commande (règle 4 de la garde, README) | site/reference/configuration.md:19 | corrigé (e0e6019) |
| RD11. Condition des « tests d'abord » décrite au niveau du chantier (`tdd: yes`) et non de la tranche | site/cycle/tests.md:5 | corrigé (e0e6019) : aussi règle 8 de configuration.md, vue-ensemble.md et skill `review` |
| RD12. Import en double depuis `helpers.mjs` | plugins/atelier/test/tdd-slice-status.test.mjs:4 | écarté : la correction modifierait une ligne d'un test figé de la tranche 5, pour un bruit sans effet ; accord de Didier |

- Bilan de la revue : aucun bloquant ; OD14 et OD16 réglés et testés ; relance propre après e0e6019 ; tranche 6 validée par Didier le 2026-11-25.

## Revue : chantier : 2026-11-25
- Commit revu : 82f1135
- Base : 642d5da (merge-base avec main ; fusions de main exclues de la relecture)
- Corrections depuis la première relecture : bf50d62, 82f1135

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1 (repris). Tolérances de lecture du plan (« – », texte après oui/non, CA en minuscules) sans test | plugins/atelier/lib/slices.mjs | corrigé (d0cd3c3) : test « lit le plan avec tolérance » [FIX-20 CA-11] |
| RD6 (repris). Revue d'ensemble d'un chantier `tdd: no` dont une tranche était en TDD : la phase retombe à `none` malgré `tests_commit` | plugins/atelier/lib/tdd.mjs | corrigé (2235812) : test (d0cd3c3) puis condition `slice === 'chantier'` dans `testDrivenPhase` |
| RD8 (repris). `check-plan <chemin>` écrit `slice_tdd` d'après un fichier qui n'est pas le `plan.md` du chantier | plugins/atelier/lib/cli/slices.mjs | corrigé (b15ce46) : test (a54935b) |
| RD9 (repris). Garde-fous de `checkPlanValues` en double ou hors logique pure | plugins/atelier/lib/slices.mjs | corrigé (b15ce46) : test (a54935b) |
| RD13. README et pages du site non alignés sur le TDD par tranche | README.md:88 | corrigé (bf50d62) : le `tdd` du chantier vaut par défaut, chaque tranche peut le redéfinir ; `slice_tdd` dans signature.md ; revue.md reformulé |
| RD14. Tests des tranches précédentes protégés par la seule revue en tranche « TDD : non » et en revue d'ensemble qui suit ; doc qui les disait figés | site/cycle/tests.md:27 | corrigé (bf50d62, 82f1135) : doc et skill `build` (arrêt « test à revoir ») ; garde technique en suite au bilan ; accord de Didier |
| RD15. Chantier `tdd: yes` à une seule tranche « TDD : non » : messages contradictoires (`reopen-tests`, prochaine étape) | plugins/atelier/lib/tdd.mjs:114 | écarté : cas rare, messages seulement, aucune garde touchée ; noté en suite au bilan ; accord de Didier |
| RD16. Note de la spec « à vérifier en test » (tranche 1 « TDD : non » avant le premier `set-reviewed`) sans test | plugins/atelier/test/tdd-slice.test.mjs | test ajouté (bf50d62) [FIX-20 CA-6] |

- Bilan de la revue : aucun bloquant ; CA-1 à CA-15 couverts par des tests verts ; parcours complet rejoué (tranches oui/non mêlées, de `check-plan` à `close-check`) ; relance propre après 82f1135 ; revue du chantier validée par Didier le 2026-11-25.
