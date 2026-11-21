# 7. Clôture : bilan et verdict

**Objectif** : vérifier que le code clôturé est celui qui a été relu, garder la trace de ce qui a été fait, et rendre un verdict.

La clôture ne relit pas et ne corrige pas le code : c’est le rôle de la [revue](./revue).

## Avec atelier

```text
/atelier:close
```

## 1. Préalable : une revue à jour

La revue doit être enregistrée et à jour (`/atelier:status` le dit). Pour un chantier à plusieurs tranches, c’est la **revue du chantier**, après la dernière tranche : une tranche encore en cours, ou ajoutée au plan après la dernière revue de tranche, bloque la clôture. Sinon, retour à `/atelier:review`. Exception : un `SPIKE` sans TDD, dont le code n’est jamais fusionné.

## 2. Bilan

`bilan.md` se lit seul. Il contient :

1. **Résumé** en trois lignes.
2. **Livré vs spécifié** : chaque CA, son statut, le test qui le couvre.
3. **Choix techniques** structurants.
4. **Éléments de code principaux** : ce qu’un nouveau venu doit lire en premier.
5. **Pistes écartées**, et pourquoi. C’est ce qui évite de refaire le chemin.
6. **Dette et suites.**
7. **Verdict de revue**, repris de `revue.md`.

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
- les contrôles de `.claude/atelier.json` sont verts.

Un `SPIKE` ignore tout ce qui touche à la revue ; le reste s’applique. En cas d’échec : la liste des problèmes, et retour à `/atelier:review`.

`atelier set-status done` refait les mêmes vérifications et refuse si l’une échoue. La clôture peut donc prendre le temps de la suite de tests.

Un chantier clos rebloque le code sur sa branche : toute modification ultérieure est un nouveau chantier.

## 5. PR

atelier propose la PR : titre `[<ID>] <titre>`, résumé du bilan, liens vers la spec, la revue et le bilan. Il ne la crée que si vous le demandez.
