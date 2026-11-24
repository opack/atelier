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

## Les sous-agents d'atelier

Les étapes coûteuses et sans dialogue sont confiées à des sous-agents dont atelier règle le modèle et l'effort. Les étapes où vous dialoguez avec l'agent (`new`, `amend`, `plan`, `write-tests`…) gardent le modèle de votre session : pour `/atelier:plan`, l'alias `opusplan` (Opus en mode plan, Sonnet ensuite) applique le tableau sans réglage.

| Sous-agent | Lancé par | Modèle par défaut | Effort par défaut |
|---|---|---|---|
| `implementer` | `/atelier:build` | `sonnet` | `medium` |
| `overfit-checker` | `/atelier:build` | `opus` | `medium` |
| `reviewer` | `/atelier:review` | `opus` | `high` |
| `spec-critic` | `/atelier:sign` | `opus` | `high` |

Pour chaque sous-agent, le modèle et l'effort se résolvent séparément, du plus fort au plus faible :

1. **l'argument de la commande**, pour cet appel : `/atelier:build opus`, `/atelier:review medium`, `/atelier:build opus high` ;
2. **votre option**, réglée une fois pour tous vos projets avec `/plugin configure atelier` (`implementer_model`, `reviewer_effort`…) ;
3. **le défaut** du tableau.

Dans `/atelier:build`, l'argument ne règle qu'`implementer` : `overfit-checker` suit votre option ou le défaut.

Avant de lancer un sous-agent, la commande annonce ce qu'elle utilise et d'où vient chaque valeur, par exemple « implementer : sonnet / medium (défaut) ».

## Le mode « tout automatique »

Réservé à un environnement **jetable** : conteneur ou branche isolée, sans secret de production, sans accès qui permettrait de casser quelque chose d’important. Jamais sur votre machine avec des accès à la production.

Même en mode automatique, les hooks d’atelier continuent de s’appliquer : pas de code sans spec signée, tests figés en TDD, contrôles avant de terminer. Ce sont des garde-fous, pas une barrière : en mode automatique, l’agent peut aussi agir par le shell, ce qui n’est détecté qu’en fin de tour ([Garanties et limites](../reference/limites)).
