# 7. Clôture : bilan et verdict

**Objectif** : vérifier que le code clôturé est celui qui a été relu, garder la trace de ce qui a été fait, et rendre un verdict.

La clôture ne relit pas et ne corrige pas le code : c’est le rôle de la [revue](./revue).

## Avec atelier

```text
/atelier:close
```

## 1. Préalable : une revue à jour

La revue doit être enregistrée et à jour (`/atelier:status` le dit). Pour un chantier à plusieurs tranches, c’est la **revue du chantier**, après la dernière tranche : une tranche encore en cours, ou ajoutée au plan après la dernière revue de tranche, bloque la clôture. Sinon, retour à `/atelier:review`. Exceptions : un `SPIKE` sans TDD, dont le code n’est jamais fusionné, et un EPIC sans l’option de branche d’intégration, qui n’a pas de code. Un [EPIC à branche d’intégration](../fondations/types#epic-a-branche-d-integration) exige sa **revue d’ensemble** à jour, et que les revues de ses enfants soient encore dans l’historique de la branche d’intégration (aucun squash, aucun rebase) ; la clôture nomme l’enfant fautif.

## 2. Bilan

`bilan.md` se lit seul. Il contient :

1. **Résumé** en trois lignes.
2. **Livré vs spécifié** : chaque CA, son statut, le test qui le couvre.
3. **Choix techniques** structurants.
4. **Éléments de code principaux** : ce qu’un nouveau venu doit lire en premier.
5. **Pistes écartées**, et pourquoi. C’est ce qui évite de refaire le chemin.
6. **Dette et suites.**
7. **Verdict de revue**, repris de `revue.md` : un point par identifiant (`RB1`, `RD1`…) avec son traitement final.

Pour un `FIX`, s’y ajoute la cause réelle (confirmée ou non) et les autres endroits où le même schéma existe. Pour un `SPIKE`, la réponse à la question.

## 3. Verdict

Vous rendez le verdict : **accepté**, **accepté avec exceptions** (lesquelles), ou **refusé** (que reprendre). Il est inscrit dans le bilan avec votre nom et la date.

## 4. Vérifications déterministes

Après votre verdict, juste avant de passer le chantier en `done`, `atelier close-check` vérifie :

- la spec est signée ;
- `reviewed_commit` est renseigné et est un ancêtre de `HEAD` (sinon, après un rebase par exemple : nouvelle revue) ;
- **aucun commit de code** depuis le commit revu : tests, `.claude/` et fusions compris ; seuls les autres chemins libres, le dossier du chantier et `.atelier/` ne comptent pas ;
- **aucun amendement** de la spec depuis la revue ;
- aucun changement de code non commité ;
- en TDD, les tests sont figés ;
- chaque point de `revue.md` a un traitement, aucun n’est encore `reporté (tranche N)`, aucun n’est mal formé (mêmes contrôles qu’à la [revue](./revue#_4-consigner-valider-passer-a-la-suite)), et `revue.md` est commité ;
- les dépendances (`rel_depends_on`) sont `done` dans la branche courante : pour l’enfant d’un EPIC à branche d’intégration, le message dit de fusionner la branche d’intégration ; un chantier hors de l’EPIC qui dépend d’un enfant livré seulement dans la branche d’intégration attend la clôture de l’EPIC ;
- les contrôles de `.claude/atelier.json` sont verts.

Un `SPIKE` ignore tout ce qui touche à la revue ; le reste s’applique. En cas d’échec : la liste des problèmes, et retour à `/atelier:review`.

`atelier set-status done` refait les mêmes vérifications et refuse si l’une échoue. La clôture peut donc prendre le temps de la suite de tests.

Un chantier clos rebloque le code sur sa branche : toute modification ultérieure est un nouveau chantier.

## 5. PR

atelier propose la PR : titre `[<ID>] <titre>`, résumé du bilan, liens vers la spec, la revue et le bilan. Il ne la crée que si vous le demandez.

Sa cible est la base du chantier (`baseBranch`). L’enfant d’un EPIC à branche d’intégration vise la branche d’intégration, et sa PR se fusionne par un **commit de fusion**, ni squash ni rebase : ils effaceraient le commit revu. L’EPIC à branche d’intégration se termine par une seule PR qui fusionne la branche d’intégration dans sa base (en général la branche par défaut ; la branche d’intégration du parent pour un sous-EPIC).

Pendant l’EPIC, la branche par défaut avance : on la fusionne dans la branche d’intégration (`git merge`, commit `[<ID de l’EPIC>] merge <branche par défaut>`), **jamais de rebase**. Une fusion sans conflit sur du code laisse la revue d’ensemble à jour ; ses résolutions de conflits la périment, puisque c’est elle qui doit les relire. Elles se font sous [débrayage](./debrayage), levé aussitôt le commit de fusion fait : la branche de l’EPIC reste fermée au code.
