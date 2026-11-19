# Bilan : TEC-1 Plugin atelier minimal

## 1. Résumé
Premier lot du plugin atelier : marketplace GitHub, 9 commandes `/atelier:*`, CLI `atelier` sans dépendance, 3 hooks (garde d'écriture, contrôle de fin de tour, rappel de session), 3 sous-agents, templates. La garde et le hook de fin appliquent les règles de la spec §4 ; la logique de décision est pure et testée (38 tests). État final : livré et vérifié sur dépôt jetable, essai réel sur envo-admin reporté après TEC-2 (amendement du 2026-11-19).

## 2. Livré vs spécifié
| Critère (§7) | Statut | Test |
|---|---|---|
| `npm test` vert, garde règle par règle | OK | `core.test.mjs` › write guard, project relative paths, tool edits |
| `npm test` : identifiants, complétude, prochaine étape | OK | › chantier identifiers, spec completeness, next step |
| `npm test` : décision de fin de tour | OK | › stop hook, git output |
| `claude plugin validate` (marketplace et plugin) | OK | lancé avant chaque commit |
| Essai de bout en bout (CLI et hooks sur dépôt jetable) | OK, 23 scénarios | script `e2e.sh`, voir ci-dessous |
| Essai réel sur envo-admin | Reporté | amendement du 2026-11-19 : après TEC-2 |

Essai de bout en bout, 2026-11-19 (hooks appelés avec les entrées JSON de Claude Code) :
- refusés comme attendu : code avant signature, signature d'une spec incomplète, auto-signature par `Edit`, écriture de `.atelier/bypass.json`, modification de `.claude/atelier.json`, réécriture d'une spec signée, implémentation en phase tests, test figé modifié par l'outil d'édition, code sur une branche sans chantier, code après un chantier clos, signature d'une spec `done`, `set-status signed`, édition de spec invérifiable, écriture avec un `bypass.json` illisible ;
- fin de tour : code écrit par le shell sans signature signalé une fois ; test figé modifié par le shell bloqué puis, sans progrès, arrêt autorisé avec message à l'utilisateur ; contrôle rouge bloquant, anti-boucle, reprise quand l'arbre progresse ; état vert mis en cache ; fichier de doc accentué ignoré ;
- autorisés : fichier de test en phase tests, débrayage ; `set-tdd` après signature tracé en amendement ; index git réel jamais modifié.

Écarts par rapport à la spec :
- essai réel sur envo-admin sorti du chantier (décision de l'utilisateur, amendement) ;
- casse ignorée aussi sous macOS (même risque que Windows ; voir `decisions.md`) ;
- `.claude/settings*.json` reste modifiable par l'agent : ajouté aux limites connues (§5, amendement) plutôt que protégé.

## 3. Choix techniques
- Une CLI Node sans dépendance partagée par les skills et les hooks ; logique dans `lib/core.mjs`, entrées / sorties dans `lib/cli.mjs`.
- L'état du chantier vit dans l'en-tête de `spec.md` ; le chantier actif se déduit de la branche.
- Les champs d'état de l'en-tête ne changent que par la CLI : la garde rejoue l'édition proposée (`applyToolEdit`) et compare l'en-tête avant / après.
- TDD décidé par l'humain, chantier par chantier, et appliqué par les hooks (phases, gel des tests à leur commit).
- Hook de fin piloté par un identifiant de l'arbre de travail (`git write-tree` sur un index séparé) : cache des états verts, signalement unique, anti-boucle.
- En cas d'erreur, la garde refuse (au lieu de laisser passer) et le hook de fin le signale.
- Garde-fou contre l'oubli, pas barrière : les écritures par le shell ne sont détectées qu'en fin de tour.

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs` : à lire en premier. `decideWrite` (garde, règles de la spec §4 dans l'ordre), `decideStop` (fin de tour), `checkSpec` (complétude), `nextStep`, `testDrivenPhase`, `applyToolEdit`, `parsePorcelainPaths`, `matchesAny`, `toProjectRelativePath`.
- `plugins/atelier/lib/cli.mjs` : commandes `atelier *` et entrées des hooks (`hook-guard`, `hook-gate`, `hook-session-start`), appels git, `workingTreeId`.
- `plugins/atelier/hooks/hooks.json` : branchement des hooks.
- `plugins/atelier/skills/*/SKILL.md` : le process, étape par étape ; `agents/*.md` : `spec-critic`, `reviewer`, `overfit-checker`.
- `plugins/atelier/test/core.test.mjs` : la spécification exécutable des règles.

## 5. Pistes écartées
- Tout faire en prose dans les skills : la complétude et le blocage doivent être vérifiables et testés.
- Bloquer les écritures par le shell : aucune analyse de commande n'est fiable.
- `stop_hook_active` pour l'anti-boucle : une seule relance forcée, incompatible avec l'itération du TDD.
- Pathspec d'exclusion de `.atelier` pour identifier l'arbre : git la refuse quand le dossier est ignoré (bug trouvé par l'essai de bout en bout).
- `/atelier:slice` : remplacée par `/atelier:build`.
- Protéger `.claude/settings*.json` : `/atelier:init` et les réglages du projet ont besoin d'y écrire.

## 6. Dette et suites
- Essai réel sur envo-admin, après TEC-2 ; corrections éventuelles dans de nouveaux chantiers.
- `npm run version:patch` avant la fusion.
- Délai du hook de fin (600 s) dépassable par plusieurs contrôles de `checkTimeoutSeconds` chacun : faire de `checkTimeoutSeconds` un budget total, ou le borner dans `/atelier:init`.
- Frontière `core.mjs` / `cli.mjs` imparfaite : filtrage des tests modifiés et détection `isSpec` dans `cli.mjs` ; `core.mjs` lit encore le disque et git (`readChantier`, `collectUsedIdentifiers`, `findProjectRoot`).
- macOS : `path.relative` reste sensible à la casse, un `file_path` de casse différente du dossier projet est vu hors du projet.
- Détails : plage de caractères combinants écrite en littéral (`core.mjs`, `normalize`), résumé dupliqué entre `hookSessionStart` et `commandStatus`, `reopen-tests` ne vérifie pas `tdd: yes`.
- TEC-2 : mettre à jour la documentation de la méthode (hooks, limites, TDD, `build`).

## 7. Verdict de revue
Revue indépendante (sous-agent `reviewer`) : aucun point bloquant ; 11 points à discuter.
- Corrigés (commit `2523e3b`) : chemins git non ASCII (`-z`), édition de spec invérifiable refusée, `sign` limité au brouillon et `set-status signed` retiré, contrôles non relancés sur un état connu rouge, hooks qui refusent ou signalent en cas d'erreur, `.atelier/**` retiré des chemins libres.
- Traité dans la spec : `.claude/settings*.json` ajouté aux limites connues (§5).
- Laissés en dette (section 6) : délai du hook de fin, frontière `core` / `cli`, casse sous macOS, détails.
- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-19
