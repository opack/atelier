# Écrire le CLAUDE.md

Le `CLAUDE.md` est lu par Claude au début de chaque session. C’est le seul contexte qu’il a **toujours**. Chaque ligne coûte de l’attention : elle doit servir.

## La règle : le test de suppression

Pour chaque ligne, demandez-vous : **si je l’enlève, Claude se trompe-t-il ?** Si non, supprimez-la.

N’écrivez que ce qui n’est **ni devinable, ni lisible dans le code, ni connu** de Claude.

| À éviter | À préférer |
|---|---|
| « Écris du code propre » | Rien : Claude le sait déjà |
| « Formate bien le code » | « Indentation 2 espaces, Prettier » |
| « Respecte le lint » | « `npm run lint` doit passer » |
| « Fais attention à la sécurité » | « Toute écriture Firestore passe par une règle testée dans `tests/rules/` » |

## Les sections

```markdown
# <Projet>
<1–2 phrases : ce que fait l’app, pour qui.>

## Commandes
- Dev : `…` · Types : `…` · Lint : `…` · Tests : `…` · Test unique : `…`

## Architecture (uniquement ce qui n’est pas évident)
- <Couches imposées et leur ordre>
- <Où vit quoi quand le nom ne le dit pas>

## Conventions non évidentes
- <Règle précise et vérifiable>
- <Vocabulaire métier : terme canonique, termes interdits>

## Interdits
- Ne jamais <action>.
- Aucune dépendance ajoutée sans validation.

## Process (atelier)
- <Ajouté par /atelier:init>
```

## Taille et entretien

- Moins de **100 lignes** à la racine. Au-delà, déplacez vers des [règles par dossier](./contexte), un `CLAUDE.md` de sous-dossier, ou la mémoire.
- Pas de contenu qui change souvent (avancement, TODO).
- Erreur répétée de Claude : ajoutez **une** ligne. Ligne inutile : retirez-la. Relisez le fichier chaque mois.

## Où mettre quoi

| Fichier | Lecteur | Contenu |
|---|---|---|
| `CLAUDE.md` (racine) | Claude, l’équipe | Ce qui précède |
| `CLAUDE.md` (sous-dossier) | Claude, quand il travaille là | Spécificités locales (build, pièges) |
| `CLAUDE.local.md` (ignoré par git) | Vous seul | Préférences personnelles |
| `README.md` | Les humains | Installation, vue d’ensemble. Pas de règles pour Claude |
