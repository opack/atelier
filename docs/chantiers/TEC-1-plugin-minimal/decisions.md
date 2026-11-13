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
