# Décisions : TEC-23 Lancer les contrôles une seule fois par état du code

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-23 : `workingTreeId` retire `.atelier/` de son index avec `git rm --force`
- Contexte : quand `.atelier/` n'est pas ignoré par git (projet où `/atelier:init` n'a pas ajouté la ligne au `.gitignore`, dépôts des tests), `git add --all` indexe le propre index du contrôle (`.atelier/gate-index`), puis `git rm --cached` refuse de le retirer (« staged content different from both the file and the HEAD »). L'empreinte était alors impossible à calculer : le hook de fin de tour échouait (« contrôle de fin de tour impossible ») et le cache de TEC-23 ne servait jamais. Constaté en faisant passer CA-2 et CA-4.
- Écarté : une pathspec d'exclusion (`':!.atelier'`), que git refuse quand `.atelier/` est ignoré (commentaire existant) ; ignorer `.atelier/` dans les dépôts de test, qui aurait masqué le défaut chez les utilisateurs.
- Conséquence : l'empreinte est calculable que `.atelier/` soit ignoré ou non, et le hook de fin de tour ne tombe plus en erreur dans ce cas.

## 2026-11-23 : l'empreinte est calculée avant de lancer les contrôles
- Contexte : un fichier modifié pendant que les contrôles tournent (édition concurrente, fichier généré par les tests) ne doit pas être couvert par le vert.
- Conséquence : on enregistre l'état qui a réellement été contrôlé ; un fichier non ignoré produit par les contrôles fera relancer au prochain appel, ce qui est sûr.
