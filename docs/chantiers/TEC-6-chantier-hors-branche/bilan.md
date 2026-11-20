# Bilan : TEC-6 Reconnaître un chantier hors branche <type>/<ID>-<slug>

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
Quand le nom de la branche ne porte pas d'identifiant (branche imposée par une session Claude Code cloud, `claude/...`, ou par une convention d'équipe), atelier déduit le chantier actif du commit `[<ID>]` le plus récent propre à la branche. Le nom de branche reste prioritaire ; sur la branche par défaut, aucune déduction. `/atelier:new` permet de rester sur une telle branche et y commite le brouillon tout de suite. Livré, testé (V-1 à V-10), revu en quatre tours.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| V-1 : identifiant du commit le plus récent qui en porte un | Livré | `V-1 : rend l’identifiant du commit le plus récent qui en porte un` |
| V-2 : crochets obligatoires, casse ignorée, type inconnu ignoré, liste vide | Livré | `V-2 : crochets obligatoires, casse ignorée, type inconnu ignoré, liste vide` |
| V-3 : déduction sur `claude/x`, rien sur `main`, nom de branche prioritaire | Livré | trois tests `V-3 : …` |
| V-4 : sans branche par défaut identifiable, HEAD détachée | Livré | deux tests `V-4 : …` |
| V-5 : `main` local en avance sur `origin/main` ; base `origin/main` | Livré | deux tests `V-5 : …` |
| V-6 : `chantierSource` dans `status --json`, « (déduit des commits) » dans `status` et le hook de démarrage | Livré | trois tests `V-6 : …` |
| V-7 : déduction avec `origin/HEAD` vers `origin/main` | Livré (amendement d0ca34d) | `V-7 : avec origin/HEAD vers origin/main, …` |
| V-8 : `origin/HEAD` vers `develop` | Livré (amendement d0ca34d) | `V-8 : origin/HEAD vers develop : …` |
| V-9 : branche non conforme sans commit propre | Livré (amendement d0ca34d) | `V-9 : une branche non conforme sans commit propre n’a pas de chantier` |
| V-10 : garde d'écriture sur un chantier déduit (brouillon refusé, signé autorisé) | Livré (amendement 8e1249b) | `V-10 : la garde d’écriture applique les règles du chantier déduit des commits` |
| Essai manuel : `atelier status` sur `claude/...` | Fait | `TEC-6 (déduit des commits)` sur `claude/tec6-trial` |
| Essai manuel : parcours `/atelier:new` sur `claude/...` | Fait, en rejouant les commandes du skill (pas un vrai `/atelier:new` lancé par un agent, choix de l'utilisateur) | premier et deuxième chantier sur `claude/session`, création depuis `tec/TEC-1-x`, contre-épreuve |
| `claude plugin validate`, `npm run build` dans `site/` | Fait | — |

Écarts par rapport à la spec signée : trois amendements, tous issus de la revue (borne de `git log` et coût git, V-7 à V-10, ordre des étapes de `/atelier:new` sur une branche imposée, « rester » limité aux branches sans identifiant dans leur nom). Aucun écart non tracé.

## 3. Choix techniques
- La source du chantier actif est un champ `source` de `activeChantier` (`branch`, `commits`, `null`), exposé tel quel (`chantierSource`) : le skill `new` et l'affichage s'appuient dessus.
- Base de comparaison : première référence existante parmi `origin/HEAD`, `origin/main`, `origin/master`, `main`, `master` (`origin/HEAD` manque dans les clones cloud).
- Branche par défaut reconnue par le nom court de la base résolue seulement (`decisions.md`).
- `git log -n 200` : coût borné sur une branche longue.
- Sur une branche imposée, `/atelier:new` commite et pousse le brouillon dès son écriture : c'est ce commit qui rend le chantier actif avant `set-tdd`.

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs` : `activeChantier` (point d'entrée, utilisé par tous les hooks et commandes), `chantierIdFromCommitSubjects` (logique pure), `defaultBaseRef`, `branchCommitSubjects`, `defaultBranchName`, `chantierIdFromBranchCommits`, `gitOutput`.
- `plugins/atelier/lib/cli.mjs` : `commandStatus`, `formatStatus`, `hookSessionStart` (`chantierSource` et « (déduit des commits) »).
- `plugins/atelier/skills/new/SKILL.md` : §1, §3 (points 3 et 6), §7.
- `plugins/atelier/test/core.test.mjs` : section TEC-6 (dépôts git temporaires, origine locale nue).
- Docs : `site/fondations/chantier.md` (« Le chantier actif »), `site/reference/limites.md` (« Le chantier déduit des commits »).

## 5. Pistes écartées
- Fichier versionné nommant le chantier : fusionné dans `main` avec la PR, qui aurait alors un chantier actif.
- Réglage local (`git config branch.<nom>.atelier`) : disparaît avec le conteneur cloud.
- Exclure `main` et `master` en dur quelle que soit la base (`decisions.md`).
- `git for-each-ref` en un appel pour trouver la base (`decisions.md`).
- Rebaser la branche sur `main` après la fusion de TEC-5 : aurait réécrit `tests_commit` et les commits de signature ; fusion de `main` choisie.

## 6. Dette et suites
- Identifiant présent par hasard dans un nom de branche imposé (`users/bob/fix-12-crash`) : lu comme un chantier. Règle antérieure à TEC-6, documentée dans `limites.md` ; à reprendre si cela gêne en pratique (par exemple exiger le format `<type>/<ID>-<slug>` complet).
- Limites documentées : fusion par squash ou rebase, branches longues, `origin/main` périmé, plusieurs chantiers sur une branche imposée, branche créée depuis une branche de chantier non fusionnée.
- Réglage `defaultBranch` dans `.claude/atelier.json` : à ajouter seulement si la résolution automatique échoue en pratique.
- Aucun test automatique ne couvre le texte des skills ; le parcours `/atelier:new` sur une branche imposée n'a été vérifié qu'en rejouant ses commandes.

## 7. Verdict de revue
Quatre tours (`revue.md`), commit revu final 1573f09, base ab8398c.
- Tour 1 (a18d712) : aucun bloquant ; `git log` borné, doublon `gitOutput` supprimé, coût git dans la spec, V-7 à V-9 ajoutés, TEC-5 intégré par fusion, commit 638d78a hors convention écarté.
- Tour 2 (e3436b8) : un bloquant (`set-tdd` avant le commit du brouillon sur une branche imposée), traité par amendement, V-10 et correction du skill.
- Tour 3 (8b98d51) : un bloquant (« rester » proposé sur la branche conforme d'un autre chantier), traité par amendement et correction du skill ; identifiant fortuit dans un nom de branche documenté comme limite.
- Tour 4 (1573f09) : aucun point.
- Exceptions acceptées : aucune.
- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-20
