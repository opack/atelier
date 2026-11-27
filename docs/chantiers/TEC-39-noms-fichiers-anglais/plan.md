# Plan : TEC-39 Noms de fichiers et de dossiers des chantiers en anglais

## Approche
Une constante des noms fixes dans `lib/common.mjs` (socle sans import), que les modules importent à la place de leurs littéraux ; `DEFAULT_CONFIG` en tire `workItemsDir` et `decisionsDir`. Remplacement mécanique, sans logique nouvelle. Le dépôt reste sous les anciens noms jusqu'à la tranche 5 : les tranches 1 à 3 se testent sur des dépôts jetables, et le plugin de `main` continue de guider les sessions. La migration du dépôt et la version arrivent en dernier, en un seul commit (Déroulé de la spec, SB1).

## Fichiers et couches touchés
- `plugins/atelier/lib/common.mjs` : constante des noms fixes, `DEFAULT_CONFIG.workItemsDir`.
- `plugins/atelier/lib/` (`write-guard`, `stop-hook`, `review`, `docs`, `close`, `review-points`, `next-step`) et `lib/cli/` (`identifiers`, `relations`, `write-guard`, `review`, `close`, `docs`, `review-points`, `spec`, `next-step`, `slices`, `tdd`) : import de la constante, `config.workItemsDir`.
- `plugins/atelier/templates/` : `revue.md` → `review.md`, `bilan.md` → `report.md` ; textes de `process.md`, `plan-epic.md`.
- `plugins/atelier/test/` : fixtures et assertions aux nouveaux noms (une vingtaine de fichiers, changements mécaniques) ; test d'architecture des noms fixes (CA-4) et des anciens noms (CA-5).
- `plugins/atelier/skills/` (new, sign, plan, write-tests, review, amend, close, init), `agents/` (reviewer, implementer), `README.md`.
- `site/` : pages qui citent ces noms, note « mise à jour depuis 0.8 » (Configuration, Installation).
- Tranche 5 : `docs/chantiers/` → `docs/work-items/` (`git mv`), `.claude/atelier.json` (par l'utilisateur), spec et plan d'EPIC-14, `CLAUDE.md`, `plugins/atelier/.claude-plugin/plugin.json` (0.9.0).

## Tranches
1. Constante des noms fixes, dossier `docs/work-items` et clé `workItemsDir` (common, identifiers, write-guard, stop-hook, review, relations, docs) — CA couverts : CA-1, CA-4 — TDD : oui
2. `review.md` et `report.md`, templates renommés (close, review-points, next-step, identifiers, templates/) — CA couverts : CA-2, CA-3 — TDD : oui
3. Skills, agents, textes des templates et README aux nouveaux noms, test des anciens noms sur `plugins/atelier/` et `README.md` — CA couverts : CA-5 — TDD : oui
4. Site : pages citant ces noms, note « mise à jour depuis 0.8 », build — CA couverts : CA-7 — TDD : non
5. Migration du dépôt en un commit (`git mv`, `.claude/atelier.json`, amendement d'EPIC-14, `CLAUDE.md`), vérification avant / après, version 0.9.0 ; puis revue du chantier en débrayage — CA couverts : CA-5, CA-6, CA-8 — TDD : non

## Risques et points d'attention
- Tranche 1 volumineuse (fixtures `docs/chantiers` dans une vingtaine de fichiers de test) : changements mécaniques, signalés au relecteur ; les cas nouveaux sont repérables par leur étiquette.
- TEC-37 et FEAT-35 pas encore dans `main` : tests de la tranche 1 seulement après leur fusion ; refusionner `main`, amender les critères `CA-n` → `AC-n`, refaire le recensement (les commandes `list`, `path`, `open` de FEAT-35 peuvent grossir les tranches 1 et 3).
- CA-5 couvre deux tranches : la tranche 3 fige le test sur `plugins/atelier/` et `README.md` ; `CLAUDE.md` et `.claude/atelier.json` ne passent aux nouveaux noms qu'au commit de migration (tranche 5), vérifiés à ce moment.
- Après le commit de migration, le plugin de `main` ne voit plus TEC-39 : revue du chantier et clôture avec la CLI de la branche, écritures de code en débrayage (`/atelier:off`) jusqu'à la fusion ; aucune revue enregistrée avant la migration ne survit au déplacement de la spec.
- Branches ouvertes à la fusion (dont `spike/SPIKE-38-essai-bandeau`) : à migrer par `git mv` ou à clore avant.
