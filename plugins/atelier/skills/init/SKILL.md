---
description: Installe atelier dans le projet courant (configuration, dossiers, section Process du CLAUDE.md). À lancer une fois par projet.
disable-model-invocation: true
---

# Installer atelier dans le projet

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Tu installes le process atelier dans le projet courant. Ne pose de questions que sur ce que tu ne peux pas déduire du dépôt.

## 1. État des lieux

- Lance `atelier status --json`. Si `installed` vaut `true`, dis-le et propose seulement de vérifier la configuration existante.
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

- Crée `docs/chantiers/` et `docs/decisions/` (avec un `.gitkeep`).
- Ajoute `.atelier/` au `.gitignore` (fichier local de débrayage).
- Ajoute cette section au `CLAUDE.md` du projet (crée le fichier s'il n'existe pas), sans toucher au reste :

```markdown
## Process (atelier)
- Toute modification passe par un chantier : `docs/chantiers/<ID>-<slug>/`, branche `<type>/<ID>-<slug>`.
- Pas de modification de code tant que `spec.md` n'a pas `status: signed`.
- Avant de déclarer une tâche terminée : contrôles de `.claude/atelier.json` verts.
- Commits : `<prefix>(<scope>): [<ID>] <description>` ; titre de PR : `[<ID>] <titre>`.
- Décision prise en cours de chantier : une entrée datée dans `decisions.md`.
```

## 4. Fin

- Si le projet a déjà des identifiants de chantier dans son historique (ex. `[FEA-26]`, `[BUG-421]`), lance `atelier next-id FEAT` et indique le prochain numéro : le compteur continue l'historique.
- Index Notion : pas encore pris en charge par atelier. Dis-le si l'utilisateur le demande.
- Propose de commiter : `chore(atelier): install atelier`.
- Indique la suite : `/atelier:new` pour ouvrir le premier chantier.
