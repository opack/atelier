---
description: Ouvre le dossier d'un chantier dans l'explorateur de fichiers et donne son chemin.
argument-hint: "<ID du chantier, ex. FIX-18>"
---

# Ouvrir le dossier d'un chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Arguments reçus : `$ARGUMENTS`

Sans identifiant, demande lequel ouvrir, ou propose `/atelier:list` pour le retrouver.

Lance `atelier open <ID>` et rends le chemin du dossier à l'utilisateur.

- Si la commande dit qu'elle n'a pas ouvert le dossier (pas d'affichage, par exemple en session cloud ; explorateur absent ou en échec), relaie la raison et le chemin : le chemin est la réponse utile.
- En cas d'erreur (chantier sur une autre branche, identifiant inconnu, plusieurs dossiers du même identifiant, argument invalide), relaie le message tel quel.

N'ajoute rien d'autre.
