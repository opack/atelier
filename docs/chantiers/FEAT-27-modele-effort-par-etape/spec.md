---
id: FEAT-27
type: FEAT
title: Modèle et effort réglés par étape
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-23
signed_by:
signed_at:
rel_depends_on: TEC-15
---

# FEAT-27 Modèle et effort réglés par étape

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->

`site/agent/modes.md` pose la règle de la méthode : « plus une erreur coûte cher, plus on monte en modèle et en effort ». Le plugin ne l'applique pas.
- Les trois sous-agents (`spec-critic`, `overfit-checker`, `reviewer`) ont `model: opus` en dur. Leur effort n'est pas réglé, et personne ne peut changer l'un ou l'autre.
- `build` tourne sur le modèle de la session. Une session ouverte en Opus pour concevoir implémente donc aussi en Opus, ce qui coûte cher sans raison. À l'inverse, une session en Sonnet fait aussi relire en Sonnet.
- Si on ne fait rien, chacun règle à la main avec `/model` et `/effort` à chaque étape, ce que personne ne fait dans la durée.

Ce que permet Claude Code (doc officielle et tests du 23/11/2026 avec Claude Code 2.1.331, détails dans `decisions.md`) :
- `model` et `effort` dans l'en-tête d'un skill valent pour le tour seulement, sont figés et ne se règlent pas. `${user_config.*}` n'y est **pas** remplacé : le modèle part tel quel à l'API, qui renvoie une erreur 404.
- `${user_config.*}` est remplacé dans le **corps** d'un skill. Le `default` du manifeste n'est **pas** appliqué quand l'option n'est pas réglée : le texte `${user_config.x}` reste tel quel.
- Un sous-agent accepte `model` (un alias) et `effort` à l'appel, et ces valeurs l'emportent sur son en-tête.
- Le hook `PreToolUse` s'applique aux éditions d'un sous-agent. `Stop` se déclenche à la fin du tour principal, et la fin d'un sous-agent déclenche `SubagentStop`.

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->

Les étapes coûteuses et sans dialogue sont confiées à des sous-agents, dont atelier règle le modèle et l'effort :

| Sous-agent | Lancé par | Modèle par défaut | Effort par défaut |
|---|---|---|---|
| `implementer` (nouveau) | `/atelier:build` | `sonnet` | `medium` |
| `overfit-checker` | `/atelier:build` | `opus` | `medium` |
| `reviewer` | `/atelier:review` | `opus` | `high` |
| `spec-critic` | `/atelier:sign` | `opus` | `high` |

Pour chaque sous-agent, le modèle et l'effort se résolvent séparément, du plus fort au plus faible :
1. **l'argument de la commande** (`/atelier:build opus`, `/atelier:review medium`, `/atelier:build opus high`). Il vaut pour cet appel seulement ;
2. **l'option de l'utilisateur**, réglée une fois avec `/plugin configure atelier` (`implementer_model`, `implementer_effort`, etc.). Elle vaut pour tous les projets de cet utilisateur ;
3. **le défaut**, écrit dans le code et repris dans le manifeste, l'en-tête des agents et le site.

Avant de lancer le sous-agent, le skill annonce ce qu'il utilise et d'où vient chaque valeur, par exemple « implementer : sonnet / medium (défaut) ».

`/atelier:build` ne code plus lui-même. Il confie l'implémentation de la tranche à `implementer`, puis garde la main pour le reste : `overfit-checker`, le résumé, la validation de l'utilisateur et le commit. Les règles de `build` (tests intouchables, arrêt si un test semble faux) passent dans l'agent `implementer`.

**Hors périmètre**
- Les étapes de dialogue (`new`, `amend`, `sign` hors relecture, `plan`, `write-tests`, l'orchestration de `review`, `close`, `status`) gardent le modèle de la session. On y recommande `opusplan` pour `plan`, dans `modes.md` seulement.
- Pas de réglage au niveau du projet (`.claude/atelier.json`), pas de champ de criticité, pas de variantes de commande (`build-opus`…).
- Pas de défaut en Haiku.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

- **CLI** : une commande, par exemple `atelier agent-settings <agent> --user-model <v> --user-effort <v> --args "<arguments>"`. Le skill y passe `${user_config.<agent>_model}`, `${user_config.<agent>_effort}` et `$ARGUMENTS`. Elle renvoie en JSON le modèle, l'effort, la source de chaque valeur, les avertissements et les arguments restants (la tranche d'un `SPIKE` pour `build`). La logique de résolution est une fonction pure de `core.mjs`, testée.
- **Valeurs acceptées** : pour le modèle `sonnet`, `opus`, `haiku`, `fable`, `inherit`, ce qu'accepte l'appel de l'Agent ; pour l'effort `low`, `medium`, `high`, `xhigh`, `max`. `inherit` signifie que le skill lance le sous-agent sans paramètre `model`.
- **Manifeste** (`plugins/atelier/.claude-plugin/plugin.json`) : `userConfig` avec 8 options facultatives (4 agents × modèle et effort). Le `default` y est seulement indicatif : la valeur effective vient du code.
- **Agents** : `plugins/atelier/agents/implementer.md` (nouveau : outils Read, Edit, Write, Bash, Grep, Glob ; en-tête `model` et `effort` égaux aux défauts). Les trois autres reçoivent aussi `effort` dans leur en-tête.
- **Skills** : `build`, `review`, `sign`.
- **Site** : `site/agent/modes.md` (tableau des défauts, ordre de résolution, `opusplan`), `site/reference/configuration.md` (les options), `site/reference/commandes.md` (arguments de `build`, `review`, `sign`).
- **Hook de fin** : quand `hook-gate` renvoie au travail après le retour d'`implementer`, `build` relance `implementer` avec les échecs, sans coder lui-même.
- **Rangement** : la nouvelle logique va dans le module que l'EPIC-17 (lot 2) prévoit pour la configuration, s'il existe au moment de l'implémentation.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

