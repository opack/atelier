# 6. Revue

**Objectif** : faire relire le chantier par un regard indépendant, traiter chaque point, et enregistrer **quel commit** a été relu.

## Avec atelier

```text
/atelier:review
```

## 1. Contrôles

- La spec est signée.
- Tous les contrôles sont verts (`atelier checks`).
- En TDD, les tests sont figés et aucun n’a changé depuis leur gel (`atelier tests-changed`).
- Le travail est commité : la revue porte sur un commit, pas sur un état de travail.

## 2. Relecture indépendante

Le sous-agent `reviewer` relit le diff depuis la branche par défaut **sans avoir participé à l’écriture du code**. Il ne modifie rien. Il vérifie :

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

Ses remarques sont classées **bloquant** / **à discuter**, avec `fichier:ligne`.

La revue de l’agent **précède** la vôtre, elle ne la remplace pas. Voir [Relire du code généré](../agent/revue).

## 3. Traiter chaque point

Vous décidez du traitement de chaque point :

| Le point révèle… | Traitement |
|---|---|
| Une erreur dans le code | Correction, comme une tranche (`/atelier:build`) |
| Un test manquant ou faux | `/atelier:write-tests` : en TDD, il rouvre les tests figés, raison à l’appui |
| Une spec fausse ou incomplète | [Amendement](./amendement) (`/atelier:amend`) |
| Un écart que vous assumez | Exception, acceptée **explicitement** par vous, avec sa raison |
| Rien de fondé | Écarté, avec la raison |

Après des corrections, on relance la revue : c’est un **nouveau tour**. On continue jusqu’à **zéro point bloquant**.

## 4. Consigner et enregistrer

Chaque tour est consigné dans `revue.md`, dans le dossier du chantier : date, commit revu, points et leur traitement. Le relecteur lit les tours précédents pour ne pas revenir sur ce qui est tranché.

Quand plus rien ne bloque, `atelier set-reviewed` écrit le hash complet du commit revu (`reviewed_commit`) dans l’en-tête de la spec, puis la spec et `revue.md` sont commitées (`docs(chantiers): [<ID>] review`). La commande refuse sans spec signée, avec du code ou une spec non commités, ou en TDD si les tests ne sont pas figés ou ont changé depuis leur gel.

## Une revue qui devient obsolète

La [clôture](./cloture) vérifie que le code clôturé est **celui qui a été relu**. La revue devient obsolète, et il faut la refaire, après :

- un commit de code depuis le commit revu, **tests compris**, y compris apporté par une fusion de la branche par défaut ;
- une modification de `.claude/` : on ne doit pas pouvoir affaiblir les contrôles ou les hooks après la revue ;
- un amendement de la spec : le code a été relu contre une autre version ;
- un rebase, qui fait disparaître le commit revu de l’historique.

Les commits de documentation (chemins libres, dossier du chantier) ne la rendent pas obsolète : le bilan s’écrit après. `/atelier:status` indique si la revue est à jour, et sinon pourquoi.

Un `SPIKE`, dont le code est jetable et jamais fusionné, n’a pas de revue obligatoire.
