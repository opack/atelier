# Revue : TEC-19 Plugin atelier actif dans les sessions sur ce dépôt

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Traitement d'un point : corrigé (commit), test ajouté, spec amendée, exception acceptée par l'utilisateur (qui, pourquoi), ou écarté (pourquoi). -->

## Revue : 2026-11-23
- Commit revu : b7059e4
- Base : f662c5b

### Bloquant
| Point | Fichier | Traitement |
|---|---|---|
| Aucun | | |

### À discuter
| Point | Fichier | Traitement |
|---|---|---|
| D1 : « ajoute au script d'installation de l'environnement cloud » se lit comme un ordre à l'agent de modifier l'environnement lui-même | `plugins/atelier/skills/init/SKILL.md` | Corrigé (81d9d08) : l'agent l'indique à l'utilisateur et ne modifie pas l'environnement. |
| D2 : montée de version 0.3.0 → 0.3.1 hors du §3 de la spec | `plugins/atelier/.claude-plugin/plugin.json` | Conservé : la skill `init` change, et Claude Code ne récupère une nouvelle version que si le numéro change (README, « Mise à jour »). Écart de procédure, pas de périmètre. |
| D3 : réserve cloud absente de deux pages qui promettent le plugin via `.claude/settings.json` | `site/guide/demarrage-rapide.md`, `site/equipe/equipe.md` | Corrigé (81d9d08) : réserve et lien vers Installation. Règle projet : le site suit le plugin dans la même PR. |

- Bilan de la revue : aucun point bloquant ; D1 et D3 corrigés, D2 conservé. Vérifié : `npm test` (180 tests, 0 échec), `claude plugin validate` (marketplace et plugin), build du site. V-3 (session cloud sur l'environnement « atelier ») et V-4 (local) restent à constater.
