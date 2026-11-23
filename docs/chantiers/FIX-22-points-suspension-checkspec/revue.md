# Revue : FIX-22 Faux positifs de checkSpec sur « … »

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Revue 1 : 2026-11-23
- Commit revu : 2e09ead
- Base : f662c5b

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1. Une ligne `- ```` dans un bloc ouvert le ferme ; la §4 n'autorise une puce que devant l'ouverture | `plugins/atelier/lib/core.mjs:568` | Spec amendée (35dc898, CA-11), test ajouté (4ff0cdc), corrigé (7290fe9) : regex de clôture à part, indentation et `>` seulement |
| D2. Un `<!--` cité en code en ligne avale le texte jusqu'au `-->` suivant (comme avant le chantier) | `plugins/atelier/lib/core.mjs:617` | Spec amendée (35dc898) : limite ajoutée en §6 |
| D3. Ligne de commentaire de plus de 100 caractères | `plugins/atelier/lib/core.mjs:563` | Corrigé (7290fe9) |
| D4. Regex des commentaires HTML écrite deux fois | `plugins/atelier/lib/core.mjs:547, 617` | Écarté par Didier : deux usages aux remplacements différents, un utilitaire n'apporterait rien |
| D5. `hideCode` exportée sans import | `plugins/atelier/lib/core.mjs:565` | Écarté par Didier : `core.mjs` exporte ainsi ses fonctions pures |

- Bilan de la revue : aucun bloquant ; 221 tests verts ; ancien et nouveau `checkSpec` identiques sur toutes les specs du dépôt.

## Revue 2 : 2026-11-23
- Commit revu : 7290fe9
- Base : f662c5b

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|

### À discuter
| Point | Fichier | Traitement |
|---|---|---|

- Bilan de la revue : aucun point. Corrections de la revue 1 vérifiées (le test de D1 échoue sur 2e09ead et passe sur 7290fe9) ; 222 tests verts ; aucun test modifié, réouvertures limitées à des ajouts ; pas de ReDoS réaliste.
