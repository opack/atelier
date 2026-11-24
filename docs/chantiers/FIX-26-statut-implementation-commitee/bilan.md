# Bilan : FIX-26 La prochaine étape ignore l'implémentation déjà commitée

<!-- Écrit à la clôture, à partir de la spec, du journal de décisions, du diff et de revue.md. Se lit seul.
Pour un FIX : sections 1, 2, 4 et 7 suffisent, plus la cause réelle. -->

## 1. Résumé
`atelier status` et le hook de début de session proposent désormais « Implémentation commitée : faire relire : /atelier:review (ou reprendre /atelier:build si elle n’est pas finie) » dès que du code a été commité dans la tranche en cours, depuis le gel des tests en TDD. Un SPIKE sans TDD se voit proposer la clôture. Sans commit de code, ou si le signal est incalculable, le texte « Implémenter » est conservé. `status --json` expose le signal (`chantier.codeCommitted`), et le site le documente.

**Cause réelle** : confirmée. `phaseStep` ne connaissait que l'état de la revue et renvoyait « Implémenter » tant qu'aucune revue n'existait, sans regarder les commits de la tranche.

**Autres endroits où le schéma existe** : la règle « tranche vide » de `set-reviewed` utilise le même calcul (`sliceCodeFiles`), et partage son défaut : le code apporté par une fusion de la branche par défaut compte comme code de la tranche (OD1, en suites).

## 2. Livré vs spécifié
Tous les tests sont dans `plugins/atelier/test/next-step.test.mjs`.

| Critère | Statut | Test |
|---|---|---|
| CA-1 : tranche sans TDD, code commité → revue | Livré | `tranche en cours sans TDD, code commité : faire relire` |
| CA-2 : sans code ou signal absent → texte actuel | Livré | `tranche en cours sans TDD, sans code commité ou signal absent` |
| CA-3 : TDD `implementing`, tranche en cours et unique | Livré | `TDD en phase implementing : faire relire si du code est commité` |
| CA-4 : `single` et `legacy` | Livré | `chantier single et legacy, code commité`, `sans TDD ni slice_base, le code est compté depuis la base de fusion` (bout en bout) |
| CA-5 : SPIKE → clôturer | Livré | `SPIKE sans TDD, code commité : clôturer`, `SPIKE sans TDD, code commité : status propose la clôture` (bout en bout) |
| CA-6 : signal sans effet hors cas utiles | Livré | `le signal ne change rien en écriture des tests, avec une revue, ni en revue du chantier` |
| CA-7 : `status --json` false puis true | Livré | `status : codeCommitted false tant que seul le dossier du chantier change` |
| CA-8 : hook de début de session | Livré | `le hook de début de session affiche la revue comme prochaine étape` |
| CA-9 : TDD, tests et code d'avant le gel exclus | Livré | `TDD : le commit des tests et le code commité avant le gel ne comptent pas` |
| CA-10 : base introuvable ou hors historique → null, sans échec | Livré | `début de tranche introuvable ou hors de l’historique` |
| CA-11 : revue à jour, obsolète, tests pas figés → null | Livré | `revue à jour ou tests pas encore figés`, `revue obsolète : codeCommitted vaut null` |

Écarts : aucun par rapport à la spec signée. Les tests ont été rouverts une fois (OD3) pour ajouter trois cas de bout en bout, puis regelés (`0df1e7d`).

## 3. Choix techniques
- Signal = `sliceCodeFiles` réutilisée, pour rester aligné sur la règle « tranche vide » de `set-reviewed`.
- Base `tests_commit` en TDD (SD1), sinon `slice_base`, sinon base de fusion avec la branche par défaut.
- Toute erreur git, ou une base hors de l'historique de HEAD, donne `null` : le hook ne peut pas échouer sur ce calcul (SB1).
- git n'est lancé que si le résultat peut changer la prochaine étape (`codeCommittedMatters`, SD4).
- `codeCommitted` en 4e paramètre positionnel de `nextStep` : aucun appel existant ne change (SD5).

## 4. Éléments de code principaux
- `plugins/atelier/lib/core.mjs` : `nextStep` (paramètre `codeCommitted`), `codeCommittedMatters` (quand calculer), `phaseStep` (textes « Implémentation commitée »).
- `plugins/atelier/lib/cli.mjs` : `codeCommittedFact` (calcul git, repli sur `null`), appelée par `status` et `hookSessionStart`.
- `site/reference/commandes.md` : champ `codeCommitted` de `atelier status --json`.

## 5. Pistes écartées
- Exiger des tests verts en TDD : `status` ne lance pas la suite, la revue s'en charge.
- Un objet d'options pour `nextStep` : aurait touché tous les appels et tests existants.
- Factoriser `plain` dans le fichier de test (RD2) : ne justifiait pas de rouvrir des tests figés.

## 6. Dette et suites
- OD1 : `sliceCodeFiles` (`git log <début>..HEAD`) compte le code apporté par une fusion de la branche par défaut. `--first-parent` seul ne suffit pas (le commit de fusion porte alors tout le diff de la branche par défaut) : exclure la branche par défaut et ne garder des fusions que leur résolution (`--diff-merges=remerge <début>..HEAD ^<branche par défaut>`, git ≥ 2.36, calcul actuel en repli). Même racine pour la revue rendue « obsolète » par une fusion de main (`--diff-merges=first-parent` dans le calcul de la revue). Un FIX à ouvrir pour les trois : prochaine étape, « tranche vide » de `set-reviewed`, revue obsolète.
- Conséquence de SD1 observée sur ce chantier même : du code commité avant un nouveau gel des tests ne compte plus, et `status` renvoie à `/atelier:build` alors que l'implémentation est faite. À surveiller à l'usage.
- OD2 : un chantier passé de `single` à plusieurs tranches avec un `reviewed_commit` résiduel garde « Implémenter ». Cas rare, accepté.

## 7. Verdict de revue
Une revue, chantier à tranche unique (base `aaa4488`, commit revu `706675a` puis `39551bd`, revue enregistrée au commit `308ca59`) : aucun bloquant.

| Point | Traitement |
|---|---|
| RD1. decisions.md : OD3 n'est plus à jour après la réouverture des tests | corrigé (39551bd) |
| RD2. Utilitaire `plain` défini deux fois dans le fichier de test | écarté (duplication sans effet, ne justifie pas de rouvrir des tests figés) |

Exceptions acceptées : aucune.

- Verdict : accepté
- Validé par : Didier
- Date : 2026-11-23
