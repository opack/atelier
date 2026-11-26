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

## Revue 3 : tranche 1 : 2026-11-26
- Commit revu : 7ab453d
- Base : 971c3a6
- Corrections depuis la revue 2 : b1a2ab2, 7ab453d

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD7. Import de `vocabulary.mjs` hors de l'ordre alphabétique | plugins/atelier/lib/cli/next-step.mjs:9 | corrigé (a6787dc, sans relance : déplacement d'une ligne, verdict du reviewer) |

- Bilan de la revue : b1a2ab2 vérifié à comportement identique ; plus aucune citation « TDD : oui\|non » en dur hors commentaires.

## Revue 1 : tranche 2 : 2026-11-26
- Commit revu : 8c4a126
- Base : 95739d9

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD8. Noms de colonnes « Point » et « Traitement » restés en dur dans deux messages | plugins/atelier/lib/review-points.mjs:228, :268 | corrigé (e8bded8) |
| RD9. Tableaux désignés par leur position dans `POINT_TABLES` | plugins/atelier/lib/review-points.mjs:220, :223, :234 | corrigé (e8bded8) |

- Bilan de la revue : comportement identique vérifié par exécution comparée ancien / nouveau module sur les 24 `revue.md` du dépôt et 6 documents fabriqués (14 messages déclenchés).

## Revue 2 : tranche 2 : 2026-11-26
- Commit revu : 9deb562
- Base : 95739d9
- Corrections depuis la revue 1 : e8bded8

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : e8bded8 vérifié à comportement identique (messages au caractère près, `expectedTable`).

## Revue 1 : tranche 3 : 2026-11-26
- Commit revu : c7d9208
- Base : a1402fc

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| RB1. Terme précédé d'un échappement (`\b`, `\s`, `\n`) dans une expression régulière non signalé | plugins/atelier/test/architecture-vocabulary.test.mjs:121, :137 | corrigé (d45af60) |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD10. Expression régulière dans le deuxième `${…}` d'un gabarit lue comme une division | plugins/atelier/test/architecture-vocabulary.test.mjs:37-40 | corrigé (d45af60, limite « après `}` ou `)` » complétée dans decisions.md) |
| RD11. `export * as ns from` échappe au contrôle d'import de `vocabulary.mjs` | plugins/atelier/test/architecture-vocabulary.test.mjs:146 | corrigé (d45af60) |
| RD12. Fichier de test qui exporte quatre fonctions et recopie `escapeRegExp` | plugins/atelier/test/architecture-vocabulary.test.mjs:21, :107, :118, :127, :144 | corrigé (d45af60) |
| RD13. Titre « ## terme » écrit en dur dans une chaîne non couvert par CA-2 | spec.md (CA-2) ; plugins/atelier/test/architecture-vocabulary.test.mjs:130-138 | corrigé (d45af60), spec amendée (59549ed) |

- Bilan de la revue : CA-1 tenu (`check-tests.mjs` non trompable sans le modifier, 498 tests à la base recomptés) ; faux négatifs du lecteur de code corrigés.
