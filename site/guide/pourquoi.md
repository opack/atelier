# Pourquoi atelier ?

Un agent de code comme Claude Code écrit en quelques minutes ce qui prenait des heures. Le goulot d’étranglement n’est plus l’écriture du code : c’est **savoir si ce code est le bon**.

L’IA amplifie la qualité du cadrage, bonne ou mauvaise. Une demande floue produit vite beaucoup de code plausible et faux. Une demande claire, vérifiable et relue produit vite du code juste.

## Le problème

Sans méthode, on observe vite les mêmes travers :

- **Le code arrive avant l’intention.** On découvre ce qu’on voulait en relisant ce que l’agent a fait.
- **Les tests valident les bugs.** Écrits après le code, par le même agent, ils épousent l’implémentation, erreurs comprises.
- **La revue arrive trop tard**, sur un gros diff, quand la fatigue est maximale.
- **Le contexte se perd.** Pourquoi ce choix ? Quelle piste a été écartée ? Tout était dans une conversation qui n’existe plus.
- **On croit l’agent sur parole** : « tous les tests passent » n’est pas une preuve.

## La réponse d’atelier

atelier part d’un principe simple : **aucun agent n’est fiable par défaut**. On contraint ce qu’il peut faire, on vérifie ce qu’il produit, et les décisions qui engagent restent humaines.

Concrètement :

1. Toute modification est un **chantier** identifié (`FEAT-412`, `FIX-431`…).
2. Le chantier commence par une **spec** que vous **signez**. Avant, le code est bloqué.
3. Quand c’est pertinent, les **tests sont écrits d’abord**, commités, puis figés pendant l’implémentation.
4. L’agent avance par **petites tranches**, avec des contrôles automatiques qu’il ne peut pas ignorer.
5. Un **agent relecteur indépendant** passe le travail en revue, puis **vous** rendez le verdict.
6. Un **bilan** garde les choix faits et les pistes écartées, versionné avec le code.

## Méthode d’abord, outil ensuite

atelier est d’abord une **méthode** : tout ce site peut s’appliquer à la main, avec n’importe quel agent, voire sans agent. Le **plugin Claude Code** du même nom la rend pratique : il crée les documents, pose les questions qui manquent, et ses hooks font respecter les règles plutôt que de compter sur la discipline.

::: tip Inspirations
La gouvernance est inspirée de [Solario](https://solario.io/fr) (« usine logicielle IA gouvernée »), ramenée à l’échelle d’un développeur ou d’une petite équipe : des fichiers Markdown et git, pas une plateforme. Le cycle TDD reprend le workflow « write tests, commit; code, iterate, commit » des [bonnes pratiques Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices).
:::

::: warning Garde-fou, pas barrière
Les hooks empêchent d’oublier une étape, pas de la contourner délibérément : une écriture par le shell n’est détectée qu’en fin de tour, et rien n’est annulé. Voir [Garanties et limites](../reference/limites).
:::

## À qui s’adresse atelier ?

- Au **développeur seul** qui veut garder la maîtrise de ce que l’agent produit.
- À la **petite équipe** (quelques développeurs) qui veut un standard commun sans usine à gaz.
- À qui doit **rendre des comptes** : client, auditeur, futur soi-même.

Ce n’est pas fait pour une plateforme industrielle à des dizaines d’agents en parallèle : pour ça, il existe des outils dédiés.
