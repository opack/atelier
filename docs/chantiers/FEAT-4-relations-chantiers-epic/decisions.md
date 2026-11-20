# Décisions : FEAT-4 Relations entre chantiers et type EPIC

## 2026-11-20 : les en-têtes des autres branches se lisent par un seul `git grep`
- Contexte : la découverte des chantiers doit couvrir toutes les branches en un appel git groupé.
- Écarté : `git cat-file --batch` sur toutes les combinaisons branche × spec, parce que la sortie contient les specs entières (des dizaines de Mo sur un vrai projet) ; `git ls-tree` par branche, parce que c'est un appel par branche.
- Conséquence : deux appels git au total (`for-each-ref` puis `grep`) ; seules les lignes `id|type|status|rel_*` sont lues, la première occurrence par fichier fait foi.

## 2026-11-20 : un lien compte dès qu'une version du chantier le déclare
- Contexte : un chantier peut avoir des en-têtes différents dans l'arbre courant et sur sa branche (amendement non fusionné).
- Écarté : ne retenir que la version de l'arbre courant, parce qu'elle peut ignorer un enfant rattaché ou amendé sur sa branche et laisser clore un EPIC à tort.
- Conséquence : enfants et dépendances = union des versions connues ; le statut, lui, reste jugé dans l'arbre courant seulement.

## 2026-11-20 : `check-spec` sans configuration ne vérifie pas les relations
- Contexte : `check-spec` fonctionne aujourd'hui sans `.claude/atelier.json`, mais l'index a besoin de `chantiersDir`.
- Écarté : exiger la configuration, parce que cela casserait un usage existant pour un cas marginal.
- Conséquence : sans configuration, les relations ne sont pas vérifiées et un message le dit.

## 2026-11-20 : un EPIC en `tdd: yes` est signalé par `check-spec`
- Contexte : avant signature, l'en-tête se modifie à la main ; rien n'empêchait un EPIC en `tdd: yes`.
- Écarté : une simple note ici sans critère, parce que le type EPIC est créé dans ce chantier et doit être cohérent d'emblée.
- Conséquence : amendement de la spec (description et CA-7).

## 2026-11-20 : les en-têtes des autres branches se lisent par `git cat-file --batch`, sans `git grep`
- Contexte : mesure du plan (330 specs, 31 branches, Windows) : le `git grep` sur toutes les refs prend ~2 s, car il relit chaque spec une fois par branche (~60 ms par ref).
- Écarté : le `git grep` de l'entrée précédente, qui croît avec le nombre de branches ; un `git ls-tree` par branche, pour la même raison.
- Conséquence : trois appels git, quel que soit le nombre de branches : `for-each-ref`, `cat-file --batch` sur `<ref>:<chantiersDir>` (arbre de chaque ref), `cat-file --batch` sur `<arbre du chantier>:spec.md` pour les seuls dossiers distincts (les branches partagent presque tous les mêmes). Seules les specs distinctes sont lues, pas une par branche. Requêtes par l'entrée standard : pas de limite de longueur de ligne de commande. Mesure : ~170 ms au-dessus d'un `status` sans relations (360 ms contre 190 ms), constant avec le nombre de branches ; au-dessus de l'indication de 100 ms, dû surtout au lancement des processus git sous Windows et à la lecture des specs de l'arbre courant.

## 2026-11-20 : la branche courante est lue sur le disque, pas dans git
- Contexte : l'index contient une version par branche ; la branche courante a aussi son contenu non commité.
- Écarté : lire aussi `refs/heads/<branche courante>`, qui doublerait la version du disque par une version commitée parfois périmée.
- Conséquence : l'arbre courant (disque) fait foi pour la branche courante ; sa branche de suivi distante reste lue comme les autres.

## 2026-11-20 : un refus de clôture d'un chantier sans revue ne renvoie pas vers la revue
- Contexte : le message de refus se terminait toujours par « refais relire : /atelier:review », faux pour un EPIC (et déjà pour un SPIKE).
- Écarté : ne corriger que l'EPIC, parce que la règle est la même (pas de revue exigée).
- Conséquence : pour un SPIKE ou un EPIC, le refus invite à corriger puis relancer la clôture (/atelier:close).

## 2026-11-20 : les dépendants d'un chantier ne sont pas calculés
- Contexte : la spec cite « chantiers qui dépendent d'un autre » parmi les liens inverses calculables, sans critère ni affichage qui les demande.
- Écarté : les afficher dans `status`, parce qu'aucun CA ne le demande et que le hors périmètre exclut une vue globale des relations.
- Conséquence : seul l'inverse de `rel_parent` (enfants d'un EPIC) est calculé ; les dépendants pourront s'ajouter quand un besoin les demandera.

## 2026-11-21 : le rappel de démarrage construit l'index des chantiers (revue, tour 1)
- Contexte : le plan disait que le hook de démarrage ne paierait rien ; il affiche pourtant les relations et la prochaine étape d'un EPIC, qui demandent l'index.
- Écarté : retirer les relations du rappel, parce que l'état d'un EPIC (enfants ouverts) est justement ce qu'il faut savoir en ouvrant une session.
- Conséquence : ~170 ms de plus au démarrage, seulement quand le chantier courant est un EPIC ou a des `rel_*` ; rien sinon. Couvert par un test du hook.

## 2026-11-21 : pas de repli sur erreur git dans la lecture des branches (revue, tour 1)
- Contexte : la revue demandait de tester un `catch` du rappel de démarrage (erreur git pendant la construction de l'index) et d'en protéger l'abandon d'un EPIC.
- Écarté : le `catch` et la garde, parce qu'aucune erreur n'a pu être provoquée : un objet manquant ou corrompu fait répondre « missing » à `git cat-file` (code 0), le chantier est simplement absent de l'index. Du code de repli non testable pour un cas inconnu.
- Conséquence : une erreur git réelle remonte comme toute autre erreur de la commande.

## 2026-11-21 : l'implémentation est livrée en un seul commit (revue, tour 1)
- Contexte : le plan prévoyait un commit par tranche ; les tests de tous les CA étaient figés d'un bloc et le contrôle de fin de tour (`npm test`) restait rouge tant que toutes les tranches n'étaient pas faites.
- Écarté : un découpage artificiel en commits par type de fichier après coup, qui ne raconte pas la construction.
- Conséquence : un commit d'implémentation (b4377e7). Le défaut de méthode (tests figés pour tout le chantier, contrôle global) relève d'un chantier à part : écrire et figer les tests tranche par tranche.
