---
id: FEAT-4
type: FEAT
title: Relations entre chantiers et type EPIC
status: draft
tdd: yes
created_at: 2026-11-20
signed_by:
signed_at:
---

# FEAT-4 Relations entre chantiers et type EPIC

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->
Les chantiers ne vivent pas isolés : un chantier en suppose un autre, naît d'un SPIKE, d'une régression ou d'un périmètre qui a grossi, ou contribue à un ensemble plus large. atelier n'en trace rien aujourd'hui : l'en-tête de spec n'a aucun champ de relation, aucune commande ne lit ni ne vérifie un lien, et aucun type ne porte une vision qui se réalise à travers plusieurs chantiers. Sans outil, on clôt un chantier dont un prérequis n'est pas livré, on perd l'origine d'un FIX ou d'un FEAT, et un grand sujet n'a ni cadre commun ni bilan d'ensemble.

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->
**Relations entre chantiers**, déclarées dans l'en-tête de la spec, préfixe `rel_` :

| Champ | Sens | Effet |
|---|---|---|
| `rel_parent` | Le chantier appartient à un EPIC (un seul) | Affiché ; compte pour la clôture de l'EPIC |
| `rel_depends_on` | Le chantier ne peut être livré qu'après ceux-ci | Affiché avec leur statut ; vérifié à la clôture |
| `rel_origin` | Le chantier découle de celui-ci (SPIKE, régression, périmètre qui a grossi, suite d'un bilan) | Trace seule, aucune contrainte |
| `rel_replaces` | Le chantier reprend un chantier abandonné | Trace seule |

- Valeurs : un identifiant, ou plusieurs séparés par des virgules (le parseur d'en-tête reste plat).
- Le lien est déclaré chez l'enfant seulement. L'inverse (enfants d'un EPIC, chantiers qui dépendent d'un autre) est calculé par la CLI en lisant les en-têtes.
- Une simple mention reste du texte libre, sans champ.
- Un identifiant cité dans un `rel_*` doit exister dans le dossier des chantiers : sinon `check-spec` le signale et la signature est bloquée (une faute de frappe désactiverait la vérification sans bruit).
- Une dépendance `abandoned` bloque la clôture comme une dépendance ouverte : il faut retirer la relation (par amendement) ou dépendre du chantier qui la remplace. L'abandon d'un prérequis est une décision explicite.
- `/atelier:new` ne pose de question sur les relations que si le contexte en suggère une.

**Type `EPIC`**, sixième type de chantier, dédié à l'organisation : il n'implémente rien, il définit un chantier plus large que d'autres chantiers concrétisent.

- Spec signée : vision, pourquoi, critères d'acceptation globaux, cadre fonctionnel et technique commun, hors périmètre. Elle ne change que par amendement, comme pour tout chantier.
- `plan.md` : le découpage prévu, sur un template dédié (`plan-epic` : lots, type envisagé, ordre, dépendances pressenties), écrit une fois puis laissé tel quel (consigne du skill, pas de hook). Les écarts vont dans `decisions.md`, la confrontation prévu / réalisé dans `bilan.md`.
- `tdd: no` d'office : la question n'est pas posée.
- Branche courte `epic/<ID>-<slug>`, le temps d'écrire et de signer la spec puis le plan. Aucun code n'y est jamais autorisé hors des chemins libres, même après signature.
- Clôture : sur une branche du même nom, rouverte depuis la branche par défaut quand tous les enfants sont clos ; le chantier actif reste déduit de la branche, sans règle nouvelle.
- Clôture (`done`) possible seulement quand tous ses chantiers enfants sont clos, et s'il en a au moins un. Un EPIC sans enfant ne se clôt pas en `done` : il est abandonné (`abandoned`).
- Étapes : spec → signature → plan → (chantiers enfants) → clôture.

**Proposer un EPIC au bon moment**, sans que l'utilisateur ait à y penser :
- `/atelier:new` : si la demande couvre plusieurs livrables indépendants (types différents, ou plusieurs PR inévitables), proposer d'ouvrir d'abord un EPIC puis les chantiers rattachés ; à l'inverse, un EPIC demandé pour un seul livrable est un FEAT, et le dire.
- `/atelier:plan` d'un FEAT ou d'un REF : si le découpage produit des tranches qui ne tiennent pas dans un seul chantier, signaler que le périmètre a la taille d'un EPIC, sans forcer.
- Section « Process (atelier) » du `CLAUDE.md` : une ligne sur l'EPIC et les relations, pour que les discussions hors commande (cadrage) y pensent aussi. `/atelier:init` relancé sur un projet déjà installé propose de mettre cette section à jour quand elle diffère de la version courante.
- Rattachement après coup : ajouter `rel_parent` à une spec signée passe par un amendement ; un chantier déjà clos n'est pas rattaché, l'EPIC le cite dans son contexte comme travail antérieur.

**Site** : six types dans `fondations/types.md` (sans présenter l'EPIC comme une exception), une section sur les relations entre chantiers, le template de spec EPIC dans Référence > Templates, les commandes concernées mises à jour.

Hors périmètre :
- un graphe ou une vue globale des relations du projet (au-delà de ce qu'affiche `status` pour le chantier courant) ;
- toute relation générique « lié à » ;
- la synchronisation des relations vers Notion (index Notion, chantier ultérieur) ;
- une protection par hook du plan de l'EPIC ou des champs `rel_*`.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->
- `plugins/atelier/lib/core.mjs` : `CHANTIER_TYPES`, `ID_PATTERN` (dérivé des types : les branches `epic/EPIC-n-…` deviennent des chantiers actifs), `TDD_RECOMMENDATION`, `REQUIRED_SECTIONS`, `nextStep`, `decideWrite` ; nouvelles fonctions pures : lecture des `rel_*`, enfants et dépendants calculés, vérification de clôture.
- `plugins/atelier/lib/cli.mjs` : `status` (affichage des relations), `set-status done` (vérifications), `check-spec`.
- `plugins/atelier/templates/spec-epic.md` (nouveau), éventuellement le plan.
- Skills : `new` (type EPIC, `tdd: no`, questions de relation, proposition d'un EPIC), `plan` (découpage d'un EPIC, signal d'un périmètre trop grand), `status`, `close` (EPIC et dépendances), `init` (mise à jour de la section Process).
- Section Process du `CLAUDE.md` : aujourd'hui écrite en dur dans le skill `init` ; la sortir dans un template pour que la CLI puisse la comparer à celle du projet.
- `plugins/atelier/test/core.test.mjs` : tests de la logique et du hook d'écriture (règle du `CLAUDE.md`).
- Site : `site/fondations/types.md`, `site/fondations/chantier.md`, `site/reference/templates.md`, `site/reference/commandes.md`, `README.md` (table des types).

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->
Aucune : les cinq questions relevées à l'écriture (branche de clôture d'un EPIC, dépendance abandonnée, EPIC sans enfant, plan d'EPIC, identifiant inconnu) sont tranchées dans la description.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->
- [ ] CA-1 : Étant donné un en-tête `rel_depends_on: FEAT-12,  tec-15`, quand il est lu, alors les relations valent `['FEAT-12', 'TEC-15']` (espaces tolérés, casse normalisée, doublons retirés) ; un champ vide ou absent donne une liste vide.
- [ ] CA-2 : Étant donné plusieurs chantiers dont deux portent `rel_parent: EPIC-5`, quand on calcule les enfants de EPIC-5, alors on obtient exactement ces deux chantiers avec leur statut.
- [ ] CA-3 : Étant donné un chantier signé dont `rel_depends_on` cite un chantier qui n'est pas `done` (ouvert ou `abandoned`), quand on lance `atelier set-status done`, alors la clôture est refusée avec un message qui nomme le chantier bloquant et son statut.
- [ ] CA-4 : Étant donné un chantier dont toutes les dépendances sont `done`, quand on lance `atelier set-status done`, alors la vérification des relations ne bloque pas.
- [ ] CA-5 : Étant donné un `rel_*` qui cite un identifiant introuvable dans le dossier des chantiers, quand on lance `atelier check-spec`, alors l'identifiant est signalé comme un manque, ce qui bloque la signature.
- [ ] CA-6 : Étant donné le type `EPIC`, quand on lance `atelier next-id EPIC`, alors l'identifiant suit le compteur unique du projet ; et une branche `epic/EPIC-7-x` est reconnue comme chantier actif EPIC-7.
- [ ] CA-7 : Étant donné `atelier template spec-epic`, quand le template est produit, alors il contient `tdd: no` et les sections Vision, Pourquoi, Critères d'acceptation globaux, Cadre, Hors périmètre, que `check-spec` exige avant signature ; et `atelier template plan-epic` produit le template de découpage.
- [ ] CA-8 : Étant donné un EPIC signé sur sa branche, quand l'agent écrit un fichier hors des chemins libres, alors l'écriture est refusée avec un message qui explique qu'un EPIC n'implémente rien ; une écriture dans `docs/` reste autorisée.
- [ ] CA-9 : Étant donné un EPIC dont au moins un enfant n'est ni `done` ni `abandoned`, quand on lance `atelier set-status done`, alors la clôture est refusée avec la liste des enfants ouverts ; quand tous sont clos, elle est permise ; un EPIC sans aucun enfant ne peut pas passer en `done`, seulement en `abandoned`.
- [ ] CA-10 : Étant donné un EPIC signé, quand on demande la prochaine étape, alors `status` indique : concevoir le découpage sans `plan.md` ; sinon les enfants encore ouverts et leur nombre ; puis la clôture quand tous sont clos.
- [ ] CA-11 : Étant donné un chantier courant avec des relations, quand on lance `atelier status`, alors il affiche son parent, ses dépendances avec leur statut, son origine, ce qu'il remplace et, pour un EPIC, ses enfants calculés.
- [ ] CA-12 : Étant donné un `CLAUDE.md` dont la section « Process (atelier) » diffère du template courant (ou est absente), quand la CLI compare les deux, alors elle signale la section comme à mettre à jour ; identique, elle ne signale rien.
- [ ] CA-13 : Étant donné le site, quand on lance `npm run build` dans `site/`, alors il réussit, la page des types présente six types et la page Templates inclut le template de spec EPIC.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : N/A, aucun nouvel accès ; les champs `rel_*` sont du texte déclaratif, ils ne déclenchent aucune commande.
- Performance : le calcul des enfants lit l'en-tête de chaque spec du dossier des chantiers ; quelques centaines de chantiers doivent rester sous 100 ms, sans cache.
- Accessibilité : N/A, sortie texte de la CLI et pages statiques du site déjà existantes.
- Données personnelles : N/A, aucune donnée nouvelle.
- Compatibilité : les specs existantes sans `rel_*` se comportent exactement comme avant ; Node ≥ 20, aucune dépendance, parseur d'en-tête plat conservé.

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->
Dossiers de chantiers fictifs créés dans un répertoire temporaire par les tests : un EPIC avec deux enfants (un `done`, un `signed`), un FEAT dépendant d'un chantier `signed` puis `done`, une relation vers un identifiant inexistant.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
