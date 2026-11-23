<script setup>
import { useData } from 'vitepress'

const { theme } = useData()
</script>

# Installer atelier

## Sur votre machine

```bash
claude plugin marketplace add opack/atelier
```

```bash
claude plugin install atelier@atelier
```

## Sous Windows

atelier fonctionne dans PowerShell, cmd et Git Bash. Il faut **Node.js 20 ou plus récent** dans le `PATH` (`node --version` pour vérifier).

Le plugin fournit deux lanceurs pour sa commande `atelier` : `bin/atelier` (script Node, utilisé par Git Bash, Linux et macOS) et `bin/atelier.cmd` (utilisé par PowerShell et cmd). Avec une version d’atelier qui ne fournit pas encore `atelier.cmd`, PowerShell ouvre la fenêtre « Ouvrir avec… » au lieu d’exécuter la commande : mettez à jour le plugin (voir [Mettre à jour](#mettre-a-jour)).

Les arguments transmis par `atelier.cmd` passent par cmd, qui interprète certains caractères : voir [Garanties et limites](../reference/limites#les-arguments-sous-powershell-et-cmd).

## Dans une session cloud

Les sessions Claude Code cloud n’installent pas les plugins déclarés par le dépôt dans `.claude/settings.json` : cette déclaration passe par la confiance dans le dossier, qu’une session cloud ne demande jamais. Ajoutez les deux commandes au script d’installation de l’environnement cloud :

```bash
claude plugin marketplace add opack/atelier
claude plugin install atelier@atelier
```

Chaque session part d’un conteneur neuf et installe ainsi la dernière version de la branche par défaut d’atelier.

## Dans un projet

Dans une session Claude Code ouverte sur le répertoire du projet (les commandes `/atelier:*` ne se lancent pas dans un terminal) :

```text
/atelier:init
```

`init` fait l’état des lieux, puis, après votre accord :

1. **Configure les contrôles** dans `.claude/atelier.json` à partir de vos scripts (types, lint, tests). Il vérifie que la commande de tests teste vraiment quelque chose. Ensuite, ce fichier est le vôtre : l’agent peut le créer, pas le modifier.
2. **Crée** `docs/chantiers/` et `docs/decisions/`.
3. **Ajoute** `.atelier/` au `.gitignore` (fichier local du débrayage).
4. **Ajoute** une section « Process » au `CLAUDE.md`.
5. **Déclare le plugin** dans `.claude/settings.json` : toute personne qui ouvre le projet se voit proposer atelier (sauf en session cloud, voir plus haut).

Si le projet a déjà des identifiants de chantier dans son historique, le compteur les continue.

## Mettre à jour

Version actuelle d’atelier : **{{ theme.version }}**. Pour connaître la version installée chez vous, cherchez la ligne `Version:` d’atelier dans la sortie de :

```bash
claude plugin list
```

Si elle est plus ancienne :

```bash
claude plugin marketplace update atelier && claude plugin update atelier@atelier
```

Puis redémarrez Claude Code.

## Tester une version en cours

```bash
claude plugin marketplace add "opack/atelier#<branche>"
```

Ou, depuis une copie locale du dépôt atelier, pour une seule session :

```bash
claude --plugin-dir <chemin>/atelier/plugins/atelier
```

Cette version remplace, pour la session, le plugin installé du même nom.

## Retour arrière

**Pour désactiver atelier** dans un projet : supprimez `.claude/atelier.json`. Les hooks ne font alors plus rien.

**Pour le retirer complètement** :

1. supprimez `.claude/atelier.json` ;
2. retirez les entrées `extraKnownMarketplaces` et `enabledPlugins` d’atelier dans `.claude/settings.json` ;
3. retirez la section « Process (atelier) » du `CLAUDE.md` ;
4. retirez la ligne `.atelier/` du `.gitignore`, et supprimez le dossier `.atelier/` ;
5. désinstallez le plugin : `claude plugin uninstall atelier@atelier`.

`docs/chantiers/` et `docs/decisions/` restent : c’est l’historique du projet, de simples fichiers Markdown.
