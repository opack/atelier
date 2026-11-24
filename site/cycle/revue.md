# 6. Revue

**Objectif** : faire relire chaque tranche, puis le chantier, par un regard indépendant, traiter chaque point, et enregistrer **quel commit** a été relu.

## Avec atelier

```text
/atelier:review
```

## Revue de tranche, revue du chantier

La revue se fait **par tranche**, juste après son implémentation : un diff de la taille d’une tranche se relit vraiment, et un défaut de la tranche 1 est vu avant que la tranche 2 ne s’appuie dessus.

| Revue | Quand | Diff relu | Mandat |
|---|---|---|---|
| **De tranche** | Après chaque tranche | Depuis le début de la tranche (`slice_base`), depuis la branche par défaut pour la tranche 1 | Ligne à ligne, les huit dimensions ci-dessous |
| **Du chantier** | Après la dernière tranche | Tout le chantier, depuis la branche par défaut | Transversal : chaque CA couvert par un test, cohérence entre tranches, restes de tranches précédentes, écarts entre spec, plan, décisions et code |

Un chantier sans plan, ou à une seule tranche, a une seule revue, sur tout le diff, ligne à ligne : pas de revue du chantier.

## 1. Contrôles

- La spec est signée.
- Tous les contrôles sont verts (`atelier checks`).
- En TDD, les tests sont figés et aucun n’a changé depuis leur gel (`atelier tests-changed`).
- Le travail est commité : la revue porte sur un commit, pas sur un état de travail.

## 2. Relecture indépendante

Le sous-agent `reviewer` relit le diff **sans avoir participé à l’écriture du code**. Il ne modifie rien. Il vérifie :

| Dimension | Exemples |
|---|---|
| Conformité à la spec | Chaque CA couvert par un test qui passe ; pas de hors périmètre |
| Sécurité | Autorisation vérifiée côté serveur, entrées validées, aucun secret |
| Performance | Requêtes en boucle, lectures excessives, abonnements non nettoyés |
| Accessibilité | Clavier, ARIA, contraste, textes localisés |
| Maintenabilité | Conventions, duplication, code mort, sur-ingénierie |
| Évolutivité | Frontières entre couches, couplages, choix difficiles à défaire |
| Pièges du code généré | API inventées, dépendances ajoutées, tests affaiblis |
| Livraison | Commits portant l’identifiant du chantier, aucun fichier hors périmètre |

Ses remarques sont classées **bloquant** / **à discuter**, avec `fichier:ligne`, et portent un identifiant stable : `RB1`, `RB2`… pour les bloquants, `RD1`, `RD2`… pour les points à discuter. La numérotation est continue sur tout le chantier, revues de tranche et du chantier confondues : un numéro n’est jamais réutilisé. Le relecteur ne compte pas lui-même : `/atelier:review` lui passe les prochains numéros (`atelier review-ids`) et la liste des points encore ouverts. On écrit alors « je corrige RB2, on écarte RD3 », et le bilan, la spec et les commits peuvent y renvoyer.

- Un point **encore ouvert** à la revue suivante garde son identifiant, marqué `(repris)` : `RB2 (repris). Push non vérifié`.
- Un point qui **change de gravité** prend un nouvel identifiant dans l’autre série et renvoie à l’ancien : `RB4 (ex-RD3)`. L’ancien est fermé par `requalifié (RB4)`.

La revue de l’agent **précède** la vôtre, elle ne la remplace pas. Voir [Relire du code généré](../agent/revue).

## 3. Traiter chaque point

Vous décidez du traitement de chaque point :

| Le point révèle… | Traitement (mot-clé dans `revue.md`) |
|---|---|
| Une erreur dans le code | **corrigé** (commit), comme une tranche (`/atelier:build`) |
| Un test manquant ou faux | **test ajouté** : `/atelier:write-tests`, qui en TDD rouvre les tests figés, raison à l’appui |
| Une spec fausse ou incomplète | **spec amendée** : [amendement](./amendement) (`/atelier:amend`) |
| Un écart que vous assumez | **exception acceptée**, **explicitement** par vous, avec sa raison |
| Rien de fondé | **écarté**, avec la raison |
| Un sujet pour plus tard | **reporté** : vers un autre chantier, la section « Dette et suites » du bilan, ou une tranche suivante (`reporté (tranche N)`), où il devra être repris et traité |
| Une gravité mal évaluée | **requalifié** (`requalifié (RB4)`), repris sous son nouvel identifiant |
| Un point devenu caduc | **sans objet** |

