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
| RD2. La spec §3 dit encore que `reviewFacts` ne change pas, contredit par CA-15 | docs/chantiers/FEAT-21-epic-branche-integration/spec.md:59 | spec amendée : §3 corrigé par l'amendement du 2026-11-26 (tranche 4) |

- Bilan de la revue : CA-6, CA-7, CA-13, CA-15 couverts et testés ; un seul calcul de la base par commande. Deux points à discuter.

## Revue 2 : tranche 2 : 2026-11-25
- Commit revu : 0f91212
- Base : 7e4dec9 (slice_base ; fusions de main ignorées)
- Corrections depuis la revue 1 : dd8bf20 (réouverture des tests), 64aa051 (test de RD1), 4430173 (regel), 8863dfe (correction de RD1), 0f91212 (traitement consigné)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : RD1 réglé (test rouge avant le correctif, vert après) ; RD2 reporté à la tranche 4 ; OD4 reporté à la tranche 3 (decisions.md).

## Revue 1 : tranche 3 : 2026-11-26
- Commit revu : f60e5b4
- Base : 78826b3 (slice_base)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| RB1. Message « enfant pas fusionné » de close-check modifié sans l'option (contredit CA-1) | plugins/atelier/lib/relations.mjs:185 | corrigé (d078d02) : texte identique à l'avant-FEAT-21 sans l'option |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : CA-8, CA-9, CA-10, CA-14 couverts et testés ; OD1, OD2, OD4 faits. Un bloquant : un texte de close-check a changé pour un EPIC sans l'option.

## Revue 2 : tranche 3 : 2026-11-26
- Commit revu : f716ec2
- Base : 78826b3 (slice_base)
- Corrections depuis la revue 1 : d078d02 (RB1), f716ec2 (traitement consigné)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : RB1 réglé, texte identique à l'avant-FEAT-21 sans l'option ; rien de nouveau.

## Revue 1 : tranche 4 : 2026-11-26
- Commit revu : dcebf49
- Base : 677544d (slice_base)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD3. Débrayage pour résoudre un conflit sur la branche de l'EPIC, sans commande ni levée | plugins/atelier/skills/close/SKILL.md:17 | corrigé (3137c2b) : /atelier:off, trailer Atelier-Bypass, bypass off aussitôt (skill close et site) |
| RD4. Revue d'ensemble : traitements « test ajouté » et « corrigé » non adaptés à l'EPIC | plugins/atelier/skills/review/SKILL.md:50 | corrigé (3137c2b) : test manquant par enfant correctif, consigne `corrigé (<ID de l'enfant>, fusion <commit>)` |
| RD5. Branche d'intégration supposée présente et à jour en local dans new, close et la règle des commits | plugins/atelier/skills/new/SKILL.md:38 | corrigé (3137c2b) : fetch, référence la plus avancée ou arrêt si divergence ; branche d'EPIC à l'option jamais recréée ; référence distante si absente en local |
| RD6. Virgule manquante dans commandes.md, description de review sans la revue d'ensemble | site/reference/commandes.md:27 | corrigé (3137c2b) |

- Bilan de la revue : CA-11, CA-12 et le test de l'amendement (CA-8) conformes ; 4 points de consignes corrigés, sur accord de Didier.

## Revue 2 : tranche 4 : 2026-11-26
- Commit revu : f032cf2
- Base : 677544d (slice_base)
- Corrections depuis la revue 1 : 3137c2b (RD3, RD4, RD5, RD6), f032cf2 (traitements consignés)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD7. Synchronisation de la branche d'intégration par `git pull`, qui rebase avec `pull.rebase=true` | plugins/atelier/skills/new/SKILL.md:38 | corrigé (e6f6ae4) : fusion `[<ID>] merge <remote>/<branche>` puis push dans new, review, close et le message de integrationRefChoice |

- Bilan de la revue : RD3 à RD6 réglés ; RD7 corrigé sur accord de Didier.
