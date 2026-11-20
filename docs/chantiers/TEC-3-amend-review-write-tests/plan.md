# Plan : TEC-3 Amender la spec, rouvrir les tests, séparer revue et clôture

## Approche
Même découpage qu'aujourd'hui : **git dans `lib/cli.mjs`, décisions dans `lib/core.mjs`**. La CLI lit l'état git (spec de référence dans `HEAD`, fichiers touchés depuis la revue, existence et ancêtre du commit revu) et passe des valeurs simples à des fonctions pures. Les refus de la CLI sont eux aussi des fonctions pures (`reopenTestsRefusal`, `setReviewedRefusal`, `setStatusRefusal`) : tout §6 se teste dans `core.test.mjs`, sans dépôt git de test. Le vrai git n'est exercé que par le rejeu de bout en bout.

Fonctions nouvelles ou étendues dans `core.mjs` :
- `parseAmendments(text)` (entrées, nombre de sections, texte hors entrées, corps sans la section), `appendAmendmentEntry(text, entry)` (fin de section, ou création de la section), `isRefreeze(entries)` (par la position, ancien format reconnu) ;
- `specWriteRefusal` étendu : reçoit en plus `referenceSpec` (version de `HEAD`, ou erreur), applique les trois ensembles de champs, la règle des entrées en préfixe exact, la section unique ;
- `reviewCodePaths(config)` : chemins libres moins `.claude/**`, plus `chantiersDir` et `.atelier/**` ; partagé par :
  - `reviewState({ reviewedCommit, found, isAncestor, codeFilesSince, amendmentsChanged, type })` → `none` | `current` | `stale` ;
  - `closeProblems({ … , checksFailure, uncommittedCode, testsFrozen })` → liste de problèmes ;
- `nextStep(chantier, reviewState)` reste pure.

Côté CLI : référence lue par `git ls-files -z -- ":(icase)<chemin>"` puis `git show HEAD:<chemin>` ; fichiers touchés depuis la revue par `git log --name-only -z --no-renames --diff-merges=first-parent --format= <reviewed>..HEAD`.

**Amorçage : option A.** Le build se fait sous la garde 0.1.1 installée ; la revue et la clôture de TEC-3 se font dans une session `claude --plugin-dir ./plugins/atelier` (0.2.0 locale). TEC-3 passe donc par `review` → `reviewed_commit` → `close-check`.

## Fichiers et couches touchés
- `plugins/atelier/lib/core.mjs` : fonctions pures ci-dessus.
- `plugins/atelier/lib/cli.mjs` : lecture git, commandes `set-reviewed` et `close-check`, `reopen-tests`, `freeze-tests`, `set-status` et `set-tdd` revus, `status` et le hook de début de session.
- `plugins/atelier/test/core.test.mjs` : cas de §6.
- `plugins/atelier/skills/` : `tests/` renommé en `write-tests/`, nouveaux `amend/` et `review/`, `close/` réécrit, mises à jour de `build`, `plan`, `sign`, `status`, `new`.
- `plugins/atelier/agents/reviewer.md` : description (« avant clôture » devient revue de chantier).
- `plugins/atelier/templates/revue.md` : nouveau.
- `plugins/atelier/.claude-plugin/plugin.json` : 0.2.0 (`npm run version:minor`).
- `site/` :
  - cycle : `tests` (renommée), `cloture`, nouvelles pages `revue` et `amendement` ;
  - référence : `commandes`, `configuration`, `templates` (inclusion de `revue.md`), `glossaire`, `limites` (signature erronée) ;
  - `guide/demarrage-rapide`, `guide/vue-ensemble` (schéma SVG), barre latérale dans `.vitepress/config`.
- `README.md`.

## Tranches
Un TEC n'a pas de `CA` : chaque tranche renvoie aux points de vérification de la spec (§6).
1. **Section « Amendements » et réouverture des tests** : `parseAmendments`, `appendAmendmentEntry`, `isRefreeze`, libellés fixes, entrée « tests regelés », refus de `reopen-tests`. §6 : ajout d'entrées, détection du regel, refus de `reopen-tests`.
2. **Garde sur la spec non brouillon** *(zone critique, à relire ligne à ligne)* : référence `HEAD`, trois ensembles de champs, entrées en préfixe exact, section unique, `Write` refusé, `reviewed_commit` réservé, refus de `set-status draft`. §6 : garde, refus de `set-status draft`.
3. **État de la revue** : `reviewState`, `set-reviewed` et ses refus, `nextStep(chantier, reviewState)`, `status` texte et `--json` (`reviewedCommit`, `reviewState`), rappel de début de session. §6 : prochaine étape et `reviewState`, refus de `set-reviewed`.
4. **Clôture** : `closeProblems`, `close-check`, `set-status done` conditionné, exemption du `SPIKE`, commit revu introuvable. §6 : décision de clôture.
5. **Skills, template et version** : `write-tests`, `amend`, `review`, `close`, mises à jour des autres skills et de l'agent `reviewer`, `revue.md`, version 0.2.0. §6 : `claude plugin validate` (les deux), plus aucune référence à `/atelier:tests` dans le plugin.
6. **Site et README** : pages, barre latérale, schéma SVG, lancement dans une session Claude Code, signature erronée. §6 : `npm run build` sans lien mort, captures Playwright (clair et sombre, bureau et mobile), plus aucune référence à `/atelier:tests`.

Puis, hors tranche : rejeu de bout en bout sur un dépôt jetable (consigné dans le bilan), puis `/atelier:review` et `/atelier:close` sous la 0.2.0 locale.

## Risques et points d'attention
- **Garde fail-closed** : un bug bloque toute édition de spec. Parade : tranche 2 testée cas par cas (§6), relecture dédiée de la normalisation CRLF et de la casse des chemins.
- **Coût de la garde** : deux appels git, seulement pour les fichiers `spec.md` ; le délai de 10 s du hook suffit.
- **`--diff-merges=first-parent`** demande git 2.31 ou plus. Parade : version vérifiée au rejeu ; mention dans « Garanties et limites » si nécessaire.
- **Playwright** absent de `site/`. Parade : lancé depuis le dossier de travail temporaire, sans dépendance ajoutée au projet.
- **Changement de signature** de `nextStep` : seule la CLI l'appelle.
