# Revue : TEC-23 Lancer les contrôles une seule fois par état du code

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue : 2026-11-23
- Commit revu : 010bd11
- Base : ae55ab5

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Commentaire de `decideStop` coupé par l’insertion des helpers | `plugins/atelier/lib/core.mjs:1644` | corrigé (8d06bd4) : helpers déplacés au-dessus du commentaire |
| RD2. « Garanties et limites » ne dit pas que la clôture réutilise un vert | `site/reference/limites.md:8` | corrigé (8d06bd4) : puce ajoutée (empreinte git, angles morts, `--force`) |
| RD3. Étape 4 du contrôle de fin de tour muette sur l’origine du vert | `site/reference/configuration.md:44` | corrigé (8d06bd4) |

- Bilan de la revue : CA-1 à CA-7 tenus, tests figés intacts depuis 9222907, 267/267 ; la correction `git rm --force` de `workingTreeId` est hors périmètre annoncé mais nécessaire et tracée dans decisions.md. Validée par Didier le 2026-11-23.

## Revue : 2026-11-23 (après fusion de la PR #11)
- Commit revu : e076e76
- Base : 974a279

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : la PR #11 a été fusionnée par squash (1baabe5) avant la clôture ; `main` a été fusionnée dans la branche pour clôturer. `git diff 974a279 HEAD` est vide : contenu identique à l'état revu, rien à relire. Revue réenregistrée pour que `reviewed_commit` soit un ancêtre de la branche de clôture.
