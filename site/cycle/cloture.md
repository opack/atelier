# 6. Clôture : revue et bilan

**Objectif** : vérifier le travail avec un regard indépendant, garder la trace de ce qui a été fait, et rendre un verdict.

## Avec atelier

```text
/atelier:close
```

## 1. Contrôles

- Tous les contrôles sont verts (`atelier checks`).
- En TDD, aucun test n’a changé depuis leur gel (`atelier tests-changed`).
- Chaque commit porte l’identifiant du chantier.

## 2. Revue indépendante

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

Ses remarques sont classées **bloquant** / **à discuter**, avec `fichier:ligne`. Les points bloquants sont corrigés, ou acceptés explicitement comme exceptions.

La revue de l’agent **précède** la vôtre, elle ne la remplace pas. Voir [Relire du code généré](../agent/revue).

## 3. Bilan

`bilan.md` se lit seul. Il contient :

1. **Résumé** en trois lignes.
2. **Livré vs spécifié** : chaque CA, son statut, le test qui le couvre.
3. **Choix techniques** structurants.
4. **Éléments de code principaux** : ce qu’un nouveau venu doit lire en premier.
5. **Pistes écartées**, et pourquoi. C’est ce qui évite de refaire le chemin.
6. **Dette et suites.**
7. **Verdict de revue.**

Pour un `FIX`, s’y ajoute la cause réelle (confirmée ou non) et les autres endroits où le même schéma existe. Pour un `SPIKE`, la réponse à la question.

## 4. Verdict

Vous rendez le verdict : **accepté**, **accepté avec exceptions** (lesquelles), ou **refusé** (que reprendre). Il est inscrit dans le bilan avec votre nom et la date, et le chantier passe en `done` (`atelier set-status done`).

Un chantier clos rebloque le code sur sa branche : toute modification ultérieure est un nouveau chantier.

## 5. PR

atelier propose la PR : titre `[<ID>] <titre>`, résumé du bilan, liens vers la spec et le bilan. Il ne la crée que si vous le demandez.
