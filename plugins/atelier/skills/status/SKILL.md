---
description: Indique où en est le chantier actif (statut, documents, manques) et la prochaine étape du process atelier.
---

# Où en est le chantier ?

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Lance `atelier status` et présente le résultat en quelques lignes : chantier, statut, tranche en cours (« Tranche N/M », ou revue du chantier ; rien pour un chantier à tranche unique), documents présents, points manquants, état de la revue (commit revu, à jour ou obsolète et pourquoi), relations (parent, dépendances et leur statut, enfants d'un EPIC), débrayage éventuel, prochaine étape. Si la spec n'est pas signée et a des manques, propose d'y travailler. N'ajoute rien d'autre.
