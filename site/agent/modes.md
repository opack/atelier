# Modes, modèles et effort

Tous les moments d’un chantier ne demandent pas le même agent.

## Le tableau de choix

| Situation | Mode | Modèle | Effort |
|---|---|---|---|
| Conception, architecture, bug obscur | Plan (lecture seule) | Opus | Élevé |
| Implémentation d’une tranche conçue | Édition avec validation | Sonnet | Moyen |
| Tâche mécanique (renommage, traductions, formatage) | Auto-accept des éditions | Haiku ou Sonnet | Bas |
| Relecture critique, revue, audit de sécurité | Lecture seule (sous-agent) | Opus | Élevé |
| Zone critique (paiement, règles de sécurité) | Plan, puis édition pas à pas, jamais en auto | Opus | Élevé |

## La règle

**Plus une erreur coûte cher, plus on monte en modèle et en effort, et plus on valide à la main.**

## Le mode « tout automatique »

Réservé à un environnement **jetable** : conteneur ou branche isolée, sans secret de production, sans accès qui permettrait de casser quelque chose d’important. Jamais sur votre machine avec des accès à la production.

Même en mode automatique, les hooks d’atelier continuent de s’appliquer : pas de code sans spec signée, tests figés en TDD, contrôles avant de terminer. Ce sont des garde-fous, pas une barrière : en mode automatique, l’agent peut aussi agir par le shell, ce qui n’est détecté qu’en fin de tour ([Garanties et limites](../reference/limites)).
