# Décisions : TEC-2 Site VitePress de la méthode

## 2026-11-20 : inclure les templates avec un intervalle de lignes `{1,}`
- Contexte : sans intervalle, l'inclusion VitePress d'un fichier `.md` retire son front matter, qui fait partie des templates de spec.
- Écarté : copie générée par un script (une étape de plus à ne pas oublier) ; renommer les templates pour éviter l'extension `.md` (casse le plugin).
- Conséquence : un chemin d'inclusion cassé ne fait pas échouer le build (VitePress laisse le commentaire tel quel). Renommer un template impose de mettre à jour `site/reference/templates.md`, et la page affiche alors le commentaire brut, ce qui se voit à la relecture.

## 2026-11-20 : faire échouer le workflow sur une inclusion non résolue
- Contexte : la revue relève que le risque d'une inclusion cassée, accepté plus haut, ne repose que sur la relecture.
- Écarté : un test dans `npm test` (le dépôt racine ne dépend pas de VitePress, il faudrait construire le site).
- Conséquence : le job `build` échoue si `@include` reste dans la page Templates construite. Le libellé ARIA « Main Navigation » de VitePress est codé en dur et reste en anglais.
