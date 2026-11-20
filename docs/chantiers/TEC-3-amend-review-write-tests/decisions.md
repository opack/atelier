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

## 2026-11-20 : conception (plan)
- Amorçage, **option A** : TEC-3 est revu et clôturé avec la 0.2.0 locale (`claude --plugin-dir ./plugins/atelier`), donc soumis à `review` → `reviewed_commit` → `close-check`. Écarté : clôturer avec la 0.1.1 installée (plus simple, mais on clôturerait sans revue le chantier qui la rend obligatoire, et on perdrait le meilleur rejeu possible).
- Refus de la CLI (`reopen-tests`, `set-reviewed`, `set-status draft`) écrits comme fonctions pures dans `core.mjs`, testées sans dépôt git. Écarté : tests d'intégration sur des dépôts temporaires (lents, fragiles sous Windows) ; le vrai git est couvert par le rejeu de bout en bout.
- « Aucun changement de code non commité » dans `close-check` utilise le même ensemble de chemins que la détection des commits de code (`.claude/**` compte comme du code). C'est la lecture la plus cohérente de la spec ; pas d'amendement.
- Playwright lancé hors du projet (dossier temporaire), pour garder `site/` sans dépendance de test.

## 2026-11-20 : tranche 1, lecture de la section « Amendements »
- La section s'arrête au titre suivant de niveau 1 ou 2 ; un `###` à l'intérieur compte comme du texte hors entrée, donc comme du corps.
- Une ligne blanche entre deux entrées est ignorée ; une ligne indentée après une entrée (même après une ligne blanche) en est la suite. Espaces de fin de ligne ignorés.
- `appendAmendmentEntry` insère après la dernière ligne non vide de la section (les lignes blanches avant le titre suivant restent) et garde les fins de ligne du fichier. Avec plusieurs sections, la première est utilisée : la garde refuse de toute façon une section en double.
- Écarté : vérifier que la date d'une entrée existe au calendrier (la spec demande « au bon format » seulement).

## 2026-11-20 : tranche 2, garde sur la spec non brouillon
- Version commitée lue par `git ls-files --with-tree=HEAD -- ":(icase,literal)<chemin>"`, puis `git rev-parse --verify --quiet HEAD:<chemin>` et `git show`. `--with-tree` retrouve aussi une spec retirée de l'index (`git rm --cached`) ; `literal` évite qu'un `*` du chemin soit lu comme un motif. Pas encore de commit (`HEAD` absent) ou fichier absent de `HEAD` : le fichier actuel sert de référence ; toute autre sortie de git : refus. Écarté : `git ls-tree`, qui refuse `:(icase)`.
- Champs d'en-tête comparés à la référence : les clés lues par `parseFrontMatter` (lignes `clé: valeur`). Une ligne d'en-tête qui n'est pas de cette forme n'est pas comparée ; limite assumée, l'en-tête des templates n'en contient pas.
- Le contrôle des champs réservés reste fait en premier et s'applique aussi en brouillon, comme avant ; les règles propres à la spec non brouillon (champs figés, entrées) viennent ensuite.
