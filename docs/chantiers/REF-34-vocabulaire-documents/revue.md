# Revue : REF-34 Regrouper le vocabulaire des documents lu par le code

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique. Les revues d'une même portée sont numérotées (`## Revue 1 : tranche 1 : …`, `## Revue 2 : tranche 1 : …`) ; une revue 2 ou suivante (relance) ajoute sous la base une ligne `- Corrections depuis la revue <n> : <commits>`.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

## Revue 1 : tranche 1 : 2026-11-26
- Commit revu : 8b4fa6a
- Base : 971c3a6

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD1. Commit de fusion 5ef9b80 sans `[REF-34]` | commit 5ef9b80 | exception acceptée (Didier, 2026-11-26 : réécrire l'historique poussé coûte plus que le bruit au contrôle de livraison ; prochaines fusions en `[REF-34] merge origin/main`) |
| RD2. « CA couverts », « TDD : oui/non » et « gel quitté » restés en dur | plugins/atelier/lib/slices.mjs:39, :44 ; plugins/atelier/lib/tdd.mjs:84 | corrigé (1fb64f9), spec amendée (bd093a2) |
| RD3. Test d'`escapeRegExp` rangé dans `vocabulary.test.mjs` | plugins/atelier/test/vocabulary.test.mjs:81 | corrigé (fd19c72 : limite documentée dans decisions.md) |

- Bilan de la revue : aucun bloquant ; comportement identique vérifié (sources des regex et messages au caractère près), 504 tests verts.

## Revue 2 : tranche 1 : 2026-11-26
- Commit revu : f94f0f2
- Base : 971c3a6
- Corrections depuis la revue 1 : bd093a2, 1fb64f9, fd19c72

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD4. « oui » / « non » en dur dans la CLI, absents du plan | plugins/atelier/lib/cli/next-step.mjs:88 ; plugins/atelier/lib/cli/slices.mjs:98 | corrigé (b1a2ab2, fichiers ajoutés au plan) |
| RD5. Citations « TDD : oui » / « TDD : non » en dur dans les messages | plugins/atelier/lib/slices.mjs:91, :93 ; plugins/atelier/lib/tdd.mjs:56 | corrigé (b1a2ab2) |
| RD6. Comparaison du « oui » et `\b` supposant un terme ASCII en minuscules | plugins/atelier/lib/slices.mjs:15, :53 | corrigé (b1a2ab2 : comparaison en minuscules ; limite du `\b` consignée dans decisions.md pour EPIC-14) |

- Bilan de la revue : correction de RD2 vérifiée à comportement identique (regex exécutées) ; trois suites de RD2, corrigées.
- Idée : les identifiants `CA-n`, `RB`, `RD` relèvent aussi de la grammaire ; laissés neutres et hors périmètre (decisions.md).
