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
