---
description: Indique où en est le chantier actif (statut, documents, manques) et la prochaine étape du process atelier.
---

# Où en est le chantier ?

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Lance `atelier status` et présente le résultat en quelques lignes : chantier, statut, documents présents, points manquants, débrayage éventuel, prochaine étape. Si la spec n'est pas signée et a des manques, propose d'y travailler. N'ajoute rien d'autre.
