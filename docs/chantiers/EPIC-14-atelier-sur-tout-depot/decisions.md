# Décisions : EPIC-14 Travailler avec atelier sur n'importe quel dépôt

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-26 : en mode compagnon, le plugin est activé au scope utilisateur
- Contexte : SB1 de la relecture de spec ; le scope local laisse une copie neuve (clone, worktree) sans plugin ni rappel.
- Écarté : le scope local, parce qu'il demande une installation en ligne de commande puis `/atelier:init` dans chaque copie, sans rien qui signale l'oubli ; le scope projet, parce qu'il écrit dans `.claude/settings.json`, versionné chez le client.
- Conséquence : installé une fois par machine ; le hook de démarrage d'une copie neuve trouve le compagnon et demande `/atelier:init` ; les commandes `/atelier:*` sont visibles dans tous les projets de l'utilisateur.

## 2026-11-26 : les conventions de branche et de commit forment un lot à part
- Contexte : SD5 de la relecture de spec ; les conventions déclarées servent au compagnon mais aussi à un projet atelier.
- Écarté : les intégrer au lot compagnon, parce qu'il est déjà le plus gros et qu'elles ont de la valeur sans lui.
- Conséquence : lot 2 entre le pointeur et le compagnon.

## 2026-11-26 : les langues forment une piste parallèle, et la réécriture des skills est un FEAT
- Contexte : les lots de langues ne dépendent ni du pointeur ni du compagnon, seulement de REF-34.
- Écarté : les placer après le compagnon, parce qu'une mission en anglais peut en avoir besoin avant ; le lot 6 en REF, parce que les échanges changent de langue, donc le comportement change.
- Conséquence : l'ordre entre les pistes se décide selon le besoin réel, en enchaînant les lots qui touchent les mêmes modules.

## 2026-11-26 : pas de branche d'intégration
- Contexte : option `integration_branch` de FEAT-21, figée à la signature.
- Écarté : `yes`, parce que chaque lot a de la valeur livré seul et que la branche d'intégration n'ajouterait que des fusions et une revue d'ensemble.
- Conséquence : chaque lot part de la branche par défaut et y est fusionné seul.
