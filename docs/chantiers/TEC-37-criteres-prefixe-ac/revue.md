# Revue : TEC-37 Préfixe AC pour les critères d'acceptation

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique. Les revues d'une même portée sont numérotées (`## Revue 1 : tranche 1 : …`, `## Revue 2 : tranche 1 : …`) ; une revue 2 ou suivante (relance) ajoute sous la base une ligne `- Corrections depuis la revue <n> : <commits>`.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue 1 : tranche 1 : 2026-11-28
- Commit revu : bc17354
- Base : bee3689 (merge-base avec `main`)
- Rejeu de `migrate-tests.mjs` sur la base : résultat identique à f097f13 (36 fichiers) ; 79 lignes hors étiquette finale relues une à une, aucun faux positif.

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Expressions globales à état (`lastIndex`) exportées par `criteria.mjs` | `plugins/atelier/lib/criteria.mjs:9`, `:12` | corrigé (89bb58d) : expressions privées, fonctions `criterionIds` et `listedCriteria` exportées |

- Bilan de la revue : aucun bloquant ; remarques sans point : préfixe en dur dans « sans AC couvert » et « AC globaux » (texte, conforme à la spec), affichage trompeur du script pour deux lignes supprimées d'`architecture.test.mjs` (sans effet), commentaires de `lib/` migrés dès cette tranche.

## Revue 2 : tranche 1 : 2026-11-28
- Commit revu : 89bb58d
- Base : bee3689 (merge-base avec `main`)
- Corrections depuis la revue 1 : 89bb58d

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : RD1 réglé, comportement inchangé, 600 tests verts.

## Revue 3 : tranche 2 : 2026-11-28
- Commit revu : 8172b00
- Base : ac936fe (revue de la tranche 1)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : 603 tests verts ; numéros conservés dans la spec et le plan d'EPIC-14 (AC-1 à AC-10) et d'EPIC-17 (AC-1 à AC-7), mentions historiques reformulées sans changement de sens, OD5 à OD8 corrigés, OD9 accepté par Didier. Remarque sans point : la nouvelle entrée du journal d'EPIC-17 a une ligne « Décision » au lieu d'« Écarté », comme d'autres entrées de ce journal.
