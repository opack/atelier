# Décisions : FEAT-27 Modèle et effort réglés par étape

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-23 : régler le modèle et l'effort par sous-agent, pas dans l'en-tête des skills
- Contexte : essais avec un plugin jetable (Claude Code 2.1.331), installé par `claude plugin install --config`, puis lancé par `claude -p "/<plugin>:<skill>" --output-format stream-json --verbose`. Le champ `message.model` des réponses donne le modèle réellement utilisé.
  - `model: ${user_config.x}` dans l'en-tête d'un skill n'est pas remplacé : erreur 404 de l'API (« There's an issue with the selected model »). `effort: ${user_config.x}` est ignoré (« invalid effort » dans le journal de debug).
  - `model: haiku` et `effort: low` écrits en dur fonctionnent : tout le tour tourne en `claude-haiku-5-5`, alors que la session est en Opus.
  - `${user_config.x}` est remplacé dans le corps du skill. Une option non réglée y reste sous forme de texte littéral, même si le manifeste lui donne un `default`.
  - Un sous-agent qui écrit un fichier déclenche le hook `PreToolUse` du plugin, qui peut le bloquer. La fin du sous-agent déclenche `SubagentStop` ; `Stop` se déclenche à la fin du tour principal.
- Écarté : `model` / `effort` dans l'en-tête des skills, parce que figés, valables pour le tour seulement et impossibles à surcharger ; des variantes de commande (`build-opus`), parce que c'est du bruit.
- Conséquence : les étapes coûteuses passent par des sous-agents lancés avec `model` et `effort` à l'appel. La valeur est résolue par le code (argument, option utilisateur, défaut).

## 2026-11-24 : revue en effort `high`
- Contexte : la demande initiale proposait `medium`.
- Écarté : `medium`, parce que `site/agent/modes.md` place la revue en effort élevé.
- Conséquence : `reviewer` et `spec-critic` en `opus` / `high`.

## 2026-11-24 : traitement de la relecture de spec (SB1 à SB4, SD1 à SD11)
- Contexte : la relecture critique a soulevé 4 points bloquants et 11 à discuter, tous intégrés à la spec avant signature.
- Écarté :
  - `inherit` comme modèle (SB1), parce qu'un sous-agent lancé sans `model` prend celui de son en-tête, pas celui de la session ;
  - l'injection automatique du tableau des défauts dans le site (SD8), parce qu'un test de concordance suffit.
- Conséquence : liste fermée d'alias, argument réservé à `implementer` dans `build`, tout le code de `build` passe par `implementer`.

## 2026-11-24 : la résolution vit dans `lib/agent-settings.mjs`, la commande attend REF-29
- Contexte (SD10) : `core.mjs` dépasse 1 700 lignes ; l'EPIC-17 limite les modules à 400 lignes, et REF-29 (lot 2) interdit de toucher `core.mjs` et `cli.mjs` pendant qu'il tourne.
- Écarté :
  - ajouter la logique dans `core.mjs`, parce que ça alourdit ce que REF-29 découpe ;
  - tout geler jusqu'à REF-29, parce que les tranches 1 et 2 n'entrent pas en conflit.
- Conséquence : module de domaine pur, sans réexport par la façade. La commande est branchée dans `lib/cli/agent-settings.mjs` en tranche 3, après REF-29.

## 2026-11-24 : options `userConfig` avec une liste `options`
- Contexte : le schéma du manifeste accepte `options` sur une option de type `string`, et `claude plugin validate` l'accepte.
- Écarté : un champ libre, parce qu'il laisse passer des fautes de frappe.
- Conséquence : choix fermé dans `/plugin configure`. Le code ignore quand même une valeur hors liste (CA-6).

## 2026-11-24 : traitement du contrôle de surapprentissage, tranche 1 (OD1 à OD5)
- OD1, corrigé : un nom de sous-agent hérité d'`Object.prototype` (`toString`) passait la garde. La recherche du défaut se fait désormais avec `Object.hasOwn`, et un sous-agent inconnu est refusé.
- OD2, accepté : le reste est recollé avec une seule espace. Sans effet sur une tranche de SPIKE, seul reste utile.
- OD3, reporté (tranche 4) : `/atelier:build inherit` ou `/atelier:build claude-opus-5-5` prend le mot pour une tranche, sans avertissement, comme le veut CA-5. La garde se fera dans `build`, qui refuse une tranche absente du plan.
- OD4, accepté : une option invalide est signalée même quand l'argument l'emporte. Elle reste à corriger, donc l'avertissement est utile.
- OD5, signalé à Didier : tests faibles (refus sans `model: null` vérifié, combinaison d'options invalides, sous-agent inconnu non testé). Les renforcer demande de rouvrir les tests.

## 2026-11-24 : noms des options avec `_` à la place de `-`
- Contexte : une clé `userConfig` n'accepte que des lettres, des chiffres et `_`. La spec écrit `${user_config.<agent>_model}`.
- Écarté : renommer les agents `overfit-checker` et `spec-critic`, parce que leur nom est déjà cité partout (skills, site, revues passées).
- Conséquence : `overfit_checker_model`, `spec_critic_effort`, etc. Les avertissements de la résolution citent ce nom d'option.

## 2026-11-24 : traitement du contrôle de surapprentissage, tranche 2 (OB1, OD6 à OD10)
- OB1, corrigé : la description des options d'`overfit-checker` disait que l'argument de la commande l'emportait, ce qui est faux (SB2).
- OD6, corrigé : `modes.md` précise que, dans `build`, l'argument ne règle qu'`implementer`.
- OD7, corrigé : élision dans les titres des options (« d'implementer »).
- OD8, à vérifier : si `/plugin configure` enregistre les `default` préremplis, l'annonce dira « (utilisateur) » et un futur changement de défaut n'atteindra pas cet utilisateur. Vérification à faire en local par Didier, avant la clôture ; si c'est confirmé, amender la spec pour retirer les `default`.
- OD9 : la spec écrit `${user_config.<agent>_model}`, une clé invalide pour un nom à tiret. Un amendement est proposé à Didier avant les tests de la tranche 4.
- OD10, comme OD5 : des tests faibles (copie locale des défauts, regex lâches de CA-13) sont signalés sans rouvrir les tests. Le contenu réel est correct.

## 2026-11-24 : traitement du contrôle de surapprentissage, tranche 3 (OD11, OD12)
- OD11, corrigé : une option répétée (`--args 'opus sonnet' --args ''`) écrasait la précédente et contournait le refus de CA-7. Une option répétée est maintenant refusée (code 1).
- OD12, comme OD5 et OD10 : les tests de la commande sont un peu faibles (option utilisateur valide non transmise de bout en bout, refus de deux efforts non testé par la commande). Le module d'entrées / sorties est mince et la logique est couverte en tranche 1, donc on ne rouvre pas les tests.

## 2026-11-24 : traitement du contrôle de surapprentissage, tranche 4 (OD13 à OD16)
- OD3 (reporté de la tranche 1) et OD13, corrigés : `build` sépare les deux cas du reste de l'argument. En `SPIKE` sans TDD, c'est la tranche, et une tranche absente du plan fait arrêter. Ailleurs, un numéro de tranche est ignoré et tout autre mot fait arrêter (modèle mal écrit, `inherit`).
- OD14, corrigé : après un « Arrêt : test à revoir », `build` répond au hook de fin sans relancer `implementer`.
- OD15, corrigé : la voie sans TDD reprend l'arrêt sur un test faux et la consignation des décisions.
- OD16, corrigé : un nombre pair d'apostrophes dans l'argument permettait de sortir des guillemets simples et d'injecter du shell. Les trois skills refusent maintenant tout argument qui contient une apostrophe, avant de lancer la commande. La garantie de la §6 repose donc sur cette consigne, en plus des guillemets.
- Remarque mineure, corrigée : `review` précise que la correction confiée à `/atelier:build` passe par `atelier:implementer`.
- Tests jugés faibles (CA-11, CA-12, consignes non testées) : comme OD5, OD10 et OD12, on ne rouvre pas les tests.

## 2026-11-25 : traitement du contrôle de surapprentissage, tranche 5 (OB2, OB3, OD17 à OD21)
- OB2, OB3, OD17, OD18, corrigés : `site/cycle/implementation.md` décrit la délégation à `implementer` (`build` relance les contrôles et `implementer` ; `build` résume, fait valider et commite ; arrêt sur un test faux présenté par `build` ; décisions consignées par `build`).
- OD19, OD20, corrigés : dans `commandes.md`, l'ordre des mots de l'argument de `build` est libre, un mot inconnu fait arrêter hors `SPIKE` sans TDD ; `atelier agent-settings` rend aussi `rest` et refuse un sous-agent inconnu ou une option répétée.
- OD21, comme OD5, OD10 et OD12 : les tests de CA-14 ne vérifient que des mots clés (SD9 : la doc reste libre). On ne rouvre pas les tests ; la justesse du texte est vérifiée en revue.
- RD1 : rien à faire, `CLAUDE.md` décrit déjà les modules de domaine de `lib/` depuis REF-29.
- Version : 0.6.0 et non 0.5.0, prise par FEAT-30 qui fusionne avant (décision de Didier, 2026-11-25). À la fusion de `main`, garder 0.6.0.

## 2026-11-25 : revue du chantier, RD10 et suites (OD22, OD23)
- RD10 : vérifié en local par Didier, « save » dans `/plugin configure` enregistre les valeurs affichées. Spec amendée : chaque option propose `recommandé (<valeur>)`, préremplie, traitée comme non réglée quelle que soit la parenthèse, pour suivre la valeur recommandée de la version installée.
- OD22, OD23 : « défaut » mêlait « non réglé » et « valeur de la version ». Le mot devient « recommandé » côté utilisateur (valeur d'option, source de l'annonce, tableau de `modes.md` « Valeurs recommandées ») ; `configuration.md` renvoie à `modes.md` au lieu de recopier les valeurs. Pas de page dédiée : le tableau de `modes.md` est déjà la source unique, vérifiée par un test.
- `recommandé\s*(` toléré sans espace : refuser des saisies inoffensives n'apporte rien.
