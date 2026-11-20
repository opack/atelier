# Revue : TEC-5 Commiter la spec en brouillon

<!-- Écrit par /atelier:review : un tour de revue par section, le plus récent en dernier.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Tour 1 : 2026-11-20
- Commit revu : 7cc633e
- Base : 4081cf2 (merge-base avec `origin/main`)

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| B1. Le push « vers la branche de suivi » peut publier le brouillon sur la branche par défaut (`git switch -c x origin/main` crée un suivi vers `origin/main`), ou créer une branche distante `origin/…` si la cible est lue dans `@{u}` | `plugins/atelier/skills/new/SKILL.md:35`, `:93` | Corrigé (998d8f6) : branche créée avec `--no-track` ; cible du push lue dans `branch.<b>.merge` sans `refs/heads/` ; suivi de la branche par défaut → `git push -u <remote> <branche>`, jamais de brouillon poussé sur la branche par défaut |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. En suivant `new` §3.3, le cas « branche imposée » n'est jamais atteint | `plugins/atelier/skills/new/SKILL.md:35` | Écarté par l'utilisateur : traité par TEC-6, qui modifie `new` §3 pour rester sur la branche courante ; l'anticiper ici ne ferait qu'ajouter un conflit de fusion |
| D2. `sign` : retouches commitées sans `git add`, push incomplet, consigne placée en §2 alors que le refus se constate en §3 | `plugins/atelier/skills/sign/SKILL.md:21` | Corrigé (998d8f6) : `git add` puis `git commit … --`, push selon `new` §7, phrase en fin de §3 |
| D3. V-3 peu discriminant : le brouillon commité a le même corps que la version de travail | `plugins/atelier/test/core.test.mjs:307` | Test ajouté (998d8f6) : brouillon commité au corps différent de la version signée ; le test échoue si la référence des amendements devient le brouillon commité |
| D4. `site/fondations/chantier.md` ignore le fetch et la réservation ; `intention.md` ne dit pas que le fetch n'a lieu que sans identifiant fourni | `site/fondations/chantier.md:12`, `site/cycle/intention.md:16` | Corrigé (998d8f6) |
| D5. Deux commits sans `[TEC-5]` : `657d448 [TEC-4] spec draft` (avant renumérotation) et `f51aaf8 Revert … (wrong signer)` | historique de la branche | Exception acceptée par l'utilisateur : pas de réécriture d'historique ; le commit `[TEC-4]` poussé réserve ce numéro, le revert trace la signature refaite au nom de l'utilisateur |
| D6. Version du plugin 0.2.1 hors de la liste « Inclus » | `plugins/atelier/.claude-plugin/plugin.json:3` | Écarté par l'utilisateur : incrément demandé par lui ; mentionné au bilan |

- Bilan du tour : 1 bloquant corrigé, 3 points à discuter corrigés, 1 exception, 2 écartés.

## Tour 2 : 2026-11-20
- Commit revu : 1d1d401
- Base : 4081cf2

Corrections du tour 1 vérifiées (B1, D2, D3, D4), commandes git rejouées sur un dépôt jetable : `--no-track` n'enregistre aucun suivi, `HEAD:<nom distant>` lu dans `branch.<b>.merge` met à jour la branche imposée sans créer de branche `origin/…`, une branche qui suit la branche par défaut tombe dans le cas `push -u`.

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| La spec signée décrit encore l'ancienne règle de push (`HEAD:<branche de suivi>` sans exception) et ignore le `--no-track` de `new` §3.3 et le déplacement de la consigne de `sign` | `docs/chantiers/TEC-5-commit-spec-draft/spec.md:35-42`, `:73-74` | Spec amendée avec l'accord de l'utilisateur (891520b) |

- Bilan du tour : aucun bloquant, 1 point à discuter traité par amendement.

## Tour 3 : 2026-11-20
- Commit revu : 891520b
- Base : 4081cf2

L'amendement concorde avec les skills `new` et `sign` et respecte les règles (entrée datée, en-tête inchangé) ; seul la spec a changé depuis 1d1d401.

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D7. `site/fondations/chantier.md`, modifié pour D4 (fetch avant le numéro, réservation par le commit du brouillon), n'est cité ni au §3 ni au §5 de la spec | `docs/chantiers/TEC-5-commit-spec-draft/spec.md:45`, `:75` | Exception acceptée par l'utilisateur : le fichier fait partie du traitement de D4 (tour 1), et `CLAUDE.md` impose de mettre le site à jour quand le comportement documenté change ; un nouvel amendement coûterait un tour de revue pour une ligne de documentation |

- Bilan du tour : aucun bloquant, 1 exception.
