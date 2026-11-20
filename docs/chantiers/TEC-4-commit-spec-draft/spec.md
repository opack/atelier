---
id: TEC-4
type: TEC
title: Commiter la spec en brouillon
status: draft
tdd:                 # yes | no : décision humaine, obligatoire avant signature
created_at: 2026-11-20
signed_by:
signed_at:
---

# TEC-4 Commiter la spec en brouillon

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->
`/atelier:new` commite la spec en brouillon à sa fin (`docs(chantiers): [<ID>] spec draft`) au lieu d'interdire tout commit avant la signature ; `/atelier:sign` fonctionne qu'un ou plusieurs commits de brouillon existent ou non, et le commit `sign spec` reste le seul à porter `status: signed`.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->
- `plugins/atelier/skills/new/SKILL.md` §7 dit « Ne commite pas encore : la spec est commitée à la signature. »
- Dans une session Claude Code cloud, le conteneur est éphémère et un hook de fin de tour exige que tout fichier non suivi soit commité et poussé. La spec de FEAT-4 (autre projet) a donc dû être commitée en brouillon (`docs(chantiers): [FEAT-4] spec draft`), contre la consigne. TEC-3 l'a fait aussi (`docs(chantiers): [TEC-3] draft spec`).
- Une consigne que l'environnement oblige à violer n'est plus une consigne : l'agent apprend à l'ignorer. Et un brouillon non commité se perd avec le conteneur, ou entre deux sessions locales.
- La consigne n'apporte rien : ce qui atteste la signature, c'est `status: signed` écrit par `atelier sign` et le commit dédié `sign spec`, pas le fait que la spec n'ait jamais été commitée avant. Commiter le brouillon ajoute même une trace utile : le diff `spec draft` → `sign spec` montre ce que la relecture critique a changé.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->
- Inclus :
  - `plugins/atelier/skills/new/SKILL.md` §7 : commiter la spec seule à la fin, `git add <dossier>/spec.md` puis `git commit -m "docs(chantiers): [<ID>] spec draft"`. Toute modification ultérieure du brouillon avant signature (réponses aux questions, nouvelle session) peut être commitée avec le même message.
  - `plugins/atelier/skills/sign/SKILL.md` §4 : le commit de signature fonctionne qu'un brouillon ait déjà été commité ou non ; il emporte aussi les retouches issues de la relecture critique non commitées. La spec seule, toujours.
  - `plugins/atelier/test/core.test.mjs` : tests qui figent le comportement de la garde de spec (`specWriteRefusal`, via `decideWrite`) quand la version commitée est un brouillon (voir §5).
  - Site : `site/cycle/intention.md` (étape « commit du brouillon » dans « Avec atelier »), `site/cycle/signature.md` (étape 5 : la spec est commitée, qu'un brouillon l'ait été ou non ; seul le commit `sign spec` porte `status: signed`).
  - `README.md` si une ligne y contredit la nouvelle consigne (aucune trouvée à l'ouverture).
- Hors périmètre :
  - toute modification de `lib/core.mjs` ou `lib/cli.mjs` : l'analyse (§4) montre que la garde est déjà correcte ;
  - le nommage de branche imposé par les sessions cloud (`claude/<slug>` au lieu de `<type>/<ID>-<slug>`), qui empêche `atelier` de reconnaître le chantier : problème voisin, à traiter dans un chantier séparé s'il est retenu ;
  - un hook ou une commande `atelier` qui ferait le commit à la place du skill.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->
- **Historique** : un ou plusieurs commits `spec draft` de plus par chantier, avant `sign spec`. Le relecteur d'une PR lit toujours la signature dans le commit `sign spec`.
- **Garde de la spec** (`specWriteRefusal`, `plugins/atelier/lib/core.mjs`), analysée à l'ouverture :
  - la spec est « gardée » si la version de travail **ou** la version commitée n'est pas en brouillon. Une version commitée en brouillon ne garde rien : elle se comporte exactement comme une spec absente de `HEAD` (`committedSpec` à `null`) ;
  - entre `atelier sign` et le commit `sign spec`, la version de travail est signée et la version commitée est le brouillon : la spec est gardée par la version de travail, et la référence des amendements est la version de travail (puisque la commitée est en brouillon). C'est le même comportement que sans commit de brouillon ;
  - repasser `status` de `signed` à `draft` par l'outil d'édition reste refusé (champ réservé à la commande), avec ou sans brouillon commité.
  - Conclusion : aucun changement de code nécessaire, seulement des tests qui le prouvent.
- **Clôture et revue** : `set-reviewed` exige une spec commitée, `close-check` compare au commit revu ; un commit de brouillon antérieur à la signature n'y change rien.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->
- `npm test` vert, avec de nouveaux tests dans `plugins/atelier/test/core.test.mjs` :
  - V-1 : version commitée en brouillon, version de travail en brouillon → réécriture complète (`Write`) et éditions libres acceptées, sauf les champs réservés à la commande (`status`, `signed_by`, `signed_at`, `done_at`, `tests_commit`, `reviewed_commit`) ;
  - V-2 : version commitée en brouillon, version de travail signée (après `atelier sign`, avant le commit) → `Write` refusé ; édition du corps sans nouvelle entrée datée refusée ; édition avec nouvelle entrée acceptée ; retour de `status` à `draft` refusé ;
  - V-3 : pour chacun des cas de V-1 et V-2, la décision est identique à celle obtenue avec `committedSpec` à `null` (pas de brouillon commité).
- Relecture des deux skills : `new` §7 demande le commit du brouillon ; `sign` §4 ne suppose plus que la spec est absente de l'historique.
- `site/` : `npm run build` passe ; `intention.md` et `signature.md` décrivent le commit du brouillon.
- `claude plugin validate ./plugins/atelier` passe.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->
`git revert` du merge : textes de skills et de site uniquement, plus des tests. Aucune donnée, aucun état.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
