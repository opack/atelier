---
description: Conçoit le chantier actif à partir de sa spec signée — approche, fichiers touchés, découpage en tranches — et écrit plan.md après validation.
---

# Concevoir le chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

## 1. Préalables

- `atelier status --json` : il faut une spec **signée**. Sinon, arrête-toi et indique `/atelier:sign`.
- Recommande à l'utilisateur d'être en **mode plan** pendant cette étape si ce n'est pas le cas.
- **Ne modifie aucun fichier hors du dossier du chantier** pendant la conception.

## 2. Analyser

Lis la spec, le journal de décisions s'il existe, puis le code concerné. Appuie-toi sur ce qui existe (conventions, utilitaires, couches) plutôt que d'inventer.

## 3. Proposer

Présente, de façon concise :
- **Approche** : la solution recommandée. S'il existe un vrai choix, 2 ou 3 options au plus, avec ta recommandation et pourquoi.
- **Fichiers et couches touchés.**
- **Tranches** : chacune livrable seule, relisible en moins de 15 minutes, un commit ; indique les `CA-x` couverts par chaque tranche. Chaque `CA` doit être couvert par au moins une tranche.
- **Risques** et parades ; zones critiques (paiement, concurrence, règles de sécurité, autorisation, migrations) à relire ligne à ligne.
- **Ce qui manque dans la spec**, si la conception révèle un trou : propose un amendement (`/atelier:amend`) plutôt que de le combler en silence.

**FEAT ou REF trop grand** : si le découpage produit des tranches qui ne tiennent pas dans un seul chantier (plusieurs PR, livrables indépendants), signale que le périmètre a la taille d'un EPIC et propose de l'organiser ainsi, sans forcer.

**EPIC** : on ne conçoit pas d'implémentation mais un découpage en chantiers (lots) : pour chaque lot, son type envisagé, son ordre, ses dépendances pressenties et les CA globaux qu'il couvre. Chaque CA global doit être couvert par au moins un lot.

Attends que l'utilisateur challenge et valide.

## 4. Écrire

1. `atelier template plan` (pour un EPIC : `atelier template plan-epic`) → `plan.md` dans le dossier du chantier, rempli avec la version validée.
2. Pour chaque choix tranché pendant la discussion : une entrée datée dans `decisions.md` (créé depuis `atelier template decisions` s'il n'existe pas), avec l'option écartée et la raison.
3. Commite : `docs(chantiers): [<ID>] plan`.
4. Le plan d'un EPIC s'écrit une fois puis reste tel quel : les écarts vont dans `decisions.md`, la confrontation prévu / réalisé dans le bilan de clôture.
5. Suite : pour un EPIC, fusionner sa branche dans la branche par défaut, puis ouvrir les lots avec `/atelier:new` (`rel_parent: <ID>`). Sinon `/atelier:write-tests` si la spec indique `tdd: yes`, sinon `/atelier:build`. Conseille de repartir d'un contexte propre : le plan porte la mémoire, pas la conversation.
