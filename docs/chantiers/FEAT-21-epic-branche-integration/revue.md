# Revue : FEAT-21 EPIC en branche d'intégration

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique. Les revues d'une même portée sont numérotées (`## Revue 1 : tranche 1 : …`, `## Revue 2 : tranche 1 : …`) ; une revue 2 ou suivante (relance) ajoute sous la base une ligne `- Corrections depuis la revue <n> : <commits>`.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue 1 : tranche 1 : 2026-11-25
- Commit revu : c5a97f3
- Base : 0538470 (merge-base avec main)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : aucun point. CA-1 à CA-5 couverts et testés, règle de base calculée en un seul endroit, index construit une fois et seulement avec un parent, architecture respectée. OD1 (test status --json d’un EPIC à l’option) déjà reporté à la tranche 3 dans decisions.md.

## Revue 1 : tranche 2 : 2026-11-25
- Commit revu : 4cabf4b
- Base : 7e4dec9 (slice_base ; fusions de main 2caed55 et fbde138 ignorées)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Tests venus de la branche d'intégration comptés comme tests du chantier (gel refusé, tests changés) | plugins/atelier/lib/cli/tdd.mjs:43 | corrigé (8863dfe), test ajouté (64aa051) après réouverture des tests |
| RD2. La spec §3 dit encore que `reviewFacts` ne change pas, contredit par CA-15 | docs/chantiers/FEAT-21-epic-branche-integration/spec.md:59 | reporté (tranche 4) : la phrase sera corrigée par l'amendement prévu en tranche 4, décision de Didier |

- Bilan de la revue : CA-6, CA-7, CA-13, CA-15 couverts et testés ; un seul calcul de la base par commande. Deux points à discuter.
