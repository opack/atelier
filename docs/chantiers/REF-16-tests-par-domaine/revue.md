# Revue : REF-16 Tests rangés par domaine

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Revue : tranche 1 : 2026-11-23
- Commit revu : cd8c46a
- Base : ae55ab5

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| B1. Le contrôle de lignes refuse la ligne d'ouverture ajoutée par la scission d'un `describe` | `check-moves.mjs:120-123`, `:141-144` | corrigé (65812e3) : l'écart d'ouvertures doit égaler l'écart de `describe` ; spec amendée (6a390b0) |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. L'échange des titres de deux `it` passe le contrôle | `check-moves.mjs:104-106`, `:89-99` | corrigé (65812e3) : titres comparés sans étiquette et lignes du corps préfixées par le titre de leur test (la correction proposée, titres seuls, laissait passer l'échange) ; spec amendée (6a390b0) |
| D2. Worktree laissé en place après Ctrl-C | `check-moves.mjs:155-202` | corrigé (65812e3) : suppression au démarrage des worktrees `ref16-base-*` |
| D3. Exports morts `templatesDirectory`, `gitIdentity`, `temporaryDirectories` | `plugins/atelier/test/helpers.mjs:238-240` | corrigé (65812e3) |
| D4. Double ligne vide | `plugins/atelier/test/helpers.mjs:195-196` | corrigé (65812e3) |
| D5. Commentaires de section par chantier comptés comme lignes | `check-moves.mjs` | spec amendée (6a390b0) : tolérés au §4, ignorés par le script (65812e3) |

- Bilan de la revue : 1 bloquant, 5 à discuter, tous traités. Sabotages : assertion affaiblie, test supprimé, renommage hors règle → échec ; renommage selon la règle → OK ; échange de titres → OK à tort (D1).

## Revue : tranche 1 : 2026-11-23
- Commit revu : 65812e3
- Base : ae55ab5

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. Entrée « les lignes de titre sont normalisées » périmée, préfixage des corps non consigné | `decisions.md:33-36` | corrigé (7c65a01) |
| D2. Lignes hors corps d'`it` (utilitaires, fonctions de `describe`) rattachées à rien : un échange entre utilitaires passerait | `check-moves.mjs:127-162` | exception acceptée par l'utilisateur : utilitaires déplacés à l'identique en tranche 1, les tranches suivantes déplacent des blocs entiers ; limite consignée dans `decisions.md` (7c65a01) |
| D3. Le nettoyage au démarrage supprime le worktree d'une exécution parallèle | `check-moves.mjs:186-193` | corrigé (7c65a01) : avertissement dans l'en-tête du script |
| D4. CA-27 sans destination dans la table du plan | `plan.md` | écarté : CA-27 est dans `FEAT-7 vocabulary of the review` (base, ligne 2047), rangé dans `docs` par le plan |

- Bilan de la revue : aucun bloquant, 4 à discuter traités. Rejoués : scission légitime → OK ; assertion déplacée d'un test à l'autre → échec.

## Revue : tranche 1 : 2026-11-23
- Commit revu : 7c65a01
- Base : ae55ab5

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|

- Bilan de la revue : aucun point ; traitements de la revue précédente vérifiés fidèles, écartement de D4 fondé.

## Revue : tranche 2 : 2026-11-23
- Commit revu : 491febe
- Base : 7c65a01 (travail propre à la tranche : 6585ba5..491febe, après la fusion de `main` 8c1a799)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. Un test déplacé sans renommage passe tant que son fichier de base existe | `check-moves.mjs:111-121` | corrigé (de24fdb) : un nom ancien n'est accepté que dans le fichier d'origine du test ; sabotage rejoué (CA-8 déplacé sous son ancien nom dans `identifiers.test.mjs`) → échec |
| D2. Commit de fusion 6585ba5 sans `[REF-16]`, suite rouge jusqu'à aa47b2f | commit 6585ba5 | corrigé (de24fdb) : consigné dans `decisions.md`, pas de réécriture d'historique ; procédure pour les fusions suivantes |
| D3. Domaine `checks` ajouté au §3 sans trace dans l'entrée d'amendement | `spec.md:56` | spec amendée (e0b4ea6) : nouvelle entrée datée |

- Bilan de la revue : aucun bloquant, 3 à discuter traités. `check-moves.mjs` relancé par le relecteur : OK (314 tests, 71 renommés). Fusion vérifiée sans perte dans `test/`.

## Revue : tranche 2 : 2026-11-23
- Commit revu : 1941567
- Base : 7c65a01 (travail propre à la tranche : 6585ba5..1941567)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. Le §4 tolère encore un nom ancien tant que le fichier de base existe, plus souple que le contrôle corrigé | `spec.md:87`, `decisions.md:53` | spec amendée (57c8647) : plus aucun nom ancien accepté ; tous les tests restés dans `core.test.mjs` renommés sur place (edac463) ; contrôle simplifié, plan et décisions (d6f911c) ; sabotage rejoué (test remis sous son ancien nom) → échec |

- Bilan de la revue : aucun bloquant, 1 à discuter traité. Traitements de la revue 1 jugés fidèles ; `check-moves.mjs` relancé par le relecteur : OK.

## Revue : tranche 2 : 2026-11-23
- Commit revu : 0eb8e92
- Base : 7c65a01 (travail propre à la tranche : 6585ba5..0eb8e92)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. §5 resté à l'ordre d'avant l'amendement : l'étape 3 étiquette encore des tests, l'étape 2 semble précéder les déplacements de la tranche 2 | `spec.md:96` | spec amendée (28c5448) |
| D2. Commentaire périmé « once moved » | `check-moves.mjs:31` | corrigé (297e06e) |

- Bilan de la revue : aucun bloquant, 2 à discuter traités. CA-3 vérifié sur toute la suite (TAP relancé : 314 tests, 237 étiquetés, 77 sans étiquette inchangés) ; renommages de edac463 conformes au §3.

## Revue : tranche 2 : 2026-11-23
- Commit revu : 3bed81d
- Base : 7c65a01 (travail propre à la tranche : 6585ba5..3bed81d)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. Titre de l'entrée « tous les tests renommés sur place avant les déplacements » et « leurs tests étant déjà étiquetés » au §5 encore ambigus | `decisions.md:68`, `spec.md:96` | écarté : la règle et le contrôle n'en dépendent pas, la conséquence de l'entrée précise déjà « restés dans `core.test.mjs` », et un test sans critère n'a pas d'étiquette à recevoir ; un amendement et une revue de plus pour deux mots n'apportent rien (décision de l'utilisateur) |

- Bilan de la revue : aucun bloquant, 1 à discuter écarté. Traitements de la revue 3 fidèles ; `npm test` (314 verts) et `check-moves.mjs` (OK) relancés par le relecteur.

## Revue : tranche 3 : 2026-11-23
- Commit revu : 7ce8c19
- Base : 7bcff52

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. Un sous-ensemble de tests part sans les fonctions locales à son `describe` (`reviewedChantier` de `FEAT-7 close and next step`, tranche 4) | `move-tests.mjs:164-177` | reporté à la tranche 4 : le script y est retouché avant usage ; vérifier que `next-step.test.mjs` ne contient pas `reviewedChantier` |
| D2. `helpers` ne déplace que des `function name(`, pas les `const` de niveau fichier (`pointProblems`, `citing`, `revueWithBody`, `pointTable`) | `move-tests.mjs:132-154` | reporté à la tranche 4 |
| D3. Sans `describe` restant, `core.test.mjs` est réécrit incohérent | `move-tests.mjs:246` | reporté à la tranche 4 |
| D4. Constante `NODE` morte ; titre d'un sous-ensemble non échappé | `move-tests.mjs:204-206`, `:179` | reporté à la tranche 4 |

- Bilan de la revue : aucun bloquant, 4 à discuter reportés à la tranche 4 (ils portent sur l'outil de la tranche 4, pas sur le résultat de la tranche 3 ; décision de l'utilisateur). `check-moves.mjs` relancé par le relecteur : OK (314 tests, 232 renommés, écart de describe 3) ; chacun des 5 fichiers passe seul.
