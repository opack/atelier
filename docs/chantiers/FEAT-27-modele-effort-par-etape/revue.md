# Revue : FEAT-27 Modèle et effort réglés par étape

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue : tranche 1 : 2026-11-24
- Commit revu : 4cb46a5
- Base : aaa4488 (merge-base avec main)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Mise à jour de `CLAUDE.md` promise par la spec, prévue dans aucune tranche | `CLAUDE.md:8`, `CLAUDE.md:19` | reporté (tranche 5) : ajoutée au plan ; à la tranche 5, après REF-29, `CLAUDE.md` décrit les modules de domaine de `lib/`, sauf si REF-29 l'a déjà fait |

- Bilan de la revue : tranche saine (324 tests verts, tests figés intacts, aucun test anticipé). Un seul point, reporté à la tranche 5.

## Revue : tranche 2 : 2026-11-24
- Commit revu : 4399f9c
- Base : e633a09 (fin de la tranche 1)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD2. Apostrophes droites dans la nouvelle section de `modes.md` | `site/agent/modes.md:19-38` | reporté (tranche 5) : la tranche de documentation repasse sur le site ; apostrophes typographiques à ce moment-là |

- Bilan de la revue : tranche saine (328 tests verts, tests figés intacts, amendement OD9 appliqué partout). RD1 reste reporté à la tranche 5.
