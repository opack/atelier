# 1. Intention : écrire la spec

**Objectif** : décrire ce qui doit devenir vrai, assez précisément pour que l’agent ne devine pas, et pour que vous sachiez quand c’est fini.

## Entrée et sortie

- **Entrée** : un besoin, un brouillon (Notion, notes), un lien Sentry ou une issue.
- **Sortie** : `spec.md` complet selon son type, avec la décision TDD.

## Avec atelier

```text
/atelier:new [type] [description, lien Notion ou Sentry]
```

1. atelier choisit l’identifiant (après un `git fetch`, sauf si vous le fournissez), crée la branche et le dossier, copie le template du type.
2. Il exploite d’abord vos sources : brouillon, trace Sentry, code existant.
3. Il remplit ce qu’il peut **sans rien inventer**, et ne vous interroge que sur les manques.
4. Il vous demande si le chantier se fait en **TDD**.
5. `atelier check-spec` vérifie la complétude.
6. **Commit du brouillon** : la spec est commitée seule (`docs(chantiers): [<ID>] spec draft`) puis poussée, sauf si vous refusez le push. Jamais sur la branche par défaut. Le brouillon ne se perd pas avec la session, et le commit poussé **réserve l’identifiant** : après un `git fetch`, `atelier next-id` le voit, quel que soit le nom de la branche distante. Chaque retouche du brouillon est commitée et poussée de la même façon.

## Les questions : seulement sur les manques

atelier ne vous fait jamais confirmer ce qui est déjà écrit et correct. Il intervient quand une section est :

- **absente ou vide** ;
- **imprécise** : « rapide », « simple », sans valeur ni seuil ;
- **invérifiable** : un critère qui ne peut pas devenir un test ;
- **contredite par le code** ;
- marquée **« N/A » sans raison**.

## Écrire de bons critères d’acceptation

Un critère d’acceptation (CA) dit **quand le chantier est réussi**. Format :

```markdown
- [ ] CA-1 : Étant donné un budget avec trois enveloppes,
        quand j’ouvre le tableau de bord,
        alors je vois la somme des trois soldes.
```

Un bon CA est :

- **testable** : il peut devenir un test automatique ;
- **observable** : il décrit un comportement, pas une implémentation ;
- **complet** : on pense aux cas limites (liste vide, doublon, très grand volume, hors-ligne, utilisateur non autorisé).

::: tip Le test du critère
Si vous ne pouvez pas écrire le critère sous forme de test, ce n’est pas encore un critère.
:::

## Le non-fonctionnel, dès la spec

Pour un `FEAT`, une ligne chacun, ou « N/A » avec la raison :

- **Sécurité / autorisation** : qui peut lire ou écrire quoi, et où est-ce vérifié côté serveur ?
- **Performance** : quel volume réaliste ?
- **Accessibilité** : clavier, lecteur d’écran, contraste.
- **Données personnelles** : ce qui est stocké, envoyé à des tiers.

Découvertes à la revue, ces questions arrivent trop tard.

## TDD ou pas ?

C’est **votre décision**, obligatoire avant signature (`tdd: yes | no`). atelier vous fait une recommandation :

- **plutôt oui** : logique métier, calculs, règles d’autorisation, transformation de données, bug reproductible, refactor sensible ;
- **plutôt non** : configuration, montée de version, texte, mise en page, prototype, exploration, câblage trivial.

« Non » ne veut pas dire « aucun test » : des tests là où ils ont de la valeur, sans phase imposée. Pas de test pour le principe. Voir [Tests d’abord](./tests).

## Sans le plugin

Copiez le [template](../reference/templates) du type, remplissez-le, puis demandez à Claude :

> Lis `docs/chantiers/<ID>/spec.md`. Ne pose des questions que sur ce qui manque, est imprécis, invérifiable ou contredit par le code. Ne réécris pas ce qui est déjà bon.
