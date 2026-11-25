---
id: FEAT-27
type: FEAT
title: Modèle et effort réglés par étape
status: signed
tdd: yes
created_at: 2026-11-23
signed_by: Opack
signed_at: 2026-11-24
rel_depends_on: TEC-15
tests_commit: f7dd172
slice: chantier
slice_base: c8543c31c48ede8dd7f1b01fc34bd3d761b1d56a
last_slice: 5
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

**Résolution.** Pour chaque sous-agent, le modèle et l'effort se résolvent séparément, du plus fort au plus faible :
1. **l'argument de la commande** (`/atelier:build opus`, `/atelier:review medium`, `/atelier:build opus high`) ;
2. **l'option de l'utilisateur**, réglée une fois avec `/plugin configure atelier` (`implementer_model`, `implementer_effort`, etc. ; dans le nom d'une option, les tirets du nom de l'agent deviennent `_` : `overfit_checker_model`). Elle vaut pour tous les projets de cet utilisateur ;
3. **le défaut**, écrit dans le code et repris dans le manifeste, dans l'en-tête des agents et sur le site.

Règles de la résolution :
- **Valeurs acceptées (SD1)** : une liste fermée. Pour le modèle, les alias `sonnet`, `opus`, `haiku` et `fable`, sans identifiant complet ni `inherit` (SB1 : un sous-agent lancé sans `model` prend celui de son en-tête, pas celui de la session). Pour l'effort : `low`, `medium`, `high`, `xhigh` et `max`. Majuscules et minuscules sont confondues (SD2).
- **Argument (SB4)** : seuls les mots de ces deux listes y sont reconnus. Tout autre mot est un **reste**, rendu tel quel : pour `build`, c'est la tranche d'un `SPIKE` ; pour `review` et `sign`, qui n'attendent rien d'autre, il est ignoré avec un avertissement. Deux modèles différents, ou deux efforts différents, sont refusés. Une valeur répétée à l'identique est tolérée (SD2).
- **Option invalide** (une valeur hors liste) : ignorée au profit du défaut, avec un avertissement. Une option non réglée (texte `${user_config.…}` resté tel quel, vide, ou valeur `recommandé (…)`) est simplement absente : la valeur recommandée par la version installée s'applique.
- **Portée de l'argument (SB2, SD3)** : il vaut pour toute la commande, relances comprises, et il est résolu une seule fois. Dans `build`, il ne vaut que pour `implementer` : `overfit-checker` est résolu sans argument.

**Affichage (SD7).** Avant de lancer un sous-agent, le skill annonce ce qu'il utilise et d'où vient chaque valeur, par exemple « implementer : sonnet / medium (recommandé) », ainsi que les avertissements de la résolution. Si la résolution échoue (deux valeurs différentes), le skill affiche le message et s'arrête sans rien lancer. Si l'organisation refuse le modèle demandé (`availableModels`), le skill s'arrête et indique l'argument ou l'option à changer.

**`build` ne code plus lui-même (SB3).** Tout le code qu'écrit `/atelier:build` passe par `implementer` :
- l'implémentation de la tranche (TDD) ;
- l'implémentation sans TDD (`tdd: no`, et `SPIKE`), tests utiles compris ;
- les corrections des points du surapprentissage (`OB`, `OD`) ;
- les corrections pendant la revue du chantier (`slice: "chantier"`), et donc celles des points `RB` / `RD`, que `/atelier:review` fait déjà passer par `/atelier:build`.

`build` garde la main pour le reste :
- après chaque retour d'`implementer`, il lance `atelier checks` lui-même et relance `implementer` avec les échecs tant qu'un contrôle échoue (SD5) ;
- il lance `overfit-checker`, présente le résumé, demande la validation de l'utilisateur et commite ;
- il écrit dans `decisions.md` les décisions que lui rend `implementer` (SD6).

