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
