# Revue : FIX-32 Les tests venus de main comptent comme tests modifiés depuis le gel

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->
## Revue 1 : 2026-11-25
- Commit revu : 48da8b4
- Base : 67ca088

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Deuxième lecteur de diff, fichiers supprimés et binaires lus autrement que pour le gel | plugins/atelier/lib/cli/tdd.mjs:58 | corrigé (04aefb2) : diff des candidats partagé avec le gel, supprimés et binaires lus dans les listes de git ; pas de test unitaire ajouté pour la fonction pure (couverte par les tests de bout en bout) |
| RD2. La page Référence ne reflète pas l'amendement (conflits) | site/reference/commandes.md:36 | corrigé (1cf1904) |

- Bilan de la revue : aucun bloquant ; deux points à discuter corrigés.
