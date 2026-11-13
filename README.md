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
| `FEAT` | Fonctionnalité à créer ou améliorer | spec → signature → plan → (tests si TDD) → build → clôture |
| `FIX` | Correction d'un bug | spec → signature → (test de non-régression si TDD) → build → clôture |
| `REF` | Restructuration, comportement inchangé | spec → signature → plan → (tests de caractérisation si TDD) → build → clôture |
| `TEC` | Technique sans impact utilisateur direct (CI, outillage, dépendances, config, sécurité, migration…) | spec → signature → build → clôture |
| `SPIKE` | Exploration bornée dans le temps, code jetable | spec → signature → exploration → clôture |

Identifiants : `<TYPE>-<numéro>`, avec un compteur unique par projet (qui continue l'historique existant). Branche `<type>/<ID>-<slug>`, commits `<prefix>(<scope>): [<ID>] …`, PR `[<ID>] <titre>`.

## Commandes

| Commande | Rôle |
|---|---|
| `/atelier:init` | Installe atelier dans le projet : `.claude/atelier.json` (contrôles types / lint / tests), dossiers, section Process du `CLAUDE.md`. |
| `/atelier:new [type] [description, lien Notion ou Sentry]` | Ouvre un chantier : identifiant, branche, dossier, spec construite en posant des questions sur les manques. |
| `/atelier:sign` | Relecture critique par un agent séparé, puis signature sur ta confirmation explicite. |
| `/atelier:plan` | Conception : approche, fichiers, tranches → `plan.md`, décisions → `decisions.md`. |
| `/atelier:tests` | TDD, étapes 1 à 3 : tests écrits depuis les critères d'acceptation, **aucune implémentation**, échec vérifié, relecture, commit puis gel des tests. |
| `/atelier:build [tranche]` | TDD, étapes 4 et 5 : implémentation jusqu'à ce que tout passe **sans modifier les tests**, vérification anti-surapprentissage par un sous-agent indépendant, commit après validation. |
| `/atelier:status` | Où en est le chantier et quelle est la prochaine étape. |
| `/atelier:close` | Contrôles, revue indépendante, `bilan.md`, ton verdict, proposition de PR. |
| `/atelier:off <raison>` | Débrayage d'urgence de production : autorise le code sans spec, tracé. |

## Le cycle TDD, quand il est pertinent

Pour chaque chantier, **tu décides** s'il suit le TDD : champ `tdd: yes | no` dans l'en-tête de la spec, **obligatoire avant signature**. `/atelier:new` te pose la question avec une recommandation (plutôt oui pour la logique métier, un bug reproductible ou un refactor sensible ; plutôt non pour de la configuration, une montée de version, du texte, de la mise en page ou une exploration). « Non » ne veut pas dire « aucun test » : seulement pas de phase imposée, et pas de test pour le principe.

Quand c'est oui, atelier suit le workflow « write tests, commit; code, iterate, commit » recommandé par Anthropic ([Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)) et le fait respecter par les hooks :

1. **Tests d'abord** (`/atelier:tests`) : seuls les fichiers de test sont modifiables. Toute écriture d'implémentation, même factice, est refusée.
2. Les tests sont lancés et doivent **échouer pour la bonne raison**.
3. Après relecture, les tests sont **commités** puis **figés** (`atelier freeze-tests` refuse s'ils ne sont pas commités).
4. **Implémentation** (`/atelier:build`) : les tests sont en lecture seule. L'agent itère jusqu'à ce que tout passe ; un sous-agent indépendant vérifie que l'implémentation ne surapprend pas les tests.
5. **Commit** de l'implémentation après validation.

Un test réellement faux se rouvre explicitement (`atelier reopen-tests <raison>`) ; la décision TDD peut changer en cours de chantier (`atelier set-tdd <yes|no> <raison>`). Les deux sont tracés dans la spec.

## Ce que font les hooks

- **Avant chaque écriture** : refuse les modifications de code sans chantier signé, en TDD : toute implémentation pendant l'écriture des tests et toute modification des tests une fois figés, la réécriture d'une spec signée et les fichiers sensibles (`.env`, clés).
- **Avant de terminer** : pendant l'implémentation, refuse tout test modifié depuis son gel (même par une commande shell ou un commit) ; si du code a changé, lance les contrôles de `.claude/atelier.json` et l'agent continue tant qu'ils échouent. Pendant l'écriture des tests, des tests rouges sont attendus : rien n'est lancé.
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

`/atelier:fix` (voie rapide depuis Sentry), `/atelier:discover`, index Notion des chantiers, socle commun partagé entre projets. Ils seront ajoutés quand l'usage les réclamera.
