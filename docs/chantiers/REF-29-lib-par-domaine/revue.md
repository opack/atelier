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

## Revue : tranche 1 : 2026-11-24
- Commit revu : 4d97eae
- Base : f3ec902

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD2 (repris). `missingImports` laisse passer des imports manquants (expressions de gabarit collées, ternaire, homonymes par module) | `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs:219` | corrigé (f14508d) : expressions de gabarit et littéraux isolés par des espaces, clé d'objet reconnue seulement après `{` ou `,`, homonymes rattachés à leur déclaration et vérifiés liés dans sa signature ou une déstructuration, réexports exclus des noms en portée ; modules fabriqués (gabarit, ternaire) signalés ; un import retiré de `CHANTIER_TYPES` dans `core.mjs` est vu dans `checkSpec` et `nextChantierId` |
| RD5. `blankLiterals` peut boucler sans fin | `docs/chantiers/REF-29-lib-par-domaine/check-moves.mjs:187` | corrigé (f14508d) : boucles bornées, littéral ou commentaire non fermé signalé comme problème, regex reconnue après `=>`, opérateurs, `return`, `typeof` ; modules fabriqués « regex avec apostrophe » et « chaîne non fermée » signalés sans blocage |
| RD6. `measure-hook.mjs` laisse son dossier temporaire | `docs/chantiers/REF-29-lib-par-domaine/measure-hook.mjs:51` | corrigé (f14508d) : `process.exitCode` au lieu de `process.exit()`, le `finally` supprime le plugin extrait (vérifié : aucun dossier `ref29-plugin-*` restant) |

- Bilan de la revue : `check-moves.mjs --self-test` et `measure-hook.mjs` verts (écart +1,4 ms). `codeOnly` de `move.mjs` garde ses boucles non bornées : il ne sert qu'à écrire les imports, que `missingImports` contrôle désormais sans lui.

## Revue : tranche 2 : 2026-11-24
- Commit revu : c01a7f5
- Base : 91cedc6

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD7. Titres de section vides empilés dans `core.mjs` | `plugins/atelier/lib/core.mjs:79` | corrigé (d9f84dc) : `move.mjs` retire tout titre de section resté sans contenu, titres orphelins de `core.mjs` retirés ; réécriture de l'en-tête de `core.mjs` inscrite à la tranche 5 du plan |

- Bilan de la revue : `check-moves.mjs --self-test` vert (88 déclarations déplacées sur 201, 340 tests, suite verte à chaque commit), latence +3,3 ms, sorties de `status`, `next-id`, `check-process`, `review-ids`, `close-check`, `hook-session-start` et `check-spec` (5 specs réelles, une spec fabriquée à 5 erreurs de relations) identiques à la base.

## Revue : tranche 3 : 2026-11-24
- Commit revu : ca14109
- Base : d9f84dc

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD8. Commentaires déplacés qui renvoient à `lib/core.mjs` | `plugins/atelier/lib/cli/slices.mjs:17` | reporté (« Dette et suites » du bilan) : la spec interdit de retoucher le texte d'une déclaration ; recensement à faire au bilan pour le chantier qui supprimera la façade (decisions.md, 1ea3fce) |
| RD9. Graphe d'import du plan incomplet pour les domaines de la tranche | `docs/chantiers/REF-29-lib-par-domaine/plan.md` | corrigé (1ea3fce) : `docs` importe `common`, `cli/docs` n'importe que `cli/common`, `cli/tdd` vient après `cli/spec` et `cli/identifiers` |

- Bilan de la revue : `check-moves.mjs --self-test` vert à chaque commit (134 déclarations déplacées sur 201, 340 tests), latence +2,2 ms ; sorties de `status`, `check-process`, `template`, `tests-changed`, `check-spec` (26 fichiers) identiques à la base ; scénario de 28 étapes (`sign`, `set-tdd`, `freeze-tests`, `reopen-tests`) identique à la base dans deux dépôts jetables.

## Revue : tranche 4 : 2026-11-24
- Commit revu : 37af9c0
- Base : 1ea3fce

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD10. Graphe d'import du plan : `close` importe aussi `common` | `docs/chantiers/REF-29-lib-par-domaine/plan.md:86` | corrigé (2707371) |

- Bilan de la revue : `check-moves.mjs --self-test` vert à chaque commit (178 déclarations déplacées sur 201, 340 tests), latence +6,2 ms ; plus aucun module de domaine n'importe `core.mjs` ; sorties de `review-ids`, `close-check`, `checks`, `status`, `hook-session-start`, `hook-gate` identiques à la base, scénario de 20 commandes (`set-reviewed`, `set-status`, refus compris) identique dans un dépôt jetable.
- Incident pendant la revue : le reviewer a lancé `check-moves.mjs` avec `GIT_DIR` pointé sur ce dépôt ; les tests, qui créent des dépôts jetables, ont déplacé `HEAD`, `main` et la branche du chantier en local et créé 19 branches. Rien n'a été poussé, l'arbre de travail était intact. Réparé : refs remises à 37af9c0 et 94423a3, index reconstruit, branches parasites et cache `.atelier/gate*` supprimés, suite verte. `check-moves.mjs` lance désormais les tests sans `GIT_DIR` hérité (2707371).

## Revue : tranche 5 : 2026-11-24
- Commit revu : aba045c
- Base : d5d8584

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan de la revue : CA-1 et CA-2 tenus en entier (`cli.mjs` = `commands` + `main`, 46 lignes ; `core.mjs` = réexports seuls, 83 noms identiques à la base, même code) ; `check-moves.mjs --self-test` vert à chacun des 5 commits (199 déclarations déplacées sur 201, 340 tests) ; graphe sans cycle, plus aucun module n'importe `core.mjs` ; `move.mjs --relink` idempotent ; latence +6,5 ms ; scénario d'environ 50 étapes (`status`, `hook-session-start`, `hook-guard` autorisé et refusé, `hook-gate`, `bypass`) identique à la base dans un dépôt jetable.

## Revue : tranche 6 : 2026-11-24
- Commit revu : 
- Base : 0f6b9d6

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| RD11. Le test d'architecture casse sous Windows (chemins en `\`) | `plugins/atelier/test/architecture.test.mjs:123` | corrigé (348889b) |
| RD12. Un import sans `from` échappe aux règles d'import | `plugins/atelier/test/architecture.test.mjs:92` | corrigé (348889b) |
| RD13. `architecture.test.mjs` exempté de la règle des 400 lignes | `plugins/atelier/test/architecture.test.mjs:128` | corrigé (348889b) |
| RD14. Rien n'empêche un test ou un module de `lib/` d'importer de nouveau `core.mjs` | `plugins/atelier/test/architecture.test.mjs:130` | corrigé (348889b) |
| RD15. Messages de commit sans scope | commits 10ecc98, 975aaa1, 102dddf, 10b3005 | exception acceptée : historique déjà poussé, PR fusionnée en squash, scope repris aux commits suivants |

- Bilan de la revue : `check-moves.mjs --self-test` vert (199 déclarations déplacées sur 201, 349 tests = 340 de la base + 9 d'architecture) ; latence de `hook-guard` entre +2,7 et +8,9 ms selon les mesures (seuil 20 ms) ; amendement du 2026-11-24 (exception 3, renommage d'un test de `spec-ellipsis`).
