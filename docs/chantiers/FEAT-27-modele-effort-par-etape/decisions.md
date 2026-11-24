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
