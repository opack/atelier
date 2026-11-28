---
description: Liste les chantiers du projet (arbre courant et autres branches) avec leur statut et leur étape, filtrés selon une demande en langage naturel.
argument-hint: "[demande : « les FIX en cours », « les enfants d'EPIC-17 », « tout, triés par statut »…]"
---

# Lister les chantiers

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`. Elle est de la plomberie lancée par toi : l'utilisateur ne tape pas la CLI.

Demande reçue : `$ARGUMENTS`

## 1. Récupérer le remote

Si le dépôt a un remote (`git remote`), lance `GIT_TERMINAL_PROMPT=0 git fetch --all --prune --quiet`. Un échec (réseau, droits) se signale en une ligne et ne bloque pas : la liste se fait avec les branches distantes telles qu'elles sont. Sans remote, ne lance pas de fetch et ne dis rien.

## 2. Traduire la demande

Traduis la demande en arguments de `atelier list` :

| Option | Rôle |
|---|---|
| texte libre (un ou plusieurs mots) | identifiant ou titre contenant chaque mot, sans casse ni accents |
| `--status <s,…>` | `draft`, `signed`, `done`, `abandoned` ; remplace le défaut « ouverts » |
| `--type <T,…>` | `FEAT`, `FIX`, `REF`, `TEC`, `SPIKE`, `EPIC` |
| `--parent <ID>` | enfants d'un EPIC (ou d'un parent) |
| `--all` | ajoute les chantiers clos (`done`, `abandoned`) |
| `--sort id\|status\|type` | tri (par défaut : numéro) |

Sans `--status` ni `--all`, seuls les chantiers ouverts sont listés. Exemples :

- « les FIX en cours » : `atelier list --type FIX`
- « les enfants d'EPIC-17 » : `atelier list --parent EPIC-17`
- « tout, triés par statut » : `atelier list --all --sort status`
- « les chantiers clos » : `atelier list --status done,abandoned`
- « ce qui parle de relecture » : `atelier list relecture`

Une demande qu'aucun de ces filtres ne sait traduire (par auteur, par date, par dépendance…) : dis ce que `atelier list` ne peut pas filtrer, et ne l'approche pas par un autre filtre. Une demande dont une partie seulement se traduit (« les FIX de Didier ») : ne lance pas la partie traduisible comme si elle répondait à la demande ; dis ce qui ne se filtre pas, et propose la partie filtrable comme suggestion.

## 3. Lancer et présenter

Lance la commande **sans `2>&1`** : sortie d'erreur et sortie standard ne se mélangent pas. Présente la sortie standard telle quelle. Si la sortie d'erreur contient un avertissement (par exemple un chantier qui a plusieurs dossiers dans l'arbre courant), relaie-le à l'utilisateur. En cas d'échec (argument refusé), relaie le message. N'ajoute rien d'autre. Si l'utilisateur veut ouvrir le dossier d'un chantier, renvoie-le vers `/atelier:open <ID>`.
