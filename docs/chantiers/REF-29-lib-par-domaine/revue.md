# Revue : REF-29 lib/ rangé par domaine

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue : tranche 1 : 2026-11-24
- Commit revu : a4ba86c
- Base : f3ec902

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Titres de section hérités qui ne décrivent plus le contenu de `common.mjs` et `cli/common.mjs` | `plugins/atelier/lib/common.mjs:57`, `plugins/atelier/lib/cli/common.mjs:42` | corrigé (07a90a8) : sections renommées selon leur contenu ; `move.mjs --section` obligatoire (260e69b) |
| RD2. `check-moves.mjs` ne contrôle pas que les imports sont complets | `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs`, `move.mjs:173` | corrigé (260e69b) : `missingImports` dans `check-moves.mjs`, écrit sans le code de `move.mjs`, homonymes locaux listés et vérifiés, mutation « import retiré » détectée |
| RD3. La remesure de la base prévue en tranche 6 ne mesurerait pas le même chemin du hook | `docs/chantiers/REF-29-lib-par-domaine/measure-hook.mjs:9` | corrigé (260e69b) : base extraite par `git archive` et branche mesurées dans la même séance sur ce dépôt, même décision exigée, écart limité à 20 ms |
| RD4. Lecture des `import` / `export` non bornée, réexports tolérés hors de la façade | `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs:88` | corrigé (260e69b) : boucles bornées, réexport hors de `core.mjs` classé hors catégorie |

- Bilan de la revue : `check-moves.mjs --self-test` vert (201 déclarations, 38 déplacées, 340 tests, 3 mutations détectées) ; contre-vérification indépendante des imports et des sorties de `status`, `check-process`, `hook-session-start`, `template` contre la base.
