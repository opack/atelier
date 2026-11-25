# Bilan : FEAT-27 Modèle et effort réglés par étape

## 1. Résumé
Les étapes coûteuses et sans dialogue d'atelier tournent dans des sous-agents dont le plugin règle le modèle et l'effort : `implementer` (nouveau, écrit tout le code de `/atelier:build`), `overfit-checker`, `reviewer` et `spec-critic`. Chacun se résout par l'argument de la commande, puis l'option utilisateur (`/plugin configure atelier`), puis la valeur recommandée de la version installée, et la commande annonce ce qu'elle utilise. Livré en 5 tranches TDD, plus un amendement après la revue du chantier ; version 0.6.0.

## 2. Livré vs spécifié
Tous les tests sont dans `plugins/atelier/test/agent-settings.test.mjs`.

| Critère | Statut | Test |
|---|---|---|
| CA-1 : valeurs recommandées sans option ni argument | livré | « sans option ni argument, chaque sous-agent reçoit son défaut… » |
| CA-2 : option de modèle seule | livré | « une option de modèle seule l’emporte sur le défaut… » |
| CA-3 : option non réglée (placeholder, vide, `recommandé (…)`) | livré (amendé) | « une option non réglée… », « une option « recommandé (…) » compte comme non réglée… » |
| CA-4 : l'argument l'emporte | livré | « l’argument l’emporte sur les options et le défaut… » |
| CA-5 : reste de l'argument | livré | « les mots non reconnus sont rendus comme reste… », « rend en JSON… » |
| CA-6 : option invalide ignorée avec avertissement | livré | « une option invalide est ignorée… » |
| CA-7 : deux valeurs différentes refusées | livré | trois tests (fonction, commande, option répétée) |
| CA-8 : casse | livré | deux tests (options, argument) |
| CA-9 : reste ignoré hors `implementer` | livré | « un reste pour reviewer ou spec-critic… » |
| CA-10 : défauts concordants (manifeste, agents, `modes.md`) | livré (amendé) | trois tests |
| CA-11 : appel de la commande dans les skills | livré | deux tests |
| CA-12 : `build` délègue tout le code à `implementer` | livré | « build confie tout le code à implementer… » |
| CA-13 : contrat d'`implementer` | livré | « l’agent implementer peut éditer… » |
| CA-14 : documentation | livré | cinq tests (mots clés, la justesse du texte vérifiée en revue) |

Écarts par rapport à la spec signée, tous amendés : noms d'options en `_` (OD9) ; valeur `recommandé (…)` et source « recommandé » (RD10, OD22, OD23, après vérification locale de Didier). Version 0.6.0 au lieu de 0.5.0, prise par FEAT-30.

## 3. Choix techniques
- La résolution vit dans le code (`lib/agent-settings.mjs`), pas dans le frontmatter : `${user_config.*}` n'y est pas substitué (essai du 23/11/2026, le modèle cassait en 404).
- Les skills appellent `atelier agent-settings` avec les valeurs substituées entre guillemets simples, et refusent tout argument ou option qui contient une apostrophe (OD16, RD6).
- Liste fermée de modèles et d'efforts : une valeur hors liste n'atteint jamais l'appel du sous-agent.
- `recommandé (…)` préremplie et traitée comme non réglée quelle que soit la parenthèse : « save » sans rien changer ne fige plus les valeurs du jour.
- `build` n'écrit plus de code : `implementer` code, `build` lance les contrôles, relance, fait valider et commite.

## 4. Éléments de code principaux
- `plugins/atelier/lib/agent-settings.mjs` : `resolveAgentSettings`, `AGENT_DEFAULTS` (source unique des valeurs recommandées), liste fermée.
- `plugins/atelier/lib/cli/agent-settings.mjs` : commande `atelier agent-settings` (JSON, codes de sortie 1 et 2).
- `plugins/atelier/.claude-plugin/plugin.json` : les 8 options `userConfig`.
- `plugins/atelier/agents/implementer.md` : contrat de l'agent qui code.
- `plugins/atelier/skills/{build,review,sign}/SKILL.md` : bloc « Modèle et effort des sous-agents ».
- `site/agent/modes.md` : tableau des valeurs recommandées et ordre de résolution.

## 5. Pistes écartées
- `model` / `effort` dans le frontmatter des skills : valables pour le tour seulement, et `${user_config}` n'y est pas substitué.
- Réglage par projet dans `.claude/atelier.json` : hors périmètre ; l'option utilisateur suffit.
- Retirer les `default` du manifeste : comportement de l'écran de configuration inconnu pour un champ vide.
- Une page dédiée aux valeurs recommandées : doublon du tableau de `modes.md`, déjà vérifié par un test.

## 6. Dette et suites
- Au premier changement d'une valeur recommandée : vérifier ce que `/plugin configure` affiche pour une valeur enregistrée périmée (`recommandé (sonnet)` après un passage à opus), et ajuster la phrase de `configuration.md` si besoin.
- Les tests de consignes et de doc ne vérifient que des mots clés (OD5, OD10, OD12, OD21, RD13) : la justesse du texte repose sur la revue.
- Branche distante `claude/project-thread-wteqe5` à supprimer à la main (403 du proxy).

## 7. Verdict de revue
Revues des tranches 1 à 5 et deux revues du chantier : aucun point bloquant.

| Point | Traitement |
|---|---|
| RD1 | sans objet : REF-29 a déjà mis `CLAUDE.md` à jour |
| RD2 | corrigé (baa3a52) |
| RD3 | corrigé (1431167) |
| RD4 | écarté : réécrire une fusion déjà poussée coûte plus que le gain |
| RD5 | écarté : cas improbable, échec bruyant et sans dommage |
| RD6 | corrigé (f1edfac) |
| RD7 | écarté : déjà rattrapé par le hook de fin et `tests-changed` |
| RD8 | corrigé (f1edfac) |
| RD9 | corrigé (c8543c3) |
| RD10 | spec amendée (54fe0e9, 0122333), corrigé (e02591e) |
| RD11 | corrigé (e02591e) |
| RD12 | corrigé (e02591e) |
| RD13 | écarté (Didier) : on ne rouvre pas les tests pour une ligne de doc |

- Verdict : accepté
- Validé par : Didier (Opack)
- Date : 2026-11-25