**Contrat d'`implementer` (SD6).**
- **Il reçoit** : le chemin de la spec, du plan et de `decisions.md`, la tranche en cours, les tests figés, et ce qu'il doit faire (implémenter, ou corriger tels échecs ou tels points avec leurs identifiants).
- **Il ne fait pas** : modifier un test, commiter, lancer une commande `atelier` qui change l'état du chantier, écrire dans la spec ou dans `decisions.md`.
- **Il rend** : les fichiers modifiés, le résultat des tests, les décisions prises en route. Si un test lui semble faux, il s'arrête et rend un compte rendu qui commence par « Arrêt : test à revoir », avec la raison. `build` le présente alors à l'utilisateur sans relancer.

**Hors périmètre**
- Les étapes de dialogue (`new`, `amend`, `sign` hors relecture, `plan`, `write-tests`, l'orchestration de `review`, `close` et `status`) gardent le modèle de la session. `modes.md` recommande `opusplan` pour `plan`.
- Pas de réglage au niveau du projet (`.claude/atelier.json`), pas de champ de criticité, pas de variantes de commande (`build-opus`…), pas de défaut en Haiku.
- Pas d'injection automatique du tableau des défauts dans le site (SD8) : un test vérifie qu'il concorde avec le code.
- Le message du hook de fin (« corrige l'implémentation ») ne change pas. Il s'adresse à `build`, qui relance `implementer`.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

- **Module (SD10)** : la résolution est une fonction pure dans un nouveau `plugins/atelier/lib/agent-settings.mjs`, sous 400 lignes, et non dans `core.mjs`, qui en compte déjà environ 1 800. Le chantier n'attend pas le lot 2 de l'EPIC-17 et ne lui ajoute pas de travail. Cet écart avec la règle « logique dans `core.mjs` » de `CLAUDE.md` va dans le sens de l'EPIC-17. Il sera consigné dans `decisions.md`, et `CLAUDE.md` sera mis à jour.
- **CLI** : `atelier agent-settings <agent> --user-model '<v>' --user-effort '<v>' --args '<arguments>'`. Elle renvoie en JSON le modèle, l'effort, la source de chaque valeur, les avertissements et les restes. En cas de refus, elle sort avec un code non nul et un message en français.
- **Appel depuis les skills (SD4)** : chaque valeur substituée (`${user_config.…}`, `$ARGUMENTS`) est entre guillemets simples, pour que le shell ne les interprète jamais. Un argument qui contient lui-même un guillemet simple fait échouer la commande sans rien exécuter, et le skill s'arrête (SD7).
- **Manifeste** (`plugins/atelier/.claude-plugin/plugin.json`) : `userConfig` avec 8 options facultatives (4 agents × modèle et effort). Chaque liste commence par `recommandé (<défaut actuel>)`, par exemple `recommandé (opus)`, qui est aussi le `default` de l'option : enregistrer l'écran de configuration sans rien changer laisse l'option sur le défaut du plugin, qui peut évoluer d'une version à l'autre.
- **Agents** : nouveau `plugins/atelier/agents/implementer.md` (outils Read, Edit, Write, Bash, Grep, Glob ; `model` et `effort` égaux aux défauts). Les trois autres agents reçoivent `effort` dans leur en-tête.
- **Skills** : `build`, `review`, `sign` (corps et `argument-hint`).
- **Site** : `site/agent/modes.md`, `site/reference/configuration.md`, `site/reference/commandes.md`, `site/reference/limites.md`.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

1. Claude Code demande-t-il les 8 options à l'installation, même facultatives ? Si oui, faut-il en réduire le nombre ? À vérifier au plan.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

- [ ] CA-1 : Étant donné aucune option réglée et aucun argument, quand on résout les réglages de chacun des quatre sous-agents, alors on obtient les défauts du tableau de la §2, avec la source « recommandé » pour le modèle et pour l'effort.
- [ ] CA-2 : Étant donné une option utilisateur valide pour le modèle seulement (`reviewer_model = sonnet`), quand on résout les réglages du `reviewer`, alors le modèle vaut `sonnet` (source « utilisateur ») et l'effort reste le défaut `high` (source « recommandé »).
- [ ] CA-3 : Étant donné une option non réglée, transmise comme le texte littéral `${user_config.reviewer_model}`, comme une chaîne vide ou comme une valeur `recommandé (…)` (sans tenir compte de la casse, quelle que soit la valeur entre parenthèses, même périmée : `recommandé (haiku)`), quand on résout, alors elle est traitée comme absente, sans avertissement.
- [ ] CA-4 : Étant donné l'argument `opus high` pour `implementer` et des options utilisateur réglées autrement, quand on résout, alors on obtient `opus` / `high` avec la source « argument » pour les deux. Avec l'argument `opus` seul, seul le modèle vient de l'argument.
- [ ] CA-5 : Étant donné l'argument `2 opus` pour `build`, quand on résout `implementer`, alors le modèle vaut `opus` et le reste vaut `2`. Un argument sans modèle ni effort reconnu (`2`, `ultra`) est rendu intact comme reste, sans avertissement.
- [ ] CA-6 : Étant donné une option invalide (`gpt` comme modèle, `ultra` comme effort, `inherit`, ou un identifiant complet comme `claude-opus-5-5`), quand on résout, alors elle est ignorée au profit du défaut, et un avertissement en français la nomme avec l'option d'où elle vient. Elle n'apparaît jamais comme valeur résolue.
- [ ] CA-7 : Étant donné deux modèles différents (`opus sonnet`) ou deux efforts différents dans un même argument, quand on résout, alors la commande sort avec un code non nul et un message qui nomme les deux valeurs. Avec `opus opus`, elle résout `opus` sans erreur.
- [ ] CA-8 : Étant donné `Opus HIGH` en argument et `Sonnet` en option, quand on résout, alors les valeurs sont reconnues et rendues en minuscules.
- [ ] CA-9 : Étant donné un reste pour `reviewer` ou `spec-critic` (`/atelier:review foo`), quand on résout, alors le reste est rendu avec un avertissement qui dit qu'il est ignoré. Pour `implementer`, le même reste ne donne aucun avertissement.
- [ ] CA-10 : Étant donné le plugin livré, quand on compare, alors le manifeste déclare, pour chacun des quatre sous-agents, une option de modèle et une option d'effort, facultatives. Chacune a `recommandé (<défaut du code>)` (par exemple `recommandé (opus)`) pour `default` et en tête de sa liste, suivie des valeurs de la liste fermée. L'en-tête `model` / `effort` de chaque agent et le tableau des défauts de `site/agent/modes.md` sont identiques aux défauts du code.
- [ ] CA-11 : Étant donné les skills `build`, `review` et `sign`, quand on lit leur texte, alors chacun contient l'appel `atelier agent-settings <agent>` avec `'${user_config.<option>_model}'`, `'${user_config.<option>_effort}'` (`<option>` : le nom de l'agent, tirets remplacés par `_`) et `'$ARGUMENTS'` entre guillemets simples, ainsi que la consigne de passer `model` et `effort` à l'appel du sous-agent, d'annoncer modèle, effort, sources et avertissements, et de s'arrêter si la commande échoue. `build` contient un appel pour `implementer` avec `'$ARGUMENTS'`, et un pour `overfit-checker` sans.
- [ ] CA-12 : Étant donné le skill `build`, quand on lit son texte, alors il contient `atelier:implementer` pour chacun des chemins de la §2 (tranche en TDD, sans TDD, corrections `OB` / `OD`, corrections de la revue du chantier), la consigne de lancer `atelier checks` après chaque retour d'`implementer`, et ne contient plus de consigne où `build` écrit le code lui-même.
- [ ] CA-13 : Étant donné l'agent `implementer`, quand on lit son texte, alors il interdit de modifier un test, de commiter, de lancer une commande `atelier` qui change l'état et d'écrire dans la spec ou dans `decisions.md`, et il impose le compte rendu « Arrêt : test à revoir ».
- [ ] CA-14 : Étant donné le site et les skills, quand on les lit (SD9) :
  - `modes.md` présente les défauts par sous-agent, l'ordre de résolution et `opusplan` ;
  - `configuration.md` liste les 8 options ;
  - `commandes.md` donne les arguments de `build`, `review` et `sign`, et une ligne `implementer` ;
  - `limites.md` dit que `CLAUDE_CODE_EFFORT_LEVEL` et `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` l'emportent sur la résolution annoncée ;
  - l'`argument-hint` de `build`, `review` et `sign` mentionne le modèle et l'effort.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation :
  - seules des valeurs de la liste fermée sont transmises au sous-agent (CA-6) ;
  - les valeurs substituées sont entre guillemets simples, ce qui empêche toute injection shell (CA-11) ;
  - `implementer` ne commite pas et ne change pas l'état (CA-13) ;
  - les garde-fous (spec signée, tests figés, contrôles de fin) s'appliquent au code écrit par un sous-agent, ce qui a été vérifié le 23/11/2026.
- Performance : coût en baisse sur `build` (Sonnet au lieu du modèle de la session), en hausse sur la revue et la relecture de spec (effort `high`). C'est voulu par la règle de `modes.md`.
- Accessibilité : N/A, aucune interface graphique.
- Données personnelles : N/A, aucune donnée personnelle manipulée.
- Compatibilité : Node ≥ 20, aucune dépendance. Nécessite une version de Claude Code qui gère `userConfig` dans les skills, ainsi que `model` et `effort` à l'appel d'un sous-agent. `CLAUDE_CODE_EFFORT_LEVEL` et `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` l'emportent quand ils sont définis (CA-14).

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

Les essais du 23/11/2026 sont à rejouer avec un plugin jetable installé par `claude plugin install --config` : option dans l'en-tête, dans le corps, option non réglée, hook `PreToolUse` sur un sous-agent. Leur protocole et leurs résultats seront reportés dans `decisions.md` au plan.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
- 2026-11-24 : nom des options : les tirets du nom de l'agent deviennent `_` (`overfit_checker_model`, `spec_critic_effort`), car une clé `userConfig` n'accepte que lettres, chiffres et `_` (OD9).
- 2026-11-24 : tests rouverts (gel quitté : a3eae7d6f7f0025e25e90a72d0f711c2899751f0) : REF-29 : import de parseFrontMatter depuis lib/common.mjs (RD18 de REF-29)
- 2026-11-24 : tests regelés : 7d35476
- 2026-11-25 : chaque option propose la valeur `défaut (<valeur du défaut actuel>)`, par exemple `défaut (opus)`, qui est aussi son `default` dans le manifeste ; toute valeur `défaut (…)` est traitée comme une option non réglée, quelle que soit la valeur entre parenthèses, pour qu'une valeur enregistrée avec une version précédente suive le défaut actuel. La parenthèse montre à l'utilisateur la valeur utilisée aujourd'hui (demande de Didier). Vérifié en local par Didier : « save » dans `/plugin configure` sans rien changer écrit les valeurs affichées, ce qui figeait les défauts du jour comme choix de l'utilisateur (RD10, OD8).
- 2026-11-25 : tests rouverts (gel quitté : 0caad4e) : amendement « défaut (…) » : CA-3 et CA-10 (RD10)
- 2026-11-25 : tests regelés : f7dd172
- 2026-11-25 : « défaut » devient « recommandé » dans ce que voit l'utilisateur : valeur d'option `recommandé (<valeur>)`, source « recommandé » dans l'annonce et le JSON, tableau de `modes.md` intitulé « Valeurs recommandées », vers lequel `configuration.md` renvoie. « Défaut » mêlait « non réglé » et « valeur de la version » (OD22, OD23, demande de Didier).