La cellule « Traitement » commence par l’un de ces mots-clés (casse ignorée), suivi du détail libre. Vide, ou sans mot-clé (« À corriger au build »), elle laisse le point ouvert. Un commit qui traite un point le cite après l’identifiant du chantier : `fix(plugin): [TEC-15] RB2 refuse an empty treatment`.

Après des corrections, on relance une **revue**. On continue jusqu’à ce que **chaque point ait un traitement**, les points à discuter compris.

## 4. Consigner, valider, passer à la suite

Chaque revue est consignée dans `revue.md`, dans le dossier du chantier : une section `## ` par revue, avec sa portée (tranche N ou chantier), la date, le commit revu, puis les tableaux `### Bloquant` et `### À discuter`, une ligne par point (`RB2. Intitulé`, ou `Aucun`) avec son traitement. Le relecteur lit les revues précédentes pour ne pas revenir sur ce qui est tranché.

Quand chaque point a un traitement, l’agent vous présente le résultat et vous demande **explicitement** de valider. Sans votre accord, rien n’est écrit : la tranche reste en cours. Après votre « oui », `atelier set-reviewed` :

- **tranche N avant la dernière** : passe à la tranche N+1. Le début de la nouvelle tranche (`slice_base`) est le commit revu ; en TDD, elle repart en phase « tests d’abord » ;
- **dernière tranche** : passe à la revue du chantier (`slice: chantier`) ;
- **revue du chantier**, ou chantier à tranche unique : écrit le hash complet du commit revu (`reviewed_commit`), celui que la clôture vérifie.

Puis la spec et `revue.md` sont commitées (`docs(chantiers): [<ID>] review <tranche>`). Il n’y a pas de commande « tranche suivante » : c’est la validation de la revue qui fait avancer.

La commande refuse sans spec signée, avec du code ou une spec non commités, en TDD si les tests ne sont pas figés ou ont changé depuis leur gel, pour une tranche sans aucun commit de code (« tranche vide »), si le début de la tranche n’est plus un ancêtre de `HEAD` (après un rebase : c’est à vous de corriger `slice_base`), ou si `revue.md` a un problème, notamment : un point dont la dernière occurrence n’a pas de traitement, un identifiant présenté deux fois comme nouveau, un `RB` sous « À discuter » (ou l’inverse), une cellule « Point » mal formée (ancien format `B1.`), une ligne `RB…` / `RD…` hors d’un tableau de points, une ligne au nombre de cellules différent de l’en-tête (un `|` non échappé en `\|`), un titre proche de `### Bloquant` dont les points ne seraient pas lus, un `(repris)`, un `(ex-…)` ou un `requalifié` sans renvoi. Un `revue.md` aux sections `## Tour …`, antérieur à cette nomenclature, n’est pas contrôlé.

## Une revue qui devient obsolète

La [clôture](./cloture) vérifie que le code clôturé est **celui qui a été relu**. La revue devient obsolète, et il faut la refaire, après :

- un commit de code depuis le commit revu, **tests compris** ; une fusion de la branche par défaut ne compte que par sa résolution, c’est-à-dire ce qui diffère de la fusion automatique sur un fichier de code (conflit résolu, retouche), pas par le code qu’elle apporte de la branche par défaut ([git 2.36 ou plus](../reference/limites#la-version-de-git)) ;
- une modification de `.claude/` : on ne doit pas pouvoir affaiblir les contrôles ou les hooks après la revue ;
- un amendement de la spec : le code a été relu contre une autre version ;
- un rebase, qui fait disparaître le commit revu de l’historique.

Les commits de documentation (chemins libres, dossier du chantier) ne la rendent pas obsolète : le bilan s’écrit après. `/atelier:status` indique si la revue est à jour, et sinon pourquoi.

Un `SPIKE` sans TDD, dont le code est jetable et jamais fusionné, n’a pas de revue obligatoire. En TDD, il suit le cycle complet, revues comprises.
