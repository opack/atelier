# Revue : FIX-26 La prochaine étape ignore l'implémentation déjà commitée

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue : 2026-11-23
- Commit revu : 706675a (implémentation), 39551bd après correction de RD1 (journal seul)
- Base : aaa4488 (merge-base avec main)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. decisions.md : OD3 n'est plus à jour après la réouverture des tests | docs/chantiers/FIX-26-statut-implementation-commitee/decisions.md:7 | corrigé (39551bd) |
| RD2. Utilitaire `plain` défini deux fois dans le fichier de test | plugins/atelier/test/next-step.test.mjs:159 | écarté (duplication de deux lignes sans effet ; ne justifie pas de rouvrir des tests figés) |

- Bilan de la revue : aucun bloquant ; 328 tests verts, CA-1 à CA-11 couverts, aucun test modifié depuis le gel (0df1e7d).
