# Hooks et configuration

## Les hooks

Ils ne font rien dans un projet sans `.claude/atelier.json`.

### Avant chaque écriture (`PreToolUse`)

Refuse :

- toute modification de code sans chantier actif signé ;
- en TDD, pendant l’écriture des tests : toute écriture hors des fichiers de test ;
- en TDD, pendant l’implémentation : toute modification des tests figés ;
- l’écrasement complet d’une spec signée (les amendements ciblés restent possibles) ;
- les fichiers sensibles (`.env`, clés), même pendant un débrayage.

Les chemins de `freePaths` (documentation, configuration de Claude) restent toujours modifiables.

### Avant de terminer (`Stop`)

- En TDD, pendant l’implémentation : refuse tout test modifié depuis son gel, même par une commande shell ou un commit.
- Si du code a changé : lance les contrôles ; s’ils échouent, l’agent continue.
- Pendant l’écriture des tests : ne lance rien, des tests rouges sont attendus.

### Au démarrage (`SessionStart`)

Rappelle le chantier actif, son statut et la prochaine étape.

## `.claude/atelier.json`

```json
{
  "chantiersDir": "docs/chantiers",
  "decisionsDir": "docs/decisions",
  "checks": [
    { "name": "types", "command": "npm run typecheck" },
    { "name": "lint", "command": "npm run lint" },
    { "name": "tests", "command": "npm test" }
  ],
  "checkTimeoutSeconds": 300
}
```

| Clé | Défaut | Rôle |
|---|---|---|
| `chantiersDir` | `docs/chantiers` | Dossier des chantiers. |
| `decisionsDir` | `docs/decisions` | Dossier des ADR. |
| `checks` | `[]` | Contrôles lancés avant de terminer, dans l’ordre. |
| `checkTimeoutSeconds` | `300` | Durée maximale d’un contrôle. |
| `freePaths` | `docs/**`, `.claude/**`, `CLAUDE.md`, `README.md`… | Modifiables sans chantier signé. |
| `sensitivePaths` | `.env`, `.env.*`, `*.pem`, `*.key`, `**/secrets/**` | Jamais modifiables par l’agent. |
| `testPaths` | `*.test.*`, `*.spec.*`, `tests/**`, `__tests__`… | Ce qui compte comme test pour le TDD. |

## En-tête de `spec.md`

| Champ | Valeurs | Posé par |
|---|---|---|
| `id`, `type`, `title` | — | `/atelier:new` |
| `status` | `draft`, `signed`, `done`, `abandoned` | `sign`, `close` |
| `tdd` | `yes`, `no` | Vous, obligatoire avant signature |
| `signed_by`, `signed_at` | — | `atelier sign` |
| `tests_commit` | hash git | `atelier freeze-tests` |
