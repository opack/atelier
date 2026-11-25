# Bilan : TEC-19 Plugin atelier actif dans les sessions sur ce dépôt

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
Les sessions Claude Code sur ce dépôt ont désormais le plugin atelier (skills, agents, hooks, CLI), dans sa version de `main` : en local par `.claude/settings.json`, dans le cloud par le script d'installation de l'environnement « atelier ». La doc (site, README, `init`, `CLAUDE.md`) dit comment faire et pourquoi le cloud demande ce script. Constaté dans un fil neuf le 2026-11-23.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| V-1 : `claude plugin validate` (marketplace et plugin), JSON valide, `npm test` vert | Fait | Lancé avant la revue et après la fusion de `main` (267 tests, 0 échec) |
| V-2 : build du site | Fait | `npm run build` dans `site/` |
| V-3 : session cloud sur l'environnement « atelier » | Fait | Fil neuf du 2026-11-23 : `atelier@atelier` 0.4.0 installé (commit `3a86a98`, `main` du moment), skills et agents `atelier:*` présents, `/atelier:status` répond |
| V-4 : session locale après confiance dans le dossier | Non constaté | À vérifier par Didier à la prochaine session locale |

Écarts :
- l'environnement cloud n'a pas pu être ajouté à l'environnement du projet (l'environnement intégré n'accepte aucun réglage) : un environnement personnel « atelier » a été créé, puis sélectionné par Didier dans les réglages du projet ;
- pages du site touchées en plus de `installation.md` : `guide/demarrage-rapide.md` et `equipe/equipe.md` (RD3) ;
- montée de version (0.4.1 après la fusion de `main`), hors §3 (RD2).

## 3. Choix techniques
- Plugin chargé = `main`, pas la branche : l'arbitre ne doit pas être modifiable par le joueur. Version de la branche : `claude --plugin-dir ./plugins/atelier`, qui remplace le plugin installé pour la session.
- Cloud : installation au niveau utilisateur par le script d'environnement (`claude plugin marketplace add` puis `install`), seule voie documentée ; commandes rejouables sans erreur.

## 4. Éléments de code principaux
- `.claude/settings.json` : déclaration de la marketplace et activation du plugin (le bloc de `/atelier:init`).
- `site/projet/installation.md`, section « Dans une session cloud ».
- `plugins/atelier/skills/init/SKILL.md` : `init` signale la limite cloud et donne les deux lignes, sans modifier l'environnement lui-même.

## 5. Pistes écartées
- `.claude/settings.json` seul : ignoré par les sessions cloud (doc officielle, pages `cloud-environments` et `plugins/loading`).
- Marketplace de type `directory` pointée sur la copie de travail : chargerait la branche en place ; écartée pour la raison du §3.
- Hook `SessionStart` qui installerait le plugin : les plugins sont chargés avant les hooks, l'installation ne vaudrait que pour la session suivante.

## 6. Dette et suites
- V-4 (local) à constater.
- L'app desktop n'autocomplète pas les commandes `/atelier:*` d'un plugin installé dans le conteneur ; taper la commande complète fonctionne. Limite de l'app, rien à faire côté atelier ; à signaler dans le site si ça gêne.

## 7. Verdict de revue
<!-- Repris de revue.md : revues de tranche et du chantier, puis un point par identifiant (RB1, RD1…) avec son traitement final, exceptions acceptées comprises. -->
Une revue (chantier à tranche unique), commit revu b7059e4, aucun point bloquant ; revue validée par Didier le 2026-11-23 et enregistrée au commit f472003.

| Point | Traitement |
|---|---|
| RD1. `init` pouvait se lire comme un ordre de modifier l'environnement cloud | corrigé (81d9d08) |
| RD2. Montée de version hors périmètre | écarté : nécessaire pour que les installations récupèrent la nouvelle skill `init` |
| RD3. Réserve cloud absente de deux pages du site | corrigé (81d9d08) |

- Verdict : accepté
- Validé par : Didier (Opack)
- Date : 2026-11-23
