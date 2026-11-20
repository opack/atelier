# Décisions : TEC-3 Amender la spec, rouvrir les tests, séparer revue et clôture

## 2026-11-20 : la garde compare le corps de la spec signée à sa version commitée
- Contexte : un `Edit` ne remplace qu'un passage ; exiger l'entrée d'amendement *dans la même édition* que le changement de corps obligerait à des éditions géantes (section 3 et section « Amendements » éloignées).
- Décision : référence = version commitée (`HEAD`) si elle n'est pas en brouillon, sinon le fichier actuel. L'agent écrit l'entrée, puis modifie le corps en autant d'éditions que nécessaire ; le commit `amend spec` remet la référence à jour.
- Écarté : comparer au fichier actuel (une édition = une entrée, impraticable) ; vérifier que l'entrée décrit bien la modification (invérifiable : c'est la re-signature humaine qui juge).

## 2026-11-20 : relecture critique avant signature (spec-critic)
- Retenus : condition d'application évaluée sur `HEAD` et le fichier, `set-status draft` refusé hors brouillon (sinon contournement complet) ; champs réservés comparés au fichier actuel, corps à la référence ; `id` et `type` figés après signature ; regel détecté par les entrées « tests rouverts » / « tests regelés » ; entrées de la CLI insérées dans la section « Amendements » ; normalisation CRLF ; spec propre exigée avant `amend` ; `reviewed_commit` en hash complet ; un amendement après la revue l'invalide ; `SPIKE` sans revue obligatoire ; inclusion de `revue.md` sur le site ; tests des refus de la CLI.
- Assumé : une fusion de la branche par défaut après la revue impose une nouvelle revue ; une entrée ajoutée par la CLI et non commitée autorise aussi une modification du corps (trace présente, contenu jugé par l'humain).

## 2026-11-20 : documenter où se lancent les commandes, et le lancement en une fois
- Contexte : retour de l'utilisateur. La doc (et ma consigne de signature) laissait croire que `atelier` est utilisable dans un terminal ; il n'est sur le `PATH` que du shell de Claude Code.
- Décision : intégré à TEC-3 (le site est déjà dans le périmètre). Commandes `/atelier:*` dans une conversation Claude Code ; CLI hors de Claude Code par `node <plugin>/bin/atelier` ; lancement en une fois par `claude "/atelier:…"` ou `claude -p "/atelier:…"` (+ `--continue` pour répondre).

## 2026-11-20 : seconde relecture critique avant signature (spec-critic)
- Retenus : chaque écriture de la CLI dans la spec (`reopen-tests`, `freeze-tests`, `set-tdd`) est commitée aussitôt, et `set-reviewed` refuse une `spec.md` non commitée. Cela **remplace** le compromis « entrée de la CLI non commitée = passe-droit » de la relecture précédente : il faisait échouer `close-check` indéfiniment et ouvrait une fenêtre d'édition libre du corps. Autres points retenus : commits de code détectés avec `--no-renames --diff-merges=first-parent` ; regel détecté par la position, avec des libellés fixes ; trois ensembles de champs explicites ; chemin dans `HEAD` résolu via `git ls-files` ; entrées de la référence = préfixe exact ; section `## Amendements` unique ; `SPIKE` exempté de toute vérification liée à la revue ; commit revu introuvable = revue obsolète ; `reviewedCommit` / `reviewState` dans `status --json` ; signature erronée traitée par `abandoned` puis un nouveau chantier ; commit `amend spec` = trace de la re-signature.
- `.claude/**` n'est pas un chemin libre pour `close-check` : sinon, on pourrait affaiblir les contrôles ou les hooks après la revue.
- Contrôles : `close-check` est lancé juste avant `set-status done`, sans cache de résultat.

## 2026-11-20 : lancement des commandes, version simplifiée
- Décision de l'utilisateur : on ne documente ni `claude -p`, ni le lancement en une fois, ni la CLI par `node`. La doc dit seulement que les commandes `/atelier:*` se lancent dans une session Claude Code ouverte sur le répertoire du projet.
- Écarté : `claude -p` (il exige des permissions pré-autorisées pour toute commande qui écrit, ce qui est fragile et trompeur) ; `node <plugin>/bin/atelier` (détail d'implémentation, pas un usage).
