# Décisions : TEC-1 Plugin atelier minimal

## 2026-11-09 : code écrit avant la signature de la spec
- Contexte : chantier d'amorçage ; l'outil qui bloque le code avant signature n'existait pas encore.
- Conséquence : commits marqués `Atelier-Bypass`. La spec est à relire et signer par le propriétaire du dépôt avant fusion ; le bilan sera écrit après l'essai sur envo-admin.

## 2026-11-09 : une CLI Node sans dépendance partagée par les skills et les hooks
- Contexte : les skills ont besoin d'opérations déterministes (identifiant suivant, complétude de spec, signature) et les hooks de la même logique.
- Écarté : tout faire en prose dans les skills, parce que la complétude et le blocage doivent être vérifiables et testés.
- Conséquence : logique pure dans `lib/core.mjs`, testée avec `node:test` ; `bin/atelier` exposé aux skills par le `bin/` du plugin.

## 2026-11-09 : état du chantier dans l'en-tête de spec.md, chantier actif déduit de la branche
- Écarté : un fichier d'état séparé ou une base, parce que l'état doit survivre au plugin et se lire dans git.
- Conséquence : statuts `draft | signed | done | abandoned` ; pas de statut « en cours », la prochaine étape se déduit des fichiers présents.

## 2026-11-09 : réécriture d'une spec signée bloquée, éditions ciblées autorisées
- Contexte : historiser sans réécrire.
- Écarté : bloquer toute édition de la spec signée, parce que les amendements datés doivent rester possibles.

## 2026-11-09 : le hook Stop ne lance les contrôles que si du code a changé hors des documents
- Contexte : éviter de lancer la suite de tests à chaque fin de réponse purement conversationnelle ou documentaire.

## 2026-11-09 : installation par la marketplace GitHub, déclaration au niveau projet par init
- Contexte : installer et mettre à jour simplement, y compris pour une équipe.
- Écarté : `--plugin-dir` comme mode normal, parce qu'il impose un clone local et une option à chaque lancement.
- Conséquence : `/atelier:init` ajoute `extraKnownMarketplaces` et `enabledPlugins` au `.claude/settings.json` du projet ; script `npm run version:patch` à lancer avant chaque fusion, car Claude Code ne met à jour un plugin que si sa version change.
- Vérifié en réel : installation depuis `opack/atelier#<branche>`, commande `atelier` disponible dans le PATH de la session, refus d'écriture par le hook dans une session `claude -p`.

## 2026-11-13 : le cycle TDD est appliqué par les hooks, pas seulement décrit
- Contexte : workflow Anthropic « write tests, commit; code, iterate, commit ». Les consignes en prose (« n'écris pas d'implémentation », « ne modifie pas les tests ») se perdent ; le hook ne se perd pas.
- Conséquence : phase déduite de la spec (`tests_commit` absent → tests d'abord, présent → implémentation). Pendant les tests, seuls les fichiers de `testPaths` sont modifiables ; pendant l'implémentation, ils sont en lecture seule et le hook de fin détecte toute modification, même par shell ou commit.
- Écarté : laisser l'agent créer des stubs pendant la phase tests, parce que c'est précisément ce qu'Anthropic demande d'éviter ; un import vers un module inexistant est un échec « pour la bonne raison ».
- Écarté : lancer les contrôles en fin de tour pendant la phase tests, parce que des tests rouges y sont attendus et que l'agent bouclerait.
- Limite connue : une implémentation codée en dur passe les tests ; seul le sous-agent `overfit-checker` (et la revue) peut l'attraper.

## 2026-11-13 : commande `build` plutôt que `slice`
- Contexte : l'étape 4 du TDD (implémenter jusqu'au vert, vérifier le surapprentissage, commiter) est le cœur du chantier ; elle couvre aussi la construction tranche par tranche prévue pour `slice`.

## 2026-11-13 : le TDD est une décision humaine par chantier, pas une règle par type
- Contexte : beaucoup de chantiers (config, montée de version, texte, mise en page, exploration, FEAT simples) ne gagnent rien à des tests d'abord ; imposer le TDD par type mène à des tests inutiles.
- Décision : champ `tdd: yes | no` obligatoire dans l'en-tête de la spec avant signature ; `/atelier:new` pose toujours la question avec une recommandation (type et contenu) ; les hooks TDD ne s'appliquent que si `tdd: yes`. Modifiable en cours de chantier par `atelier set-tdd`, tracé en amendement.
- Écarté : une valeur par défaut silencieuse par type, parce que l'humain doit toujours trancher ; et `skip-test-first`, remplacé par `set-tdd no`.
- « Non » ne veut pas dire « aucun test » : des tests là où ils ont de la valeur, pas de test pour le principe.

## 2026-11-19 : état d'atelier et champs d'en-tête hors de portée des outils d'édition
- Contexte : relecture critique avant signature ; `.claude/**` et `.atelier/**` étaient des chemins libres, donc l'agent pouvait débrayer ou désactiver atelier, et passer lui-même une spec à `signed` par un `Edit`.
- Conséquence : `.atelier/**` refusé, `.claude/atelier.json` refusé une fois créé ; les champs `status`, `signed_by`, `signed_at`, `done_at`, `tests_commit` (et `tdd` après signature) comparés avant et après l'édition simulée (`applyToolEdit`), fins de ligne normalisées pour qu'un fichier CRLF ne fasse pas échouer la simulation.
- Écarté : bloquer le shell, parce qu'aucune analyse de commande n'est fiable ; c'est une limite assumée (spec §5).

## 2026-11-19 : hook de fin piloté par un identifiant de l'arbre de travail
- Contexte : remplace la décision du 09/11 (« seulement si du code a changé hors des documents ») : exclusion de tous les chemins libres, et trois besoins nouveaux (ne pas relancer les contrôles sur un état déjà vert, signaler une seule fois du code sans chantier signé, sortir d'une boucle sans progrès).
- Décision : l'arbre de travail est identifié par `git write-tree` sur un index séparé (`.atelier/gate-index`), qui ne touche pas l'index réel ; l'état du hook est dans `.atelier/gate.json`. Un blocage répété sur un arbre inchangé laisse l'agent s'arrêter et montre l'échec à l'utilisateur.
- Écarté : `stop_hook_active`, parce qu'il n'autorise qu'une relance forcée et casse l'itération du TDD ; une pathspec d'exclusion de `.atelier`, que git refuse quand le dossier est ignoré (trouvé à l'essai de bout en bout).
- Conséquence : la logique est dans `decideStop` (`core.mjs`), testée ; `cli.mjs` ne fait que lire, exécuter et afficher.

## 2026-11-19 : casse ignorée sous Windows et macOS
- Contexte : la spec vise Windows ; macOS a par défaut le même système de fichiers insensible à la casse, avec le même risque de fausse correspondance.
- Conséquence : `ignoreCase` déduit de la plateforme dans `loadConfig`, surchargeable dans `.claude/atelier.json`.
