# Revue : TEC-15 Identifiants stables des points de relecture

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Revue : tranche 1 : 2026-11-22
- Commit revu : d43a88e
- Base : aa01962

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Une ligne vide ou un tableau sans ligne d'en-tête fait perdre un point sans signalement | `plugins/atelier/lib/core.mjs:949`, `:957` | test ajouté (9e36525) ; correction à faire (`/atelier:build`) |
| RD2. Une ligne dont le nombre de cellules diffère de l'en-tête est acceptée en silence | `plugins/atelier/lib/core.mjs:961-965`, `:976` | test ajouté (9e36525) : `cellCountMismatch` exposé ; correction à faire (`/atelier:build`) ; signalement en tranche 2 (CA-6) |
| RD3. Un tableau dans un commentaire HTML est lu comme de vrais points | `plugins/atelier/lib/core.mjs:927-933` | test ajouté (9e36525) ; correction à faire (`/atelier:build`) |
| RD4. `\d+` accepte les zéros en tête (`RB02` ≠ `RB2`) | `plugins/atelier/lib/core.mjs:897` | écarté : les numéros sont donnés par `atelier review-ids` (tranche 3), personne ne tape `RB02` à la main ; ne vaut pas un amendement |
| RD5. `legacy` vaut vrai dès qu'une seule section `## Tour` existe | `plugins/atelier/lib/core.mjs:981` | reporté (tranche 2) : OD3 de `decisions.md`, à trancher par un test avec CA-7 |

- Bilan de la revue : aucun point bloquant ; RD1 à RD3 à corriger avant la revue 2 de la tranche 1.

## Revue : tranche 1 : 2026-11-22 (2)
- Commit revu : ab308d8
- Base : aa01962

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1 (repris). Une ligne vide ou un tableau sans ligne d'en-tête fait perdre un point sans signalement | `plugins/atelier/lib/core.mjs` | corrigé (ab308d8) |
| RD2 (repris). Une ligne dont le nombre de cellules diffère de l'en-tête est acceptée en silence | `plugins/atelier/lib/core.mjs` | corrigé (ab308d8) : `cellCountMismatch`, contre l'en-tête ou les colonnes du template ; signalement en tranche 2 (CA-6) |
| RD3 (repris). Un tableau dans un commentaire HTML est lu comme de vrais points | `plugins/atelier/lib/core.mjs` | corrigé (ab308d8) : commentaire masqué s'il ouvre une ligne (OB1) |
| RD6. Un point mal formé suivi d'une ligne de séparation est pris pour l'en-tête et disparaît sans signalement | `plugins/atelier/lib/core.mjs:983` | corrigé (37616d4) : en-tête seulement avec une cellule `Point` ; test en tranche 2 (CA-6) |

- Bilan de la revue : aucun point bloquant ; RD1 à RD3 et RD6 corrigés, revue 3 à mener sur 37616d4.

## Revue : tranche 1 : 2026-11-22 (3)
- Commit revu : 792334a
- Base : aa01962

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD7. Une ligne de point qui contient une cellule `Point`, suivie d'un séparateur, est prise pour l'en-tête | `plugins/atelier/lib/core.mjs:983` | corrigé (24e212a) |
| RD8. Le test de RD6 attendu en tranche 2 n'est tracé que dans `revue.md` | `docs/chantiers/TEC-15-nomenclature-points-revue/revue.md:42` | reporté (tranche 2) : tests de RD6 et RD7 avec CA-6, consignés dans `decisions.md` |
| RD9. Commentaire de `parseReviewPoints` mal recoupé | `plugins/atelier/lib/core.mjs:956` | corrigé (24e212a) |

- Bilan de la revue : aucun point bloquant ; RD7 et RD9 corrigés, RD8 reporté en tranche 2 ; revue 4 à mener sur 24e212a.

## Revue : tranche 1 : 2026-11-22 (4)
- Commit revu : bd64b07
- Base : aa01962

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD10. Un point mal formé qui contient une cellule `Point`, suivi d'un séparateur, est pris pour l'en-tête et fausse les lignes suivantes | `plugins/atelier/lib/core.mjs:984-985` | corrigé (6941c37) : en-tête décidé par sa position ; test en tranche 2 avec CA-6 (`decisions.md`) |

