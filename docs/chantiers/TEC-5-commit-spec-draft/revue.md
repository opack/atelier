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
