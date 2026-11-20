# Revue : TEC-6 Reconnaître un chantier hors branche <type>/<ID>-<slug>

<!-- Écrit par /atelier:review : un tour de revue par section, le plus récent en dernier.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Tour 1 : 2026-11-20
- Commit revu : a18d712
- Base : 4081cf2 (main avant TEC-5)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Le §3 du skill compte sur le commit du brouillon de TEC-5, non fusionné | `plugins/atelier/skills/new/SKILL.md` | Corrigé : TEC-5 fusionné dans main par l'utilisateur, puis intégré dans la branche (af0da4a, conflit de `SKILL.md` résolu à la main avec l'accord de l'utilisateur) |
| `git log` non borné à chaque appel de hook | `plugins/atelier/lib/core.mjs` (`branchCommitSubjects`) | Spec amendée (d0ca34d), corrigé : `-n 200` (e3436b8) |
| `gitOutput` duplique `currentBranch` | `plugins/atelier/lib/core.mjs` | Corrigé (e3436b8) |
| Commit 638d78a hors convention de sujet | historique | Écarté : sans effet fonctionnel, pas de réécriture d'historique |
| Coût git sous-estimé au §4 (point déjà connu) | `spec.md` §4 | Spec amendée (d0ca34d) |
| Tests manquants : `origin/HEAD`, `origin/HEAD` vers une autre branche, branche sans commit propre (point déjà connu) | `plugins/atelier/test/core.test.mjs` | Tests ajoutés : V-7 à V-9 (2e6ddb1), figés |

- Bilan du tour : aucun bloquant ; corrections et amendement faits avant le tour suivant.

## Tour 2 : 2026-11-20
- Commit revu : e3436b8
- Base : ab8398c (main contenant TEC-5)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Sur une branche imposée, `set-tdd` (§5) passe avant le commit du brouillon (§7) : refus sur un premier chantier, écriture dans la spec d'un ancien chantier déduit sinon | `plugins/atelier/skills/new/SKILL.md` §3, §5, §7 | Spec amendée (8e1249b) ; corrigé : commit et push du brouillon dès l'écriture de `spec.md`, étape 6 du §3 (8b98d51) |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Le rappel à l'utilisateur a disparu à la fusion | `plugins/atelier/skills/new/SKILL.md` §3 | Corrigé : l'étape 6 demande de le dire à l'utilisateur (8b98d51) |
| Aucun test ne passe par le hook d'écriture | `plugins/atelier/lib/cli.mjs` (`guardWrite`) | Spec amendée (8e1249b), test ajouté : V-10 (2dd24e6), figé |
| Vérifications manuelles du §5 non attestées sur l'état fusionné | `spec.md` §5 | Corrigé : `atelier status` sur `claude/...`, build du site et essai du parcours `/atelier:new` (commandes rejouées) refaits |

- Bilan du tour : un bloquant, traité par amendement, test et correction.

## Tour 3 : 2026-11-20
- Commit revu : 8b98d51
- Base : ab8398c

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| `/atelier:new` propose de rester sur la branche conforme d'un autre chantier : le nom de branche gagne, `set-tdd` écrit dans cet autre chantier | `plugins/atelier/skills/new/SKILL.md` §3 | Spec amendée (670d995) ; corrigé : « rester » seulement si `chantierSource` ≠ `"branch"` (1573f09) |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Identifiant présent par hasard dans un nom de branche imposé | `plugins/atelier/lib/core.mjs` (`activeChantier`) | Règle antérieure à TEC-6, couverte côté skill par le bloquant ; limite documentée dans `site/reference/limites.md` (1573f09) |
| Renvoi indirect « comme en §1 » pour les retouches | `plugins/atelier/skills/new/SKILL.md` §3 | Corrigé : « comme en §7 », avec la raison (conteneur éphémère) (1573f09) |
| Essai manuel antérieur à 8b98d51 | `spec.md` §5 | Corrigé : essai rejoué en exécutant à la main les commandes du skill (choix de l'utilisateur, plutôt qu'un vrai `/atelier:new` lancé par un agent), cas `claude/session` premier et deuxième chantier, création depuis `tec/TEC-1-x`, contre-épreuve |
| Parenthèse du §7 incomplète | `plugins/atelier/skills/new/SKILL.md` §7 | Corrigé (1573f09) |

- Bilan du tour : un bloquant, traité par amendement et correction.

## Tour 4 : 2026-11-20
- Commit revu : 1573f09
- Base : ab8398c

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

- Bilan du tour : correction du tour 3 vérifiée, skill `new` cohérent avec la spec amendée. 103 tests verts, aucun test modifié depuis le gel (2dd24e6). Revue terminée.
