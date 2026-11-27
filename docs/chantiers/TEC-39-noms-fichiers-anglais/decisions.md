# Décisions : TEC-39 Noms de fichiers et de dossiers des chantiers en anglais

<!-- Une entrée par décision, au moment où elle est prise. Court et brut : c'est un journal.
Une décision qui dépasse le chantier (choix de lib, convention, architecture) remonte en ADR.

## AAAA-MM-JJ : décision en une phrase
- Contexte : ce qui a posé la question
- Écarté : option, parce que raison
- Conséquence : ce que ça implique pour la suite
-->

## 2026-11-27 : TEC plutôt que REF
- Contexte : Didier hésitait entre les deux types.
- Écarté : REF, parce qu'un REF garde le comportement intact, alors qu'ici ce que l'utilisateur voit, tape et configure change (même famille que TEC-37).
- Conséquence : les identifiants JS en français (`chantier`, `revueOf`…) font l'objet d'un REF séparé sous EPIC-17, après TEC-39.

## 2026-11-27 : dossier `docs/work-items/`
- Contexte : choix du nom anglais du dossier des chantiers (carte de décision, choix de Didier).
- Écarté : `docs/workstreams/`, parce qu'il évoque une piste longue, trompeur pour un FIX ; garder `docs/chantiers/` comme terme de marque, parce qu'il reste opaque pour une équipe anglophone.
- Conséquence : « work item » est aussi le mot anglais de « chantier » pour le lot 4 d'EPIC-14 ; clé `workItemsDir`, scope `docs(work-items)`.

## 2026-11-27 : migration sans repli
- Contexte : SD11, une configuration qui porte encore `chantiersDir`.
- Écarté : lecture des anciens noms ou message d'erreur dédié, parce qu'aucun autre projet n'utilise atelier aujourd'hui (préférence de Didier : pas de code pour l'ancien).
- Conséquence : la rupture est documentée sur le site (note « mise à jour depuis 0.8 »).

## 2026-11-27 : plan en 5 tranches, migration en dernier
- Contexte : SB1, le chantier ne peut pas se mener lui-même une fois le dépôt migré.
- Écarté : migrer le dépôt en première tranche, parce que le plugin de `main` ne verrait plus le chantier pendant tout le build.
- Conséquence : tranches 1 à 3 sur dépôts jetables, version 0.9.0 montée dans la tranche 5 pour ne pas périmer une revue antérieure.
