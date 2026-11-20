# Revue : TEC-3 Amender la spec, rouvrir les tests, séparer revue et clôture

<!-- Écrit par /atelier:review : un tour de revue par section, le plus récent en dernier.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Tour 1 : 2026-11-20
- Commit revu : 89ff393
- Base : 307b77a (merge-base avec `origin/main` ; le `main` local était en retard)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| B1. Le premier gel des tests laisse `tests_commit` non commité dans la spec (la skill ne commitait qu'au regel), contraire à §4 « Commit des écritures de la CLI » | `plugins/atelier/skills/write-tests/SKILL.md:70` | Corrigé (395e1a7) : commit de la spec après chaque `freeze-tests` |
| B2. `set-tdd` en plein amendement suivi d'un commit qui enregistre l'amendement avant l'accord | `plugins/atelier/skills/amend/SKILL.md:22` | Corrigé (395e1a7) : plus de commit séparé. Correction remise en cause au tour 2 |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. `.claude/**` redevient libre si un motif `freePaths` large le couvre | `plugins/atelier/lib/core.mjs:395` | Corrigé (395e1a7) : `.claude/**` compte toujours comme code, test avec `**/*.json` |
| D2. `close-check` plante sur une erreur git | `plugins/atelier/lib/cli.mjs:476` | Corrigé (395e1a7) : erreur listée comme problème (`uncommittedError`), test ajouté |
| D3. `reopen-tests` accepte un chantier non signé | `plugins/atelier/lib/core.mjs:379` | Corrigé (395e1a7) : refusé hors `signed`, test ajouté, `site/reference/commandes.md` à jour |
| D4. Cas accepté « chemin de spec de casse différente de l'index » non testé | `plugins/atelier/test/core.test.mjs:289` | Test ajouté (395e1a7) |
| D5. Une erreur git bloque aussi l'édition d'une spec en brouillon | `plugins/atelier/lib/core.mjs:643` | Exception acceptée par l'utilisateur : fail-closed voulu (sans `HEAD` lisible, impossible de savoir si la spec y est en brouillon). Message précisé, consigné dans `decisions.md` (5d9813a) |
| D6. `formatStatus` (texte du rappel de début de session) non testé | `plugins/atelier/lib/cli.mjs` | Écarté : simple mise en forme, la logique (`reviewState`, `nextStep`) est testée |

- Bilan du tour : 2 bloquants corrigés, 4 points à discuter corrigés, 1 exception, 1 écarté.

## Tour 2 : 2026-11-20
- Commit revu : 5d9813a
- Base : 307b77a

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| La correction de B2 laisse l'entrée de `set-tdd` non commitée pendant l'amendement, contraire à la spec §4 (l. 52 et 73) : passe-droit pour une édition du corps | `plugins/atelier/skills/amend/SKILL.md:22` | Corrigé (ec2b926), option (b) choisie par l'utilisateur : la décision TDD est demandée à part à l'étape 0, `set-tdd` lancé sur la spec propre et commité aussitôt, avant toute édition. Option (a) (amender la spec pour autoriser l'entrée en attente) écartée : garantie affaiblie pour un commit de moins. Consigné dans `decisions.md` (b427a11) |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| README et site disent `set-tdd` « commité aussitôt », contredit par la correction de B2 | `README.md:93`, `site/cycle/tests.md:87` | Écarté : de nouveau exact avec l'option (b) |
| Refus de `reopen-tests` pour une spec non signée absent du site | `site/cycle/tests.md:84` | Corrigé (ec2b926) |
| Commit de la spec après le gel absent du site | `site/cycle/tests.md:57` | Corrigé (ec2b926) |
| `revue.md` absent | dossier du chantier | Corrigé : ce fichier, écrit avant `set-reviewed` |

- Bilan du tour : 1 bloquant corrigé, 3 points à discuter corrigés, 1 écarté.
- Hors revue, à la demande de l'utilisateur : « sort » remplacé par « traitement » pour les points de revue. Spec amendée (cb68af3), skill `review`, templates `revue` et `bilan`, README et site alignés (b2430fa).

## Tour 3 : 2026-11-20
- Commit revu : b2430fa
- Base : 307b77a

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Après un amendement qui ne porte que sur le TDD, l'étape 4 ne dit pas quoi faire ensuite | `plugins/atelier/skills/amend/SKILL.md:42` | Corrigé (f0ecc01) : `set-tdd yes` → `/atelier:write-tests`, `no` → `/atelier:build` ou `/atelier:review` |
| Le changement de TDD décidé et commité à part manque à la page Amender la spec | `site/cycle/amendement.md:13` | Corrigé (f0ecc01) : étape 0 ajoutée |

- Bilan du tour : aucun bloquant, 2 points à discuter corrigés.

## Tour 4 : 2026-11-20
- Commit revu : f0ecc01
- Base : 307b77a

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| L'étape 5 « Suite » ne cite pas explicitement `/atelier:write-tests` après un passage en TDD | `site/cycle/amendement.md:18` | Écarté avec l'accord de l'utilisateur : implicite, et l'étape 0 de la même page couvre le cas ; ne justifie pas un tour de plus |

- Bilan du tour : aucun bloquant, 1 point écarté. Revue terminée.
