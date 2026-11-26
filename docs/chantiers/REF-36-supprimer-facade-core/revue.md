# Revue : REF-36 Supprimer la façade lib/core.mjs

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique. Les revues d'une même portée sont numérotées (`## Revue 1 : tranche 1 : …`, `## Revue 2 : tranche 1 : …`) ; une revue 2 ou suivante (relance) ajoute sous la base une ligne `- Corrections depuis la revue <n> : <commits>`.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue 1 : 2026-11-26
- Commit revu : bd8032c
- Base : 971c3a6

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Règle « Les tests importent par noms les modules de domaine » vidée de son sens sans « jamais `lib/core.mjs` », et vérifiée par aucun test | `CLAUDE.md:21` | corrigé (544caf7) : puce retirée, choix de Didier |

- Bilan de la revue : CA-1, CA-2, CA-3 vérifiés ; 498 → 495 tests, seuls les 3 tests de la façade retirés (noms comparés sur deux worktrees) ; périmètre de la spec complet (aucune mention de `core.mjs` dans skills, agents, hooks, templates, README, site) ; aucune règle d'architecture utile perdue.

## Revue 2 : 2026-11-26
- Commit revu : 30d7124
- Base : 971c3a6
- Corrections depuis la revue 1 : 544caf7

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : RD1 réglé, rien d'autre n'a bougé ; 495 tests verts, CA-1 tient toujours.
