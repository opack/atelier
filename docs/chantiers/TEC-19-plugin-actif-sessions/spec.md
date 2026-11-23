---
id: TEC-19
type: TEC
title: Plugin atelier actif dans les sessions sur ce dépôt
status: done
tdd: no
created_at: 2026-11-22
signed_by: Opack
signed_at: 2026-11-23
reviewed_commit: f472003cfad21926867d63f5db9ec800a4f94c8d
slice: 1
done_at: 2026-11-23
---

# TEC-19 Plugin atelier actif dans les sessions sur ce dépôt

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->
Toute session Claude Code ouverte sur ce dépôt, locale ou cloud, a le plugin atelier actif (skills, agents, hooks et CLI `bin/atelier`), dans sa version de `main`, sans installation manuelle :
- en local, par la déclaration du plugin dans `.claude/settings.json` versionné (celle que `/atelier:init` écrit déjà dans les autres projets) ;
- dans le cloud, par le script d'installation de l'environnement cloud du projet, car une session cloud ignore les plugins déclarés par le dépôt.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->
- Le dépôt s'applique sa propre méthode (`CLAUDE.md`), mais aucune session ne charge le plugin : les chantiers récents (EPIC-14, EPIC-17, celui-ci) ont suivi les skills et la CLI à la main. Les hooks, eux, ne tournent pas du tout : pas de garde d'écriture, pas de tests figés, pas de rappel de l'étape suivante. Un humain ne peut pas rejouer un hook à la main.
- FIX-18 attend ce chantier pour être implémenté sous la garde des hooks.
- Le dépôt n'applique pas à lui-même ce que `/atelier:init` installe chez les autres (`.claude/settings.json`).
- Constat vérifié dans la doc officielle (code.claude.com, pages `cloud-environments` et `plugins/loading`) : « A cloud session doesn't install the plugins a repository turns on under `enabledPlugins`, including ones from the marketplaces it lists under `extraKnownMarketplaces` », parce que l'ajout d'une marketplace exige la confiance dans le dossier, qu'une session cloud ne demande jamais. Le `.claude/settings.json` seul ne suffit donc pas pour le cloud.
- Constat vérifié dans ce conteneur cloud : `claude plugin marketplace add opack/atelier` puis `claude plugin install atelier@atelier` s'exécutent sans interaction et installent le plugin au niveau utilisateur (`atelier@atelier`, 0.3.0, activé). C'est ce que fera le script d'installation de l'environnement.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->
- Inclus, dans le dépôt :
  - `.claude/settings.json` (nouveau) : exactement le bloc de `/atelier:init` :
    ```json
    {
      "extraKnownMarketplaces": {
        "atelier": { "source": { "source": "github", "repo": "opack/atelier" } }
      },
      "enabledPlugins": { "atelier@atelier": true }
    }
    ```
  - `site/projet/installation.md` : nouvelle section « Dans une session cloud » (le script d'installation de l'environnement, deux lignes, et pourquoi `.claude/settings.json` n'y suffit pas) ; la section « Tester une version en cours » ajoute `claude --plugin-dir <chemin>/plugins/atelier`, qui remplace sans prévenir le plugin installé du même nom pour la session.
  - `README.md` : la même mention cloud, en une ligne, dans la partie installation.
  - `plugins/atelier/skills/init/SKILL.md` : le compte rendu de `init` signale que la déclaration de `.claude/settings.json` ne vaut pas pour les sessions cloud et donne les deux lignes du script d'installation.
  - `CLAUDE.md` du dépôt : une ligne « Sessions » : le plugin actif est celui de `main` ; pour éprouver la version de la branche, `claude --plugin-dir ./plugins/atelier`.
- Inclus, hors dépôt (fait par Didier, ou proposé par Claude et approuvé par Didier) : l'environnement cloud du projet, avec pour script d'installation :
  ```bash
  claude plugin marketplace add opack/atelier
  claude plugin install atelier@atelier
  ```
- Hors périmètre :
  - `lib/` (EPIC-17 d'abord) et tout comportement des hooks ;
  - atelier sur n'importe quel dépôt (EPIC-14) ;
  - charger la version de la branche au lieu de celle de `main` (voir §4).

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->
- **Version chargée : celle de `main`, pas celle de la branche.** C'est voulu : l'arbitre ne doit pas être modifié par le joueur. Une branche qui casse un hook ne bloque pas sa propre session ; le plugin d'une branche s'éprouve explicitement avec `--plugin-dir`. Alternative écartée : une marketplace de type `directory` pointée sur la copie de travail, qui chargerait la branche en place.
- **Local** : à la première ouverture du dossier, Claude Code demande la confiance, puis clone la marketplace et active le plugin. Mise à jour vers un `main` plus récent : `claude plugin marketplace update atelier && claude plugin update atelier@atelier`.
- **Cloud** : chaque nouvelle session clone le dépôt `opack/atelier` (quelques secondes) au démarrage. Si GitHub est injoignable, le script échoue et la session le signale. Le plugin installé est le `main` du moment : toujours à jour, sans commande de mise à jour.
- **Hooks actifs sur ce dépôt dès la fusion** : la garde d'écriture bloque le code hors chantier signé, y compris pour les petites retouches. C'est la méthode ; le débrayage existe pour les urgences.
- **Double chargement** : avec `--plugin-dir ./plugins/atelier`, la version de la branche remplace sans prévenir le plugin installé (doc `plugins/loading`, « Name conflicts ») ; pas de double exécution des hooks.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->
- V-1 : `claude plugin validate .` et `claude plugin validate ./plugins/atelier` passent ; `.claude/settings.json` est un JSON valide ; `npm test` vert.
- V-2 : `npm run build` dans `site/` passe.
- V-3 (cloud) : une nouvelle session sur l'environnement doté du script : `/atelier:status` répond, et le hook de démarrage affiche le chantier actif et l'étape suivante.
- V-4 (local, par Didier) : après confiance dans le dossier, `/plugin` liste `atelier@atelier` activé et `/atelier:status` répond.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->
- Révoquer la PR (supprime `.claude/settings.json` et les ajouts de doc).
- Retirer les deux lignes du script d'installation de l'environnement cloud.
- En urgence dans une session : le débrayage atelier, ou `claude plugin disable atelier@atelier`.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
