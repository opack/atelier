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
