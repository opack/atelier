---
description: Ouvre un chantier atelier (FEAT, FIX, REF, TEC, SPIKE) — identifiant, branche, dossier — et construit la spec en posant des questions uniquement sur ce qui manque.
argument-hint: "[type] [titre, description, lien Notion ou Sentry]"
---

# Ouvrir un chantier

> La commande `atelier` est fournie par le plugin. Si elle est introuvable, utilise `node "${CLAUDE_PLUGIN_ROOT}/bin/atelier"`.

Arguments reçus : `$ARGUMENTS`

## 1. Préalables

- Lance `atelier status --json`. Si `installed` vaut `false`, arrête-toi et propose `/atelier:init`.
- Si la branche courante porte déjà un chantier, demande s'il faut en ouvrir un nouveau ou continuer celui-ci.
- Si le dépôt a des modifications non commitées, signale-le avant de changer de branche.

## 2. Type

Déduis le type des arguments s'il est donné ou évident, sinon demande-le :

| Type | Pour |
|---|---|
| `FEAT` | Fonctionnalité à créer ou améliorer (impact utilisateur) |
| `FIX` | Correction d'un bug |
| `REF` | Restructuration du code, comportement inchangé |
| `TEC` | Technique sans impact utilisateur direct : CI, outillage, dépendances, config, sécurité, infra, migration, petite maintenance |
| `SPIKE` | Exploration bornée dans le temps ; code jetable |

## 3. Identifiant, branche, dossier

1. Si l'utilisateur a fourni un identifiant, utilise-le. Sinon : `atelier next-id <TYPE>`.
2. Slug : 2 à 5 mots du titre, en minuscules, sans accents, séparés par des tirets.
3. Branche : `git switch -c <type en minuscules>/<ID>-<slug>` depuis la branche par défaut à jour (demande si tu n'es pas sur la branche par défaut).
4. Dossier : `docs/chantiers/<ID>-<slug>/` (ou le `chantiersDir` de la configuration).
5. Spec : `atelier template spec-<type en minuscules>` ; remplace `{{ID}}`, `{{TITLE}}`, `{{DATE}}` (AAAA-MM-JJ) et écris `spec.md`.

## 4. Remplir la spec

Sources possibles, à exploiter avant de poser la moindre question :

- **Lien Notion** : récupère la page avec l'outil Notion et reporte son contenu dans les sections correspondantes. Ne recopie pas le brouillon tel quel : reformule dans la structure du template, sans rien inventer. Note le lien dans l'en-tête (`notion:`).
- **Lien Sentry ou issue** (surtout pour un `FIX`) : récupère trace, breadcrumbs, release, volume, et rédige problème, reproduction et cause probable avec sa preuve. Note la source dans l'en-tête (`source:`).
- **Description dans les arguments ou la conversation.**
- **Le code** : lis les fichiers concernés pour ancrer la spec dans la réalité (noms exacts, couches, contraintes).

Puis, **section par section**, pose des questions **uniquement** quand une section est :
- absente ou vide ;
- imprécise (ex. « rapide », « simple », sans valeur ni seuil) ;
- invérifiable (un critère d'acceptation qui ne peut pas devenir un test automatique) ;
- contredite par le code ;
- marquée « N/A » sans raison.

Ne fais jamais confirmer ce qui est déjà écrit et correct. Les commentaires `<!-- -->` du template donnent les questions utiles par section. Pose au plus 5 questions à la fois, groupées, en citant la section.

Règles d'écriture :
- Critères d'acceptation numérotés `CA-1`, `CA-2`… au format « Étant donné …, quand …, alors … », chacun testable.
- Laisse les commentaires du template en place : ils guident les relectures suivantes.
- Ne tranche pas le périmètre à la place de l'utilisateur : propose, il décide.

## 5. Décider : TDD ou pas ?

Cette décision appartient à l'utilisateur : **pose toujours la question**, même si tout le reste de la spec est complet, sauf s'il y a déjà répondu (champ `tdd` renseigné ou réponse explicite dans la conversation).

Formule-la avec ta recommandation, en une ou deux lignes : « Faut-il mener ce chantier en TDD (tests écrits, commités et figés avant l'implémentation) ? Je recommande oui / non, parce que … ».

Repères pour recommander :
- **Oui** quand le comportement se décrit en paires entrée / sortie vérifiables : logique métier, calculs, règles d'autorisation, transformations de données, bug reproductible, refactor d'un code sensible.
- **Non** quand un test coûterait plus qu'il ne protège : configuration, montée de version, changement de texte ou de mise en page, prototype, exploration, câblage trivial déjà couvert ailleurs.
- Par défaut selon le type : `FEAT`, `FIX`, `REF` → plutôt oui ; `TEC`, `SPIKE` → plutôt non. Le contenu du chantier prime sur le type.

« Non » ne veut pas dire « aucun test » : des tests peuvent être ajoutés là où ils ont de la valeur, simplement sans phase imposée. Pas de test pour le principe.

Enregistre la réponse : `atelier set-tdd yes` ou `atelier set-tdd no [raison]`.

## 6. Vérifier

Lance `atelier check-spec docs/chantiers/<ID>-<slug>/spec.md`. Tant qu'il reste des points, traite-les avec l'utilisateur ou note ceux qu'il choisit de laisser pour plus tard.

## 7. Fin

Ne commite pas encore : la spec est commitée à la signature. Indique : `/atelier:sign` quand la spec te convient.
