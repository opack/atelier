---
id: SPIKE-38
type: SPIKE
title: Essai d'un bandeau d'état atelier
status: draft
tdd: no
created_at: 2026-11-27
signed_by:
signed_at:
---

# SPIKE-38 Essai d'un bandeau d'état atelier

<!-- Exploration bornée dans le temps. Le code produit est jetable et n'est jamais fusionné. Le livrable est une réponse. -->

## 1. Question à laquelle répondre
<!-- Une seule question, à laquelle on peut répondre par oui / non ou par un choix entre options. -->
Un bandeau permanent au-dessus du prompt, affichant le chantier, la branche et la prochaine étape atelier, peut-il être fourni par un module de hooks Claude Code (`ui.render` sur `AbovePrompt`, rafraîchi à `session.start` et `turn.complete`), et faut-il le livrer dans le plugin atelier ?

## 2. Pourquoi
<!-- Quelle décision attend cette réponse ? -->
Décider s'il faut ouvrir un `FEAT` qui ajoute ce bandeau au plugin atelier, le proposer comme plugin séparé et facultatif, ou abandonner l'idée.

## 3. Budget
<!-- Temps maximum. Au-delà, on s'arrête et on note ce qu'on sait. -->
2 heures.

## 4. Ce qui compte comme réponse
<!-- Critères pour départager les options (perf mesurée, faisabilité, coût, complexité). -->
Affichage correct : le bandeau s'affiche au-dessus du prompt et se met à jour à chaque tour, avec la bonne branche, le bon chantier et la bonne prochaine étape, sur `main` (sans chantier) comme sur une branche de chantier. Si c'est le cas, on livre dans atelier ou en plugin séparé ; sinon, on abandonne en notant le blocage.

## 5. Pistes à explorer
<!-- Options envisagées. Optionnel. -->
- Sonde existante dans `.sonde-bandeau/` (ignorée par git) : marketplace locale avec un plugin `atelier-bandeau`, dont le module `hooks/register.tsx` lance `atelier status`, analyse sa sortie texte et rend une ligne `atelier · <chantier> · <branche> · <étape>`.
- Lire `atelier status --json` au lieu d'analyser la sortie texte.
- Appeler le `bin/atelier` du plugin installé plutôt que `plugins/atelier/bin/atelier`, chemin qui n'existe que dans ce dépôt.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
