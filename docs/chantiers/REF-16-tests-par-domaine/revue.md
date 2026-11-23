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
