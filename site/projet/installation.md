# Installer atelier

## Sur votre machine

```bash
claude plugin marketplace add opack/atelier
```

```bash
claude plugin install atelier@atelier
```

## Dans un projet

```text
/atelier:init
```

`init` fait l’état des lieux, puis, après votre accord :

1. **Configure les contrôles** dans `.claude/atelier.json` à partir de vos scripts (types, lint, tests). Il vérifie que la commande de tests teste vraiment quelque chose.
2. **Crée** `docs/chantiers/` et `docs/decisions/`.
3. **Ajoute** `.atelier/` au `.gitignore` (fichier local du débrayage).
4. **Ajoute** une section « Process » au `CLAUDE.md`.
5. **Déclare le plugin** dans `.claude/settings.json` : toute personne qui ouvre le projet se voit proposer atelier.

Si le projet a déjà des identifiants de chantier dans son historique, le compteur les continue.

## Mettre à jour

```bash
claude plugin marketplace update atelier && claude plugin update atelier@atelier
```

Puis redémarrez Claude Code.

## Tester une version en cours

```bash
claude plugin marketplace add "opack/atelier#<branche>"
```

## Désinstaller

Supprimez `.claude/atelier.json` du projet pour désactiver les hooks, ou désinstallez le plugin. Les documents de chantier restent : ce sont de simples fichiers Markdown.
