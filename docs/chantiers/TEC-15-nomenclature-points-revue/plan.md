# Plan : TEC-15 Identifiants stables des points de relecture

## Approche
Écrit sur le code tel qu'il sera après la fusion de FEAT-7 (branche rebasée). Logique dans des fonctions pures de `core.mjs` ; la CLI ne fait que lire.
- `readChantier` lit aussi `revue.md` (`chantier.revue`, texte ou `null`), comme FEAT-7 le fait pour `chantier.plan` : `setReviewedRefusal` et `closeProblems` gardent leur signature.
- `parseReviewPoints(text)` : sections `## `, tableaux sous `### Bloquant` / `### À discuter`, cellules (`\|` littéral), format antérieur (`## Tour`), fins de ligne CRLF.
- `isTreatment(cell)` : la cellule commence par un mot-clé de traitement (casse ignorée).
- `reviewPointProblems(parsed, { atClose })` : tous les contrôles de la spec §3.
- `nextReviewIds({ revue, spec, decisions })` → `{ next, open }` pour `atelier review-ids`.
- Branchement : `setReviewedRefusal` et `closeProblems` ajoutent les problèmes de points ; `closeProblems` reçoit en plus `revueUncommitted`, sur le modèle de `specUncommitted`.

## Fichiers et couches touchés
- `plugins/atelier/lib/core.mjs` : `readChantier`, `parseReviewPoints`, `isTreatment`, `reviewPointProblems`, `nextReviewIds` ; `setReviewedRefusal`, `closeProblems`.
- `plugins/atelier/lib/cli.mjs` : commande `review-ids [--json]` ; `set-reviewed`, `close-check` et `set-status done` (`revueUncommitted`).
- `plugins/atelier/test/core.test.mjs` : tests de chaque CA.
- `plugins/atelier/agents/` : `reviewer.md`, `spec-critic.md`, `overfit-checker.md`.
- `plugins/atelier/skills/` : `review`, `sign`, `build`, `close`, `amend`.
- `plugins/atelier/templates/` : `revue.md`, `bilan.md`.
- `site/cycle/revue.md`, `site/cycle/signature.md`, `site/cycle/implementation.md`, `site/cycle/cloture.md`, `site/agent/revue.md`, `site/reference/commandes.md`, `site/reference/glossaire.md`, `README.md` ; version du plugin.

## Tranches
1. Analyse de `revue.md` : `parseReviewPoints`, `chantier.revue` — CA couverts : CA-12, CA-15
2. Contrôle des points : `isTreatment`, `reviewPointProblems` (dernière occurrence, mots-clés, doublons, point dans le mauvais tableau, format, `requalifié`, `reporté (tranche N)` à la clôture, format antérieur) — CA couverts : CA-3, CA-4, CA-5, CA-6, CA-7, CA-13, CA-14, CA-16
3. Numérotation : `nextReviewIds`, commande `atelier review-ids [--json]` — CA couverts : CA-1, CA-2, CA-10
4. Refus dans la CLI : `set-reviewed`, `close-check`, `set-status done` (points ouverts, `revue.md` non commité) — CA couverts : CA-8, CA-9, CA-16
5. Agents, skills, templates : préfixes, numéros par `review-ids`, `(repris)`, traitements `reporté` / `requalifié`, commits qui citent un point, bilan §7 par identifiant — CA couverts : CA-11
6. Site, README, version : pages du cycle, commandes, glossaire, montée de version — vérifié par `npm run build` et `claude plugin validate`

## Risques et points d'attention
- À relire ligne à ligne : l'analyse des tableaux. Un faux négatif rouvre le trou que ce chantier ferme. Tester CRLF, cellules vides, espaces superflus, `\|`.
- `review-ids` lit `SB`/`SD`/`OB`/`OD` dans `spec.md` : la spec de TEC-15 contient des exemples (`SD2`, `OB1`), ses numéros commenceront donc plus loin. Accepté.
- Dépendance à FEAT-7 : `set-reviewed`, `closeProblems` et le template `revue.md` changent sous FEAT-7. Si FEAT-7 change de forme avant sa fusion, revoir la tranche 4.
