# Bilan : TEC-2 Site VitePress de la méthode

## 1. Résumé
Un site VitePress (`site/`) présente la méthode atelier : démarrage rapide, fondations, cycle d'un chantier, préparation du projet, travail avec l'agent, équipe, référence du plugin 0.1.1. Il se déploie sur GitHub Pages par un workflow dédié. Relectures humaines faites et Pages activé ; publication à la fusion.

## 2. Livré vs spécifié
| Critère (§5) | Statut | Preuve |
|---|---|---|
| `npm run build` sans erreur ni lien interne mort | Fait | Build local et build de la revue |
| Les 9 templates inclus au build | Fait | Modification d'essai de `adr.md` visible sur la page ; le workflow échoue si une inclusion n'est pas résolue |
| Conformité de la référence au plugin (skills, sous-commandes, hooks, agents) | Fait | Contrôle par script, puis revue : 8 dimensions de revue et sous-commandes `hook-*` ajoutées, rappel de démarrage corrigé |
| Relecture visuelle (bureau, mobile, clair, sombre, recherche) | Fait | Relecture humaine |
| Rien de personnel ni de propre à un client | Fait | Relecture humaine |
| Pages activé (source « GitHub Actions ») | Fait | Action du propriétaire |
| Site publié après fusion, URL qui répond | Après fusion | `https://opack.github.io/atelier/` |

Écart au process : le site (`eaf0d73`, `96b547f`) a été écrit **avant** la signature de la spec. La spec a donc été rédigée en partie pour décrire l'existant, et la relecture critique a imposé ensuite ce qui manquait (inclusion des templates, impacts, retour arrière, vérifications).

## 3. Choix techniques
- VitePress, seule dépendance npm du dépôt, cantonnée à `site/` : le plugin reste sans dépendance.
- Templates inclus par `<!--@include: ...{1,}-->` : l'intervalle de lignes conserve le front matter que VitePress retire sinon.
- Le site fait foi pour la description de la méthode.
- Workflow : permissions `pages`/`id-token` limitées au job `deploy`, historique complet pour les dates de mise à jour, déploiements non interrompus.

## 4. Éléments de code principaux
- `site/.vitepress/config.mjs` : navigation, barre latérale, recherche locale, libellés français, `base: '/atelier/'`.
- `site/reference/` : commandes, hooks et configuration, garanties et limites, templates (inclus), glossaire. C'est la partie qui doit suivre le plugin.
- `site/cycle/` : une page par étape d'un chantier.
- `.github/workflows/site.yml` : build, garde sur les inclusions, déploiement Pages.

## 5. Pistes écartées
- Copie des templates par un script : une étape de plus à ne pas oublier.
- Test de cohérence dans `npm test` : le dépôt racine devrait construire le site.
- Lister les pages Notion reprises dans la spec : remplacé par le critère « rien de personnel ni de propre à un client ».

## 6. Dette et suites
- Réduire `README.md` à un résumé qui renvoie au site (chantier à ouvrir).
- La conformité de la référence au plugin reste une relecture humaine : à refaire à chaque évolution du plugin.
- Liens externes non vérifiés (trou accepté).
- Libellé ARIA « Main Navigation » codé en dur dans VitePress, resté en anglais.
- Le démarrage de session n'affiche pas la phase TDD : FIX possible sur le plugin si on la veut.

## 7. Verdict de revue
Revue indépendante : 2 points bloquants (« sept dimensions » au lieu de huit ; phase TDD annoncée au démarrage sans exister), corrigés dans `f6c923f`. Les 10 points à discuter ont tous été traités dans le même commit : workflow durci, sous-commandes `hook-*`, chemins libres, refus de `freeze-tests`, encadré `/atelier:slice` retiré, garde sur les inclusions, libellés français, socle commun « à venir ». Aucune exception.
- Verdict : accepté
- Validé par : Opack
- Date : 2026-11-20
