# atelier

Un plugin Claude Code pour développer avec l'IA comme un artisan : chaque modification est un **chantier** identifié, qui commence par une **spec signée**, avance par **tests d'abord** et petites tranches, passe une **revue indépendante** et se termine par un **bilan** versionné avec le code.

Inspiré des principes de gouvernance de [Solario](https://solario.io/fr), ramenés à l'échelle d'un développeur ou d'une petite équipe : des fichiers Markdown et git, pas une plateforme.

## Principes

1. **Aucun agent n'est fiable par défaut.** On contraint ce qu'il fait, on vérifie ce qu'il produit ; signer, accepter et fusionner restent des décisions humaines.
2. **Pas de code sans spec signée.** Un hook bloque toute modification hors de `docs/` tant que la spec du chantier n'est pas signée.
3. **La vitesse vient de specs courtes, pas du contournement.** Une petite tâche a une spec de trois lignes, jamais zéro.
4. **Questions uniquement sur les manques.** atelier ne fait jamais confirmer ce qui est déjà écrit.
5. **La trace est produite avec le logiciel.** Spec, plan, décisions et bilan vivent dans le dépôt.

## Installation

Une fois pour toutes sur ta machine (deux commandes, depuis n'importe quel dossier) :

```bash
claude plugin marketplace add opack/atelier
```

```bash
claude plugin install atelier@atelier
```

Puis, dans chaque projet : `/atelier:init`. Il déclare aussi le plugin dans le `.claude/settings.json` du projet : toute personne qui ouvre le projet se voit proposer atelier automatiquement, sans commande.

Pour tester une branche du plugin avant sa fusion, ajoute la référence : `claude plugin marketplace add "opack/atelier#<branche>"`.

## Mise à jour

```bash
claude plugin marketplace update atelier && claude plugin update atelier@atelier
```

Puis redémarre Claude Code. Claude Code ne récupère une nouvelle version que si son numéro change : avant chaque fusion sur `main`, lance `npm run version:patch` (ou `version:minor`).

## Développer le plugin

```bash
claude --plugin-dir <chemin>/atelier/plugins/atelier
```

Puis `/reload-plugins` après chaque modification. Tests : `npm test`. Validation : `claude plugin validate .`.

## Types de chantier

| Type | Pour | Étapes |
|---|---|---|
| `FEAT` | Fonctionnalité à créer ou améliorer | spec → signature → plan → tests → tranches → clôture |
| `FIX` | Correction d'un bug | spec → signature → test de non-régression → correction → clôture |
| `REF` | Restructuration, comportement inchangé | spec → signature → plan → tests de caractérisation → tranches → clôture |
| `TEC` | Technique sans impact utilisateur direct (CI, outillage, dépendances, config, sécurité, migration…) | spec → signature → tranches → clôture |
| `SPIKE` | Exploration bornée dans le temps, code jetable | spec → signature → exploration → clôture |

Identifiants : `<TYPE>-<numéro>`, avec un compteur unique par projet (qui continue l'historique existant). Branche `<type>/<ID>-<slug>`, commits `<prefix>(<scope>): [<ID>] …`, PR `[<ID>] <titre>`.

## Commandes

| Commande | Rôle |
|---|---|
| `/atelier:init` | Installe atelier dans le projet : `.claude/atelier.json` (contrôles types / lint / tests), dossiers, section Process du `CLAUDE.md`. |
| `/atelier:new [type] [description, lien Notion ou Sentry]` | Ouvre un chantier : identifiant, branche, dossier, spec construite en posant des questions sur les manques. |
| `/atelier:sign` | Relecture critique par un agent séparé, puis signature sur ta confirmation explicite. |
| `/atelier:plan` | Conception : approche, fichiers, tranches → `plan.md`, décisions → `decisions.md`. |
| `/atelier:tests` | Tests d'abord : un test par critère d'acceptation, qui échoue pour la bonne raison ; arrêt pour relecture. |
| `/atelier:status` | Où en est le chantier et quelle est la prochaine étape. |
| `/atelier:close` | Contrôles, revue indépendante, `bilan.md`, ton verdict, proposition de PR. |
| `/atelier:off <raison>` | Débrayage d'urgence de production : autorise le code sans spec, tracé. |

## Ce que font les hooks

- **Avant chaque écriture** : refuse les modifications de code sans chantier signé, la réécriture d'une spec signée et les fichiers sensibles (`.env`, clés).
- **Avant de terminer** : si du code a changé, lance les contrôles de `.claude/atelier.json` ; l'agent continue tant qu'ils échouent.
- **Au démarrage d'une session** : rappelle le chantier actif, son statut et la prochaine étape.

Les hooks ne font rien dans un projet sans `.claude/atelier.json`.

## Dossier de chantier

```text
docs/chantiers/<ID>-<slug>/
  spec.md        intention signée (template selon le type)
  plan.md        conception, tranches
  decisions.md   journal tenu pendant le chantier
  bilan.md       synthèse finale + verdict de revue : l'historique du chantier
```

L'état du chantier vit dans l'en-tête de `spec.md` (`status: draft | signed | done | abandoned`). Supprimer le plugin ne fait rien perdre.

## Pas encore disponible

`/atelier:fix` (voie rapide depuis Sentry), `/atelier:slice`, `/atelier:discover`, index Notion des chantiers, socle commun partagé entre projets. Ils seront ajoutés quand l'usage les réclamera.
