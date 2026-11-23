# Revue : TEC-19 Plugin atelier actif dans les sessions sur ce dépôt

<!-- Écrit par /atelier:review : une section par revue (passage du reviewer), la plus récente en dernier.
Portée : « tranche N » (diff de la tranche), « chantier » (revue transversale après la dernière tranche), ou rien pour un chantier à tranche unique.
Points : RB1, RB2… (bloquants) et RD1, RD2… (à discuter), numérotés en continu sur tout le chantier ; prochains numéros par `atelier review-ids`. Cellule « Point » : `RB2. Intitulé` ; un point encore ouvert repris dans une revue suivante : `RB2 (repris). Intitulé` ; un point qui change de gravité : `RB4 (ex-RD3). Intitulé`. Aucun point : `Aucun`.
Traitement d'un point, la cellule commence par l'un de ces mots-clés : corrigé (commit), test ajouté, spec amendée, exception acceptée (par qui, pourquoi), écarté (pourquoi), reporté (chantier, « Dette et suites » du bilan, ou `reporté (tranche N)`), requalifié (`requalifié (RB4)`), sans objet. Une cellule vide ou sans mot-clé laisse le point ouvert : `atelier set-reviewed` et `atelier close-check` refusent alors. -->

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
| RD1. « ajoute au script d'installation de l'environnement cloud » se lit comme un ordre à l'agent de modifier l'environnement lui-même | `plugins/atelier/skills/init/SKILL.md` | corrigé (81d9d08) : l'agent l'indique à l'utilisateur et ne modifie pas l'environnement. |
| RD2. Montée de version 0.3.0 → 0.3.1 hors du §3 de la spec | `plugins/atelier/.claude-plugin/plugin.json` | écarté : la montée de version est conservée, car la skill `init` change, et Claude Code ne récupère une nouvelle version que si le numéro change (README, « Mise à jour »). Écart de procédure, pas de périmètre. |
| RD3. Réserve cloud absente de deux pages qui promettent le plugin via `.claude/settings.json` | `site/guide/demarrage-rapide.md`, `site/equipe/equipe.md` | corrigé (81d9d08) : réserve et lien vers Installation. Règle projet : le site suit le plugin dans la même PR. |

- Bilan de la revue : aucun point bloquant ; RD1 et RD3 corrigés, RD2 écarté (version 0.4.1 après fusion de main). Vérifié : `npm test` (180 tests, 0 échec), `claude plugin validate` (marketplace et plugin), build du site. V-3 (session cloud sur l'environnement « atelier ») et V-4 (local) restent à constater.
