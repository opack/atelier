---
description: Installe atelier dans le projet courant (configuration, dossiers, section Process du CLAUDE.md). À lancer une fois par projet.
disable-model-invocation: true
---

# Installer atelier dans le projet

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Tu installes le process atelier dans le projet courant. Ne pose de questions que sur ce que tu ne peux pas déduire du dépôt.

## 1. État des lieux

- Lance `atelier status --json`. Si `installed` vaut `true`, dis-le, propose de vérifier la configuration existante, puis lance `atelier check-process` : s'il liste des lignes absentes de la section « Process (atelier) » du `CLAUDE.md` (nouvelle version du plugin), montre-les et propose de les ajouter à la section, sans réécrire ni retirer les lignes du projet. N'écris qu'après accord. Rien d'autre à faire sur un projet déjà installé.
- Lis `package.json` (ou l'équivalent du langage) pour trouver les commandes de **types**, **lint** et **tests**.
- **Vérifie que la commande de tests fait réellement quelque chose** : un script du type `echo … && exit 0` ou l'absence de tests ne compte pas. Si c'est le cas, signale-le clairement : sans vrais tests, les étapes « tests d'abord » et les contrôles automatiques ne protègent rien. Propose d'en faire le premier chantier (`TEC`).

## 2. Configuration

Propose le contenu de `.claude/atelier.json`, puis écris-le après accord :

```json
{
  "chantiersDir": "docs/chantiers",
  "decisionsDir": "docs/decisions",
  "checks": [
    { "name": "types", "command": "<commande>" },
    { "name": "lint", "command": "<commande>" },
    { "name": "tests", "command": "<commande>" }
  ],
  "checkTimeoutSeconds": 300
}
```

N'inclus que les contrôles qui existent et s'exécutent en moins de quelques minutes. Les clés `freePaths` (chemins modifiables sans chantier signé) et `sensitivePaths` (jamais modifiables) ont des valeurs par défaut ; ne les ajoute que si le projet en a besoin.

## 3. Dossiers et fichiers

- Déclare le plugin au niveau du projet dans `.claude/settings.json` (fusionne avec l'existant, ne remplace rien), pour que toute personne qui ouvre le projet se voie proposer atelier automatiquement :

```json
{
  "extraKnownMarketplaces": {
    "atelier": { "source": { "source": "github", "repo": "opack/atelier" } }
  },
  "enabledPlugins": { "atelier@atelier": true }
}
```

- Crée `docs/chantiers/` et `docs/decisions/` (avec un `.gitkeep`).
- Ajoute `.atelier/` au `.gitignore` (état local : débrayage, état du hook de fin).
- Ajoute au `CLAUDE.md` du projet (crée le fichier s'il n'existe pas), sans toucher au reste, la section « Process (atelier) » telle que la donne `atelier template process`, avec `docs/chantiers` remplacé par le `chantiersDir` du projet s'il diffère. Vérifie ensuite avec `atelier check-process` : rien ne doit manquer.

## 4. Fin

- Si le projet a déjà des identifiants de chantier dans son historique (ex. `[FEA-26]`, `[BUG-421]`), lance `atelier next-id FEAT` et indique le prochain numéro : le compteur continue l'historique.
- Index Notion : pas encore pris en charge par atelier. Dis-le si l'utilisateur le demande.
- Propose de commiter : `chore(atelier): install atelier`.
- Indique la suite : `/atelier:new` pour ouvrir le premier chantier.
