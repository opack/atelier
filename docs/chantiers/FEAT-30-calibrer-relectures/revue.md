# Revue : FEAT-30 Calibrer la rigueur des relectures

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue : tranche 1 : 2026-11-25
- Commit revu : 4bfd335
- Base : a16af62

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Exemples de relance tirés du code dans spec-critic | plugins/atelier/agents/spec-critic.md:39 | corrigé (d417792) |
| RD2. Deux règles centrales sans marqueur de présence | plugins/atelier/test/docs.test.mjs:176 | corrigé (d417792) |

- Bilan de la revue : deux points à discuter, corrigés à l'accord de Didier (une ligne de texte, trois regex).

## Revue : tranche 1 (relance) : 2026-11-25
- Commit revu : 742c0ee
- Base : a16af62 ; relance depuis 4bfd335 (corrections d417792)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : RD1 et RD2 vérifiés corrigés, sans régression ; aucune idée.

## Revue : tranche 2 : 2026-11-25
- Commit revu : caa736b
- Base : efbe964

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD3. Règle de proportion absente de la page Implémentation | site/cycle/implementation.md:17 | corrigé (81bfe38) |
| RD4. Apostrophe typographique isolée dans le README | README.md:108 | corrigé (81bfe38) |

- Bilan de la revue : deux points à discuter triviaux, corrigés à l'accord de Didier.
