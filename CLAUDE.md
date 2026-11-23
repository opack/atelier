# atelier

Plugin Claude Code (et sa marketplace) qui outille un process de développement avec l'IA : chantiers identifiés, spec signée avant le code, tests d'abord, revue indépendante, bilan versionné. La méthode est décrite dans `README.md`.

## Structure
- `.claude-plugin/marketplace.json` : la marketplace (un seul plugin).
- `site/` : le site VitePress de la méthode (`npm run dev` / `npm run build` dans `site/`). La page Référence > Templates inclut les fichiers de `plugins/atelier/templates/` au build : à mettre à jour si un template est ajouté ou renommé. La version affichée (nav, page d'installation) est lue au build dans `plugins/atelier/.claude-plugin/plugin.json` : ne jamais la recopier à la main.
- `plugins/atelier/` : le plugin. `skills/` (commandes `/atelier:*`, dont le cycle TDD `tests` puis `build`), `agents/`, `hooks/hooks.json`, `templates/`, `bin/atelier` (CLI utilisée par les skills et les hooks), `lib/core.mjs` (logique pure, testée), `lib/cli.mjs` (entrées / sorties).
- `plugins/atelier/test/` : un fichier `<domaine>.test.mjs` par domaine (`write-guard`, `review`, `close`, etc.), scindé en `<domaine>-<sous-domaine>.test.mjs` au-delà de 400 lignes ; `helpers.mjs` ne reçoit que les utilitaires partagés par plusieurs fichiers ; un test lié à un critère porte l'étiquette `[<ID> CA-x]` en suffixe de son nom.

## Commandes
- Tests : `npm test` (node:test, aucune dépendance).
- Validation du plugin : `claude plugin validate .` et `claude plugin validate ./plugins/atelier`.
- Essai local : `claude --plugin-dir ./plugins/atelier` dans un autre projet ; `/reload-plugins` après modification.
- Sessions sur ce dépôt : le plugin actif est celui de `main` (`.claude/settings.json` en local, script d'installation de l'environnement en cloud), pas celui de la branche. Pour éprouver la version de la branche : `claude --plugin-dir ./plugins/atelier`.

## Conventions
- Node ≥ 20, ESM, **aucune dépendance** : le plugin doit fonctionner partout sans `npm install`.
- Logique dans `lib/core.mjs` sous forme de fonctions pures testées ; `lib/cli.mjs` ne fait que lire, écrire et afficher.
- Textes destinés à l'utilisateur en français ; code et commentaires en anglais.
- Les skills ne posent de questions que sur ce qui manque dans les documents.
- Toute évolution du comportement d'un hook : test dans `plugins/atelier/test/`.

## Process (atelier)
- Ce dépôt s'applique sa propre méthode : chantiers dans `docs/chantiers/`, branche `<type>/<ID>-<slug>`, commits `<prefix>(<scope>): [<ID>] <description>`.
