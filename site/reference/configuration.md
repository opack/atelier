# Hooks et configuration

Les hooks ne font rien dans un projet sans `.claude/atelier.json`.

::: warning Un garde-fou, pas une barrière
Les hooks empêchent d’**oublier** la méthode, pas de la **contourner** délibérément. Les écritures par le shell ne sont détectées qu’en fin de tour, et rien n’est annulé. Voir [Garanties et limites](./limites).
:::

## Garde d’écriture

Elle s’applique **avant chaque écriture par les outils d’édition** de Claude Code (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`). Les règles sont évaluées **dans cet ordre**, et la première qui s’applique décide :

| # | Règle | Décision |
|---|---|---|
| 1 | **Fichier hors du projet** (sous Windows, y compris sur un autre lecteur) | Autorisé : atelier ne régit que le projet |
| 2 | **Fichier sensible** (`sensitivePaths`) | Toujours refusé, même en débrayage |
| 3 | **État d’atelier** : `.atelier/**` | Refusé |
|   | `.claude/atelier.json` | Création autorisée (c’est ce que fait `/atelier:init`), modification et suppression refusées : la configuration est modifiée par l’humain |
| 4 | **En-tête de spec** : `status`, `signed_by`, `signed_at`, `done_at`, `tests_commit` | Ne changent que par la commande `atelier` |
|   | `tdd` | Libre en brouillon ; ensuite, seulement par `atelier set-tdd`, tracé en amendement |
|   | Réécriture complète d’une spec signée | Refusée ; les éditions ciblées restent possibles, avec une entrée datée dans « Amendements » |
|   | Édition de spec impossible à vérifier | Refusée |
| 5 | **Chemins libres** (`freePaths`) | Autorisés |
| 6 | **Débrayage actif** sur la branche | Autorisé |
| 7 | **Sans chantier signé** : branche sans chantier (`main`, HEAD détachée), spec en brouillon, chantier clos (`done` ou `abandoned`) | Refusé. Un chantier clos rebloque le code : il faut en ouvrir un nouveau |
| 8 | **TDD** (si `tdd: yes`) | Phase tests : seuls les fichiers de `testPaths`. Phase implémentation : ces fichiers sont refusés |

Sous Windows et macOS, les chemins sont comparés **sans tenir compte de la casse**.

En cas d’erreur (configuration illisible, par exemple), la garde **refuse** plutôt que de laisser passer.

## Contrôle de fin de tour

Il s’exécute quand l’agent s’apprête à rendre la main.

1. **Phase tests (TDD)** : aucun contrôle, des tests rouges sont attendus.
2. **Phase implémentation (TDD)** : si un test figé a été modifié depuis `tests_commit`, y compris par le shell ou par un commit, le tour est bloqué.
3. **Code modifié sans chantier signé** : du code changé hors des chemins libres, sans débrayage (typiquement par le shell), bloque le tour **une fois** et l’agent doit vous le signaler. Un même état de l’arbre de travail n’est signalé qu’une fois.
4. **Contrôles du projet** (`checks`) : lancés seulement si du code a changé hors des chemins libres, de `chantiersDir` et de `.atelier/`, **et** si cet état n’est pas déjà passé au vert. Rouge : l’agent continue.
5. **Anti-boucle** : si l’agent bute sans rien changer à l’arbre de travail depuis le blocage précédent, il est autorisé à s’arrêter, et l’échec vous est montré **une fois**. Les contrôles ne sont pas relancés sur un état connu comme rouge. Tant que l’agent fait progresser le code, il continue d’itérer.

En cas d’erreur, ce hook **ne bloque pas**, mais le signale.

## Au démarrage d’une session

Rappelle la branche, le chantier actif, son statut, ses documents et la prochaine étape.

## `.claude/atelier.json`

Créé par `/atelier:init`, puis modifié **par vous** : l’agent ne peut pas le changer avec ses outils d’édition.

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
| `checks` | `[]` | Contrôles lancés en fin de tour, dans l’ordre. |
| `checkTimeoutSeconds` | `300` | Durée maximale d’un contrôle. |
| `freePaths` | `docs/**`, `.claude/**` (sauf `atelier.json`), `CLAUDE.md`, `README.md`, `.gitignore` | Modifiables sans chantier signé. |
| `sensitivePaths` | `.env`, `.env.*`, `*.pem`, `*.key`, `**/secrets/**` | Jamais modifiables par l’agent. |
| `testPaths` | `*.test.*`, `*.spec.*`, `*.snap`, `**/__tests__/**`, `**/__snapshots__/**`, `test/**`, `tests/**`, `e2e/**` | Ce qui compte comme test pour le TDD. |

## Le dossier `.atelier/`

Local, non versionné (ajouté au `.gitignore` par `/atelier:init`), protégé contre les outils d’édition de l’agent. Il contient :

| Fichier | Rôle |
|---|---|
| `bypass.json` | Le débrayage en cours, avec sa branche et sa raison. |
| `gate.json` | L’état du contrôle de fin de tour : dernier état vert, dernier blocage. |
| `gate-index` | L’index git temporaire qui sert à calculer l’état de l’arbre de travail. |

## En-tête de `spec.md`

| Champ | Valeurs | Qui le modifie |
|---|---|---|
| `id`, `type`, `title` | — | `/atelier:new` |
| `status` | `draft`, `signed`, `done`, `abandoned` | `atelier sign`, `atelier set-status` |
| `tdd` | `yes`, `no` | Vous, en brouillon ; ensuite `atelier set-tdd` |
| `signed_by`, `signed_at` | — | `atelier sign` |
| `done_at` | date | `atelier set-status done` |
| `tests_commit` | hash git | `atelier freeze-tests`, `atelier reopen-tests` |
