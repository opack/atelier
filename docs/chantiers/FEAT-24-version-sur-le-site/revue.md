# Revue : FEAT-24 Afficher la version d'atelier sur le site

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue : 2026-11-23
- Commit revu : 1c7f9e4
- Base : ae55ab5

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Garde-fou CI vide : la version brute est aussi dans le JSON de données du site | .github/workflows/site.yml:37 | corrigé (1c7f9e4) |
| RD2. Écart useData() / $theme non reporté en amendement | docs/chantiers/FEAT-24-version-sur-le-site/spec.md:34 | spec amendée |

- Bilan de la revue : aucun bloquant ; RD1 corrigé (le contrôle échoue désormais quand la nav ou l'interpolation disparaît, vérifié en local), RD2 traité par amendement.
