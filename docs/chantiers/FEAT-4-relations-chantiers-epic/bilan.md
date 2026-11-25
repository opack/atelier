# Bilan : FEAT-4 Relations entre chantiers et type EPIC

## 1. Résumé
atelier trace désormais les liens entre chantiers (`rel_parent`, `rel_depends_on`, `rel_origin`, `rel_replaces`), les vérifie à la signature et à la clôture, et ajoute un sixième type, `EPIC`, qui organise un sujet réalisé par plusieurs chantiers sans rien implémenter.
Pour les utilisateurs du plugin : on ne clôt plus un chantier dont un prérequis n'est pas fusionné, ni un EPIC dont un enfant est ouvert, et la section « Process » du `CLAUDE.md` devient un template vérifiable (`check-process`).
État final : les 13 CA sont livrés, la suite passe (137 tests) et la revue est à jour au commit 17604cc.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| CA-1 lecture des `rel_*` normalisée | Livré | `core.test.mjs:1056` |
| CA-2 enfants découverts sur toutes les branches, statut jugé dans l'arbre courant | Livré | `core.test.mjs:1069`, `:1088` |
| CA-3 clôture refusée sur dépendance non `done` ici | Livré | `core.test.mjs:1107` |
| CA-4 clôture permise quand les dépendances sont `done` | Livré | `core.test.mjs:1124` |
| CA-5 `check-spec` : introuvable, mal formé, parent multiple / non EPIC / clos, auto-référence, cycles ; bloque la signature | Livré | `core.test.mjs:1150` à `:1181` |
| CA-6 `next-id EPIC`, branche `epic/EPIC-7-x` | Livré | `core.test.mjs:1203` |
| CA-7 templates `spec-epic` / `plan-epic`, `set-tdd yes` refusé, EPIC en `tdd: yes` signalé | Livré | `core.test.mjs:1212` à `:1238` |
| CA-8 aucune écriture hors chemins libres sur un EPIC | Livré | `core.test.mjs:1246` |
| CA-9 clôture d'un EPIC : sans revue, enfants ouverts listés, au moins un `done`, imbrication, abandon permis | Livré | `core.test.mjs:1266` à `:1314` |
| CA-10 prochaine étape d'un EPIC (découpage, enfants ouverts, clôture ou abandon, jamais la revue) | Livré | `core.test.mjs:1326`, `:1349`, `:1406` |
| CA-11 `status` affiche les relations et les enfants d'un EPIC | Livré | `core.test.mjs:1367`, `:1390`, `:1406` |
| CA-12 `check-process` avec le `chantiersDir` du projet | Livré | `core.test.mjs:1427` à `:1459` |
| CA-13 site : six types, templates `spec-epic` / `plan-epic` | Livré | `core.test.mjs:1481` (contenu) ; `npm run build` lancé à la main en revue (tour 1, D4) |

Écarts par rapport à la spec :
- **Liens inverses** : seuls les enfants d'un EPIC sont calculés, pas les dépendants d'un chantier. Aucun CA ne les demande, et une vue globale des relations est hors périmètre.
- **Performance** : l'index coûte environ 170 ms, contre une indication de 100 ms qui n'était pas un critère d'acceptation. Ce coût ne dépend pas du nombre de branches ; il vient surtout du lancement des processus git sous Windows.
- **Rappel de démarrage** : le plan disait qu'il ne paierait rien. Il construit pourtant l'index quand le chantier courant est un EPIC ou a des `rel_*`, parce que c'est l'information utile à l'ouverture d'une session.

