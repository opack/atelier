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
