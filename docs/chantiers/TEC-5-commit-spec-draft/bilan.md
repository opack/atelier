# Bilan : TEC-5 Commiter la spec en brouillon

## 1. Résumé
`/atelier:new` commite et pousse désormais la spec en brouillon (`docs(chantiers): [<ID>] spec draft`) et fait un `git fetch` avant `atelier next-id` : l'identifiant est réservé dès l'ouverture, et la consigne qui interdisait tout commit avant signature, intenable en session cloud, disparaît. `/atelier:sign` fonctionne avec ou sans brouillon commité. Aucun changement de code : la garde de spec était déjà correcte, des tests le figent. Plugin en 0.2.1.

## 2. Livré vs spécifié
| Critère | Statut | Test |
|---|---|---|
| V-1 : commitée brouillon + travail brouillon → `Write` et éditions libres, champs réservés refusés | Livré, partiel sur les champs réservés | `core.test.mjs`, suite « write guard on a spec whose committed version is a draft », cas `V-1 draft: …` ; refus d'un champ réservé : `names the reserved field and the amendment rule in its refusals`, qui ne teste que `status` avec brouillon commité (les cinq autres champs ne sont pas couverts dans cette configuration) |
| V-2 : commitée brouillon + travail signé → `Write` refusé, édition sans entrée refusée, avec entrée acceptée, retour à `draft` refusé | Livré | même suite, cas `V-2 signed, not committed: …` |
| V-3 : décisions identiques à `committedSpec = null` | Livré | même suite (assertion `V-3: same decision as with no committed spec` sur chaque cas) + `V-2/V-3 takes the signed working version as reference, not an older committed draft` (brouillon au corps différent, ajouté en revue D3) |
| Skill `new` : §1 retouches commitées/poussées, §3 fetch + choix du remote, `--no-track`, §7 commit spec seule + push jamais sur la branche par défaut | Livré | relecture (revue tours 1 à 3) ; commandes git rejouées sur dépôt jetable au tour 2 |
| Skill `sign` : fin §3 retouches sans signature commitées/poussées, §4 commit spec seule, brouillon ou non | Livré | relecture (revue tours 1 à 3) |
| Site : `intention.md`, `signature.md`, `commandes.md` | Livré | relecture ; `npm run build` |
| `claude plugin validate ./plugins/atelier` | Livré | contrôles de revue |

Écarts :
- `site/fondations/chantier.md` modifié en plus (fetch et réservation, revue D4) sans figurer dans la spec : exception acceptée (D7).
- `plugin.json` passé en 0.2.1, hors liste « Inclus » : à la demande de l'utilisateur (D6).
- Amendement du 2026-11-20 : règle de push corrigée après le bloquant B1 (voir §3).

## 3. Choix techniques
- La réservation d'identifiant repose sur le **sujet du commit** `[<ID>] spec draft` poussé, pas sur le nom de branche : `collectUsedIdentifiers` lit déjà `git log --all --format=%s`, ça marche aussi sur une branche imposée `claude/...`.
- Le `git fetch` est fait par le skill, pas par la CLI : `atelier next-id` reste sans accès réseau.
- Branche créée avec `git switch --no-track -c` ; cible du push lue dans `branch.<b>.merge` (pas `@{u}`) ; suivi de la branche par défaut → `push -u` vers une nouvelle branche. Le brouillon n'atterrit jamais sur la branche par défaut.
- Commit `git commit … -- <dossier>/spec.md` : seule la spec part, quoi qu'il y ait dans l'index.
- Aucune modification de `core.mjs` : une spec commitée en brouillon se comporte comme une spec absente de `HEAD`, ce que V-3 verrouille.

## 4. Éléments de code principaux
- `plugins/atelier/skills/new/SKILL.md` §3 (fetch, choix du remote, `--no-track`) et §7 (commit et règles de push) : le cœur du changement.
- `plugins/atelier/skills/sign/SKILL.md` fin §3 et §4.
- `plugins/atelier/test/core.test.mjs`, suite « write guard on a spec whose committed version is a draft » : documente le contrat de `specWriteRefusal` face à un brouillon commité.
- `plugins/atelier/lib/core.mjs` (`specWriteRefusal`, `collectUsedIdentifiers`) : non modifiés, mais c'est là que vit la logique sur laquelle tout repose.

## 5. Pistes écartées
- `git fetch` dans `atelier next-id` : la CLI reste hors réseau.
- Pousser `HEAD:<branche de suivi>` sans condition (version initiale) : publiait le brouillon sur `main` quand la branche partait de `origin/main` (B1).
- Verrou contre la course `fetch` → `push` : risque rare, accepté.
- Hook ou commande `atelier` qui commiterait à la place du skill.
- Anticiper ici le cas « branche imposée » dans `new` §3 (D1) : laissé à TEC-6.

## 6. Dette et suites
- **TEC-6** (`tec/TEC-6-chantier-hors-branche`) : reconnaître le chantier actif sur une branche sans identifiant ; s'appuie sur le commit `spec draft` systématique livré ici. Tant qu'il n'est pas fusionné, le cas « branche imposée » de `new` §7 n'est pas atteint en suivant `new` §3 à la lettre.
- Course `fetch`/`push` : un doublon d'identifiant reste possible et ne se voit que dans l'historique.
- Numéros consommés définitivement par tout brouillon poussé (déjà le cas de TEC-4).
- V-1 ne vérifie qu'un seul des six champs réservés (`status`) avec un brouillon commité. Le risque est faible, la liste des champs étant commune à tous les cas, mais il reste un trou dans la couverture.
- Le comportement des skills (push, choix du remote) n'est vérifié que par relecture : aucun test automatisé possible sans exécuter le skill.

## 7. Verdict de revue
3 tours (commits revus 7cc633e, 1d1d401, 891520b ; base 4081cf2).
- Bloquant : B1 (push du brouillon sur la branche par défaut) corrigé en 998d8f6, spec amendée en 891520b.
- À discuter : D2, D3, D4 corrigés (998d8f6) ; écart spec/skills du tour 2 traité par amendement (891520b) ; D1 (laissé à TEC-6) et D6 (version 0.2.1 demandée) écartés par l'utilisateur.
- Exceptions acceptées : D5 (commits `657d448 [TEC-4] spec draft` et `f51aaf8 Revert … (wrong signer)` sans `[TEC-5]` en préfixe, pas de réécriture d'historique) ; D7 (`site/fondations/chantier.md` hors spec).

- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-20
