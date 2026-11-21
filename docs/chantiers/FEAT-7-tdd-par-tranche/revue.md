# Revue : FEAT-7 Cycle tests, build, revue par tranche

<!-- Écrit par /atelier:review : un tour de revue par section, le plus récent en dernier.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Tour 1 : 2026-11-21
- Commit revu : 23a09b1
- Base : 4057c78

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1 : « tranche vide » inopérant en TDD (le commit des tests compte comme du code) et sans base (tout l'historique est lu) | `plugins/atelier/lib/cli.mjs:668-693` | Spec amendée (5f9d0a5, CA-20), test ajouté (15ced04), corrigé (473acf5) |
| D2 : `SPIKE` en TDD de l'ancien modèle soumis à la revue, la spec se contredisait | `plugins/atelier/lib/core.mjs:893-897` | Spec amendée (5f9d0a5, CA-25), test ajouté (15ced04), corrigé (473acf5) |
| D3 : lecture du diff dépendante de la configuration git (préfixes) | `plugins/atelier/lib/cli.mjs:563` | Corrigé (2b6a9be) |
| D4 : message trompeur en cas de deuxième réouverture en `slice: chantier` | `plugins/atelier/lib/core.mjs:725-733` | Corrigé (2b6a9be) |
| D5 : `closeProblems` masque les problèmes de revue derrière ceux de tranche | `plugins/atelier/lib/core.mjs:936-937` | Écarté : rien n'est faux, le problème ressort au `close-check` suivant ; pas de risque à prendre pour un aller-retour |

- Bilan du tour : aucun bloquant ; 4 points traités, 1 écarté.

## Tour 2 : 2026-11-21
- Commit revu : 473acf5
- Base : 4057c78

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1 : aucun test ne couvre la correction du message « tests déjà rouverts » (D4 du tour 1) | `plugins/atelier/lib/core.mjs:726` | Exception acceptée par l'utilisateur : texte de message seul, le refus est déjà testé, aucun critère ne vise ce cas ; un test coûterait un tour de plus |
| D2 : tours non consignés dans `revue.md` | `docs/chantiers/FEAT-7-tdd-par-tranche/revue.md` | Corrigé : ce fichier |

- Bilan du tour : aucun bloquant, revue validée.