1. **Ordre avec l'EPIC-17, lot 2** (rangement de `lib/`, qui interdit tout autre chantier sur `lib/` pendant qu'il tourne) : attendre ce lot, ou passer avant ? Proposé : passer avant si le lot 2 n'est pas ouvert à la signature, car le chantier ajoute une seule fonction pure.
2. **Options demandées à l'activation** : Claude Code demande-t-il les 8 options à l'installation, même facultatives ? Si oui, ce bruit justifie-t-il d'en réduire le nombre ? À vérifier pendant le plan.
3. **Modèle refusé par l'organisation** (`availableModels`) pour un sous-agent : le comportement n'est pas documenté. Proposé : si l'appel échoue pour cette raison, le skill relance sans `model` et le dit.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

- [ ] CA-1 : Étant donné aucune option réglée et aucun argument, quand on résout les réglages de chacun des quatre sous-agents, alors on obtient les défauts du tableau de la §2, avec la source « défaut » pour le modèle et pour l'effort.
- [ ] CA-2 : Étant donné une option utilisateur valide pour le modèle seulement (`reviewer_model = sonnet`), quand on résout les réglages du `reviewer`, alors le modèle vaut `sonnet` (source « utilisateur ») et l'effort reste le défaut `high` (source « défaut »).
- [ ] CA-3 : Étant donné une option non réglée, transmise comme le texte littéral `${user_config.reviewer_model}` ou comme une chaîne vide, quand on résout, alors elle est traitée comme absente, sans avertissement.
- [ ] CA-4 : Étant donné l'argument `opus high` pour `implementer` et des options utilisateur réglées autrement, quand on résout, alors on obtient `opus` / `high` avec la source « argument » pour les deux. Avec l'argument `opus` seul, seul le modèle vient de l'argument.
- [ ] CA-5 : Étant donné l'argument `2 opus` pour `build` (tranche d'un `SPIKE` et modèle), quand on résout, alors le modèle vaut `opus` et les arguments restants valent `2`. Un argument sans modèle ni effort est rendu intact.
- [ ] CA-6 : Étant donné une valeur inconnue (`gpt` comme modèle en option, `ultra` comme effort en argument), quand on résout, alors elle est ignorée au profit du niveau suivant, et un avertissement en français la nomme avec sa provenance. Elle n'apparaît jamais comme modèle ou effort résolu.
- [ ] CA-7 : Étant donné deux modèles (`opus sonnet`) ou deux efforts dans un même argument, quand on résout, alors la commande échoue avec un message qui nomme les deux valeurs, et rien n'est résolu.
- [ ] CA-8 : Étant donné `inherit` comme modèle, quand on résout, alors le modèle résolu indique au skill de lancer le sous-agent sans paramètre `model`. `inherit` comme effort est refusé comme valeur inconnue (CA-6).
- [ ] CA-9 : Étant donné le plugin livré, quand on compare, alors le manifeste déclare pour chacun des quatre sous-agents une option de modèle et une d'effort, facultatives. Leurs `default`, l'en-tête `model` / `effort` de chaque agent et le tableau de `site/agent/modes.md` sont identiques aux défauts du code.
- [ ] CA-10 : Étant donné les skills `build`, `review` et `sign`, quand on les lit, alors chacun appelle la résolution avec `${user_config.<agent>_model}`, `${user_config.<agent>_effort}` et `$ARGUMENTS`, annonce le modèle, l'effort et leur source, et passe `model` et `effort` à l'appel du sous-agent.
- [ ] CA-11 : Étant donné le skill `build`, quand on le lit, alors il confie l'implémentation à `atelier:implementer`, n'écrit pas de code lui-même, et relance `implementer` quand le hook de fin renvoie au travail. L'agent `implementer` interdit de modifier les tests et impose de s'arrêter en expliquant pourquoi quand un test semble faux.
- [ ] CA-12 : Étant donné le site, quand on le construit, alors `modes.md` présente les défauts par étape, l'ordre de résolution (argument, option, défaut) et `opusplan`, et `configuration.md` liste les 8 options.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : seules des valeurs d'une liste fermée sont transmises à l'appel du sous-agent (CA-6). Les garde-fous (spec signée, tests figés, contrôles de fin) s'appliquent toujours au code écrit par `implementer`, ce qui a été vérifié le 23/11/2026.
- Performance : coût en baisse sur `build` (Sonnet au lieu du modèle de la session), en hausse sur la revue et la relecture de spec (effort `high`). C'est voulu par la règle de `modes.md`.
- Accessibilité : N/A, aucune interface graphique.
- Données personnelles : N/A, aucune donnée personnelle manipulée.
- Compatibilité : Node ≥ 20, aucune dépendance. Nécessite une version de Claude Code qui gère `userConfig` dans les skills, ainsi que `model` et `effort` à l'appel d'un sous-agent. Si `CLAUDE_CODE_EFFORT_LEVEL` ou `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` sont définis, ils l'emportent : le site le dit.

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

Les essais du 23/11/2026 sont à rejouer avec un plugin jetable installé par `claude plugin install --config` : option dans l'en-tête, dans le corps, option non réglée, hook `PreToolUse` sur un sous-agent. Leur protocole et leurs résultats seront reportés dans `decisions.md` au plan.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
