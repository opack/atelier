---
description: Débrayage d'urgence — autorise la modification du code sans spec signée sur la branche courante, avec une raison tracée. Réservé à l'urgence de production.
argument-hint: "<raison>"
disable-model-invocation: true
---

# Débrayer (urgence)

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Raison : `$ARGUMENTS`

1. Si la raison est vide, demande-la. Rappelle que le débrayage est réservé à l'**urgence de production** : une petite tâche passe par un chantier `TEC` avec une spec de trois lignes, pas par le débrayage.
2. `atelier bypass on <raison>`.
3. Rappelle les obligations : chaque commit porte le trailer `Atelier-Bypass: <raison>` ; une fois l'urgence passée, ouvrir le chantier (`/atelier:new`), écrire la spec et le bilan après coup ; `atelier bypass off` pour lever le débrayage (fait automatiquement par `/atelier:close`).