- Bilan de la revue : aucun point bloquant ; RD10 corrigé à la racine ; revue 5 à mener sur 6941c37.

## Revue : tranche 1 : 2026-11-22 (5)
- Commit revu : e311c7a
- Base : aa01962

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD11. Une ligne de point mal formée qui ouvre un tableau après une rupture devient l'en-tête et disparaît sans signalement | `plugins/atelier/lib/core.mjs:985-986` | corrigé (765f871) : un en-tête n'a que des noms de colonnes ; test en tranche 2 avec CA-6 (`decisions.md`) |

- Bilan de la revue : aucun point bloquant ; RD11 corrigé ; revue 6 à mener sur 765f871.

## Revue : tranche 1 : 2026-11-22 (6)
- Commit revu : 6f04b01
- Base : aa01962

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : aucun point ; RD11 confirmé corrigé ; RD5 et RD8 restent reportés en tranche 2. Cas théorique noté : un en-tête avec une colonne en plus n'est plus reconnu, ses lignes sont signalées (messages de CA-6, tranche 2).

## Revue : tranche 2 : 2026-11-22
- Commit revu : 2c4a305
- Base : 6f04b01

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| RB1. Un identifiant présenté comme nouveau dans deux sections de même titre n'est pas signalé, et un point non traité disparaît | `plugins/atelier/lib/core.mjs:1126` | corrigé (aea10c1) : sections comptées par position ; test ajouté (c98dee6) |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD5 (repris). `legacy` vaut vrai dès qu'une seule section `## Tour` existe | `plugins/atelier/lib/core.mjs` | test ajouté (9a00da6) : une section `## Tour` suffit, limite assumée au §4 de la spec ; OD3 fermé dans `decisions.md` |
| RD8 (repris). Le test de RD6 attendu en tranche 2 n'est tracé que dans `revue.md` | `plugins/atelier/test/core.test.mjs` | test ajouté (9a00da6) : RD6, RD7, RD10, RD11 et l'en-tête mal écrit couverts avec CA-6 |
| RD12. « Reportée (tranche 2) » passe la clôture | `plugins/atelier/lib/core.mjs:1049` | corrigé (aea10c1) : `reporté\p{L}*` ; test ajouté (c98dee6) |
| RD13. La moitié numérotation de CA-13 n'est couverte par aucune tranche | `docs/chantiers/TEC-15-nomenclature-points-revue/plan.md` | corrigé : CA-13 (numérotation) ajouté à la tranche 3 du plan |
| RD14. RD5 et RD8 réglés dans le code mais encore reportés dans `revue.md` | `docs/chantiers/TEC-15-nomenclature-points-revue/revue.md` | corrigé : RD5 et RD8 repris dans cette revue |
| RD15. Commentaire coupé de `reviewPointProblems`, `requalifiedTarget` appelé deux fois | `plugins/atelier/lib/core.mjs:1066`, `:1139` | corrigé (aea10c1) |

- Bilan de la revue : RB1 corrigé ; RD5, RD8, RD12 à RD15 traités ; revue 2 à mener sur le commit corrigé.

## Revue : tranche 2 : 2026-11-22 (2)
- Commit revu : 49ff2d5
- Base : 6f04b01

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : aucun point ; RB1, RD12 et RD15 confirmés corrigés, RD13 et RD14 confirmés traités ; le contrôle des points ne signale rien sur ce `revue.md`, avec ou sans `atClose`.

## Revue : tranche 3 : 2026-11-23
- Commit revu : fc15dab
- Base : 49ff2d5

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : aucun point ; CA-1, CA-2, CA-10 et CA-13 (numérotation) couverts, 228 tests verts ; essai réel de `atelier review-ids` sur ce dépôt : RB3, RD16, SB2, SD3, OB3, OD33, aucun point ouvert. Remarque mineure non numérotée : `commandReviewIds` relit `spec.md` et calcule `visibleLines(revue)` deux fois, coût négligeable.