## 3. Choix techniques
- **Index des chantiers construit à la demande** : l'arbre courant est lu sur le disque et les autres branches par trois appels git (`for-each-ref`, puis deux `cat-file --batch`), quel que soit le nombre de branches.
- **Juger dans l'arbre courant** : un chantier est découvert sur toutes les branches, mais il ne compte comme clos que si son statut clos est fusionné dans la branche courante.
- **Un lien compte dès qu'une version le déclare** : les liens sont l'union de toutes les versions connues, le statut ne vient que de l'arbre courant.
- **L'EPIC entre dans le cœur existant** (`CHANTIER_TYPES`, `REQUIRED_SECTIONS`, `decideWrite`, `closeProblems`, `nextStep`) sans notion nouvelle. Il est exempté de revue comme le SPIKE.
- **Section Process sortie en template** (`templates/process.md`) et comparée ligne à ligne par `check-process`. Les lignes ajoutées par le projet sont acceptées.
- **Pas de repli sur erreur git** : aucune erreur n'a pu être provoquée (`cat-file` répond « missing » avec le code 0). Une erreur réelle remonte donc comme les autres.

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs`, par où commencer la lecture :
  - `buildChantierIndex`, `statusHere` / `isClosedHere`, `childrenOf`, `openChildren`, `describeRelation` : le modèle des relations.
  - `parseRelations`, `parseCatFileBatch`, `parseTreeEntries`, `chantierTreesOf` : la lecture des données.
  - `relationProblems` : les contrôles de `check-spec`.
  - `relationCloseProblems` et `closeProblems` : la clôture, avec l'exemption via `isReviewExempt`.
  - `nextStep` : les étapes d'un EPIC.
  - `decideWrite` : le refus d'écriture sur un EPIC, placé après les chemins libres et le débrayage, avant les règles TDD.
  - `setTddRefusal`, `checkProcessProblems`.
- `plugins/atelier/lib/cli.mjs` :
  - `chantierIndex` et `catFileBatch` : les appels git.
  - `relationsSummary` et `formatRelations` : l'affichage dans `status` et dans le hook de démarrage.
  - `specProblems` : `check-spec` et `sign`.
  - `commandCheckProcess` et `formatCloseProblems`.
- `plugins/atelier/templates/spec-epic.md`, `plan-epic.md`, `process.md`.
- Skills `new` (proposer un EPIC, relations), `plan` (découpage d'un EPIC, périmètre trop grand), `close`, `init` (lignes Process manquantes), `amend`, `status`.
- Site : `fondations/types.md`, `fondations/chantier.md`, `reference/templates.md`, `reference/commandes.md` ; `README.md`.

## 5. Pistes écartées
- **Un seul `git grep` sur toutes les refs** : environ 2 s mesurées sur 31 branches, et le coût croît avec le nombre de branches. Remplacé par `cat-file --batch`.
- **`cat-file --batch` sur chaque couple branche × spec** : la sortie contient les specs entières. **`ls-tree` par branche** : un appel par branche.
- **Lire aussi la branche courante dans git** : cette version commitée, parfois périmée, aurait doublé celle du disque.
- **Retenir seulement la version de l'arbre courant pour les liens** : elle pouvait laisser clore un EPIC dont un enfant n'a été rattaché que sur sa branche.
- **Un `catch` de repli dans le rappel de démarrage et à l'abandon** : il couvrait un cas qu'on n'a pas su provoquer, donc du code non testable.
- **Normaliser `chantiersDir` dans `loadConfig`** : comportement antérieur à FEAT-4, laissé hors périmètre.

## 6. Dette et suites
- **Dette connue, laissée en l'état : `chantiersDir` non normalisé.** Avec un `/` final, les motifs `${chantiersDir}/**` deviennent `//**` et ne correspondent plus à rien. La protection de la spec et l'exclusion des documents du chantier sautent alors en silence. Il n'y a pas de chantier pour l'instant : le cas ne se produit qu'avec cette configuration.
- **Tests tranche par tranche : FEAT-7** (branche `FEAT-7-tdd-par-tranche`), cycle TDD complet par tranche. Ici, les tests figés d'un bloc et un contrôle global ont forcé un commit d'implémentation unique (b4377e7) au lieu des 7 tranches du plan.
- **Dates de la CLI en UTC (`today()`)** : c'est voulu, pas une dette. Tout le monde partage la même référence, et la conversion en date locale se fait à l'affichage si besoin.
- **Performance de l'index** (environ 170 ms sous Windows) : à reprendre seulement si une gêne est observée.
- **Ligne de commande** : rien à prévoir, les requêtes `cat-file` passent par l'entrée standard.
- **ADR** : `docs/decisions/0001-statut-juge-dans-l-arbre-courant.md` (statut jugé dans l'arbre courant, liens dans toutes les branches), à appliquer à tout futur index (Notion, vue globale).

## 7. Verdict de revue
Quatre tours de revue (base 8309779) :
- **Tour 1 (b4377e7)** : un bloquant, B1, le hook de démarrage sans test. Test ajouté (99382a0) et `catch` retiré (6f70699). Six points à discuter :
  - D3 corrigé ;
  - D2 et D6 consignés dans decisions.md ;
  - D4 vérifié par le build du site ;
  - D1 sans objet ;
  - D5 écarté.
- **Tour 2 (6f70699)** : aucun bloquant. Trois points traités dans le chantier :
  - CA-10 et CA-12 amendés, tests regelés (76ad521), corrigés (f1f22db) ;
  - message de refus d'écriture sans chemin en dur (f1f22db).
  - Les dates en UTC sont hors périmètre.
- **Tour 3 (f1f22db)** : aucun bloquant. La consigne de la skill `init` sur le `/` final est corrigée (17604cc) ; le point « `revue.md` non commité » est écarté (commité à l'enregistrement de la revue).
- **Tour 4 (17604cc)** : aucun point.
- Exceptions acceptées : aucune.

- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-21
