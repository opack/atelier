# Plan : FEAT-27 Modèle et effort réglés par étape

## Approche
- La résolution (argument, puis option utilisateur, puis défaut) est une fonction pure dans un nouveau module `lib/agent-settings.mjs`, déjà rangé comme le veut l'EPIC-17. Elle n'est pas réexportée par `core.mjs` : les tests l'importent directement.
- La commande `atelier agent-settings` n'est branchée qu'après REF-29, dans `lib/cli/agent-settings.mjs`, car REF-29 interdit de toucher `core.mjs` et `cli.mjs` pendant qu'il tourne.
- Les options `userConfig` du manifeste portent une liste `options` (acceptée par `claude plugin validate`). `/plugin configure` propose ainsi un choix fermé. Le code garde son filet (CA-6), parce qu'une valeur peut aussi venir de `settings.json` édité à la main.
- Les skills `sign`, `review` et `build` appellent la commande, puis passent `model` et `effort` au sous-agent. `build` fait passer tout le code par `implementer`.

## Fichiers et couches touchés
- `plugins/atelier/lib/agent-settings.mjs` : nouveau, logique pure (défauts, valeurs acceptées, résolution).
- `plugins/atelier/lib/cli/agent-settings.mjs` et la table des commandes de `lib/cli.mjs` : après REF-29, la commande et son code de sortie.
- `plugins/atelier/test/agent-settings.test.mjs` : nouveau ; scindé en `agent-settings-<sous-domaine>.test.mjs` au-delà de 400 lignes.
- `plugins/atelier/.claude-plugin/plugin.json` : `userConfig` (8 options) et version 0.5.0.
- `plugins/atelier/agents/implementer.md` : nouveau. `spec-critic.md`, `overfit-checker.md`, `reviewer.md` : `effort` dans l'en-tête.
- `plugins/atelier/skills/sign`, `review`, `build` : corps et `argument-hint`.
- `site/agent/modes.md`, `site/reference/commandes.md`, `configuration.md`, `limites.md`.
- `CLAUDE.md` : description de `lib/` (tranche 5, RD1).

## Tranches
1. Résolution pure dans `lib/agent-settings.mjs` : défauts, liste fermée, ordre de résolution, restes, avertissements, refus de deux valeurs différentes (au niveau de la fonction) — CA couverts : CA-1, CA-2, CA-3, CA-4, CA-5, CA-6, CA-7, CA-8, CA-9
2. Défauts concordants et agent `implementer` : options du manifeste, en-têtes des quatre agents, contrat d'`implementer`, tableau des défauts de `modes.md` — CA couverts : CA-10, CA-13
3. Commande `atelier agent-settings` (après la fusion de REF-29) : JSON de sortie, code non nul et message en cas de refus, restes de bout en bout — CA couverts : CA-5, CA-7
4. Skills `sign`, `review` et `build` (après la fusion de REF-29 et de TEC-15) : appel de la commande entre guillemets simples, annonce, arrêt en cas d'échec, tout le code de `build` par `implementer`, `atelier checks` après chaque retour ; test du refus d'une option répétée de la commande (RD3) — CA couverts : CA-11, CA-12
5. Documentation et version : `commandes.md`, `configuration.md`, `limites.md`, `argument-hint`, `CLAUDE.md` (modules de domaine de `lib/`, sauf si REF-29 l'a fait ; RD1), apostrophes typographiques de `modes.md` (RD2), version 0.5.0 — CA couverts : CA-14

## Risques et points d'attention
- REF-29 doit être fusionné avant la tranche 3, et TEC-15 avant la tranche 4 (`review/SKILL.md`, `reviewer.md`). Si ce n'est pas le cas quand on y arrive, on s'arrête et on le signale, sans contourner.
- Les 8 options sont peut-être toutes demandées à l'activation du plugin, ce qui n'est pas vérifiable en mode non interactif. Elles sont facultatives et préremplies. Didier vérifie lors de la mise à jour locale, sans CA.
- Comportement de Claude Code (substitution de `${user_config}`, `model` et `effort` à l'appel, hooks sur un sous-agent) : vérifié le 23/11/2026 sur la version 2.1.331. Une version future peut changer. Les essais sont décrits dans `decisions.md` pour être rejoués.
- `build` délégué à `implementer` : c'est la zone sensible de la tranche 4, à relire ligne à ligne (garde-fous, boucle de relance, arrêt sur un test faux).
