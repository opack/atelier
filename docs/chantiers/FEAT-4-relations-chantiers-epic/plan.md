# Plan : FEAT-4 Relations entre chantiers et type EPIC

## Approche
Un **index des chantiers**, construit à la demande, porte toutes les relations : l'arbre courant est lu sur le disque (modifications non commitées comprises), les autres branches par deux appels git au total (`git for-each-ref refs/heads refs/remotes`, symrefs exclues, puis un seul `git grep --null -E '^(id|type|status|rel_[a-z_]+):' <refs…> -- '<chantiersDir>/*/spec.md'`). L'identifiant vient du nom de dossier, comme `findChantierDirectory` ; pour chaque clé, la première occurrence du fichier (l'en-tête) compte. L'index n'est construit que si le chantier courant a des `rel_*` ou est un EPIC, ou pour `check-spec`, `sign` et `set-status` : le hook de démarrage et la garde d'écriture ne paient rien.

Toute la logique est pure dans `lib/core.mjs` : `parseRelations`, `parseBranchSpecHeaders` (sortie de `git grep`), `buildChantierIndex` (par identifiant : version de l'arbre courant ou null, versions des autres branches avec leur ref), `childrenOf` / `isClosedHere` (statut jugé dans l'arbre courant seulement), `relationProblems` (check-spec), `relationCloseProblems` (dépendances, enfants d'un EPIC), `checkProcessProblems`. Un chantier est enfant ou dépendant dès qu'**une** de ses versions déclare le lien (voir decisions.md). `lib/cli.mjs` ne fait que les lectures git / disque et l'affichage.

L'EPIC entre dans le cœur existant sans notion nouvelle : `CHANTIER_TYPES` (donc `ID_PATTERN`, `next-id`, branches `epic/…`, commits `[EPIC-n]`), `TDD_RECOMMENDATION`, `REQUIRED_SECTIONS` (Vision, Pourquoi, Critères d'acceptation globaux, Cadre, Hors périmètre), `checkSpec` (EPIC en `tdd: yes` signalé), `decideWrite` (refus hors chemins libres, après débrayage, avant les règles TDD), `closeProblems` (exemption de revue comme le SPIKE, plus les problèmes de relations), `nextStep` (nombre d'enfants ouverts en paramètre).

## Fichiers et couches touchés
- `plugins/atelier/lib/core.mjs` : type EPIC, sections, fonctions de relations et d'index, `closeProblems`, `nextStep`, `decideWrite`, `setTddRefusal`, `checkProcessProblems`.
- `plugins/atelier/lib/cli.mjs` : `chantierIndex` (disque + `git grep`), `status` (relations, enfants), `check-spec` et `sign` (relations ; ignorées avec un message sans `.claude/atelier.json`), `set-status done|abandoned`, `close-check`, `set-tdd`, `check-process` (nouveau).
- `plugins/atelier/templates/` : `spec-epic.md`, `plan-epic.md`, `process.md` (section Process sortie du skill `init`, plus une ligne EPIC / relations).
- `plugins/atelier/skills/` : `new`, `plan`, `close`, `init`, `amend`, `status`.
- `plugins/atelier/test/core.test.mjs` : logique pure ; dépôts temporaires pour la découverte multi-branches, les clôtures et la garde d'écriture sur un EPIC.
- `site/fondations/types.md`, `site/fondations/chantier.md`, `site/reference/templates.md`, `site/reference/commandes.md`, `README.md`.

## Tranches
Les tests de tous les CA sont écrits et figés d'abord (`/atelier:write-tests`) ; les tranches sont les commits de `/atelier:build`.
1. Type EPIC : types, sections, `checkSpec` (EPIC en `tdd: yes`), templates `spec-epic` / `plan-epic`, refus de `set-tdd yes`, refus d'écriture hors chemins libres — CA couverts : CA-6, CA-7, CA-8
2. Relations et index : `parseRelations`, `parseBranchSpecHeaders`, `buildChantierIndex`, `chantierIndex` (CLI), `relationProblems` branché dans `check-spec` et `sign` — CA couverts : CA-1, CA-5
3. Clôture : dépendances, enfants d'un EPIC (récursif par construction), exemption de revue, liste des enfants ouverts à l'abandon — CA couverts : CA-2, CA-3, CA-4, CA-9
4. `status` et prochaine étape : affichage des relations, étapes de l'EPIC — CA couverts : CA-10, CA-11
5. `check-process`, template `process.md`, skill `init` qui propose les lignes manquantes — CA couverts : CA-12
6. Skills `new`, `plan`, `close`, `amend` : proposer un EPIC, découpage `plan-epic`, signal de périmètre trop grand, mise en garde au-delà de deux niveaux, clôture sur `epic/…`, rattachement après coup — CA couverts : description (pas de CA testable)
7. Site et README : six types, relations, templates `spec-epic` / `plan-epic` — CA couverts : CA-13

## Risques et points d'attention
- Enfant abandonné sur une branche jamais fusionnée, ou branche distante supprimée mais non élaguée : l'enfant reste ouvert et bloque l'EPIC (voulu par la spec) : le message de refus nomme la branche où vit l'enfant et propose de la fusionner ou de la supprimer.
- Performance de `git grep` sur beaucoup de branches : mesure dans la tranche 2 sur un dépôt fictif (300 specs, 30 branches), cible indicative ~100 ms.
- Ligne de commande trop longue sur Windows (32 Ko, au-delà de ~500 refs) : découpage en lots si besoin, pas d'avance.
- Ligne d'en-tête recopiée dans le corps (`status: …` en début de ligne) : ignorée, seule la première occurrence par fichier compte.
- Zone à relire ligne à ligne : l'ordre des règles dans `decideWrite` (EPIC après chemins libres et débrayage, avant TDD) ; la garde d'écriture est le cœur de la méthode.
