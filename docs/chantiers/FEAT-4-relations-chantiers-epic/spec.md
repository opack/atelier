---
id: FEAT-4
type: FEAT
title: Relations entre chantiers et type EPIC
status: signed
tdd: yes
created_at: 2026-11-20
signed_by: Opack
signed_at: 2026-11-20
tests_commit: 3a599c9
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
| `rel_parent` | Le chantier appartient à un EPIC (un seul ; un EPIC peut lui-même appartenir à un EPIC) | Affiché ; compte pour la clôture de l'EPIC |
| `rel_depends_on` | Le chantier ne peut être livré qu'après ceux-ci | Affiché avec leur statut ; vérifié à la clôture |
| `rel_origin` | Le chantier découle de celui-ci (SPIKE, régression, périmètre qui a grossi, suite d'un bilan) | Trace seule, aucune contrainte |
| `rel_replaces` | Le chantier reprend un chantier abandonné | Trace seule |

- Valeurs : un identifiant, ou plusieurs séparés par des virgules (le parseur d'en-tête reste plat).
- Le lien est déclaré chez l'enfant seulement. L'inverse (enfants d'un EPIC, chantiers qui dépendent d'un autre) est calculé par la CLI en lisant les en-têtes.
- Une simple mention reste du texte libre, sans champ.
- **Où les relations sont lues.** Chaque chantier vit sur sa branche jusqu'à sa fusion : la CLI **découvre** les chantiers dans toutes les branches (arbre courant, branches locales, branches distantes connues), mais **juge** leur statut dans l'arbre courant. Un chantier ne compte comme clos que si son statut clos est présent dans la branche où l'on est, c'est-à-dire fusionné : on ne livre pas FEAT-14 si le code de FEAT-12 n'est pas dans la branche, et on ne clôt pas un EPIC pendant qu'un enfant avance sur une autre branche. Le message de refus invite à fusionner la branche par défaut.
- Validation par `check-spec` (bloque la signature) :
  - un identifiant cité dans `rel_parent` ou `rel_depends_on` doit exister dans l'une des branches (une faute de frappe désactiverait la vérification sans bruit) ; `rel_origin` et `rel_replaces`, qui ne sont que de la trace, ne sont vérifiés que sur leur format, pour accepter les identifiants historiques (`BUG-421`) ;
  - `rel_parent` : une seule valeur, qui désigne un EPIC, et un EPIC qui n'est pas clos ;
  - aucune auto-référence, aucun cycle sur `rel_parent` ni sur `rel_depends_on`.
- Une dépendance `abandoned` bloque la clôture comme une dépendance ouverte : il faut retirer la relation (par amendement) ou dépendre du chantier qui la remplace. L'abandon d'un prérequis est une décision explicite.
- `/atelier:new` ne pose de question sur les relations que si le contexte en suggère une.

**Type `EPIC`**, sixième type de chantier, dédié à l'organisation : il n'implémente rien, il définit un chantier plus large que d'autres chantiers concrétisent.

- Spec signée : vision, pourquoi, critères d'acceptation globaux, cadre fonctionnel et technique commun, hors périmètre. Elle ne change que par amendement, comme pour tout chantier.
- `plan.md` : le découpage prévu, sur un template dédié (`plan-epic` : lots, type envisagé, ordre, dépendances pressenties), écrit une fois puis laissé tel quel (consigne du skill, pas de hook). Les écarts vont dans `decisions.md`, la confrontation prévu / réalisé dans `bilan.md`.
- `tdd: no` d'office : la question n'est pas posée, `atelier set-tdd yes` est refusé sur un EPIC, et `check-spec` signale un EPIC dont l'en-tête porte `tdd: yes` (bloque la signature).
- Branche courte `epic/<ID>-<slug>`, le temps d'écrire et de signer la spec puis le plan, puis fusionnée. Aucun code n'y est jamais autorisé hors des chemins libres, même après signature (le débrayage `/atelier:off` reste prioritaire, comme partout).
- Clôture : sur une branche du même nom (réutilisée si elle existe, sinon recréée depuis la branche par défaut) quand tous les enfants sont clos ; le chantier actif reste déduit de la branche, sans règle nouvelle.
- Clôture (`done`) possible seulement quand tous ses enfants sont clos et qu'au moins l'un d'eux est `done` : sinon la vision n'a pas été réalisée et l'EPIC est abandonné (`abandoned`). Un EPIC n'a ni code ni revue : il est exempté de revue, comme le SPIKE.
- Abandon d'un EPIC qui a des enfants ouverts : autorisé, sans cascade ; le message liste les enfants concernés.
- Imbrication : un EPIC peut avoir un EPIC pour parent (« Module gestion client » → « Création client », « Contact client »). Aucune limite de profondeur dans le code ; la clôture est récursive par construction (un EPIC enfant n'est clos que si ses propres enfants le sont). `/atelier:new` met en garde au-delà de deux niveaux.
- Étapes : spec → signature → plan → (chantiers enfants) → clôture.

**Proposer un EPIC au bon moment**, sans que l'utilisateur ait à y penser :
- `/atelier:new` : si la demande couvre plusieurs livrables indépendants (types différents, ou plusieurs PR inévitables), proposer d'ouvrir d'abord un EPIC puis les chantiers rattachés ; à l'inverse, un EPIC demandé pour un seul livrable est un FEAT, et le dire.
- `/atelier:plan` d'un FEAT ou d'un REF : si le découpage produit des tranches qui ne tiennent pas dans un seul chantier, signaler que le périmètre a la taille d'un EPIC, sans forcer.
- Section « Process (atelier) » du `CLAUDE.md` : une ligne sur l'EPIC et les relations, pour que les discussions hors commande (cadrage) y pensent aussi. La section devient un template ; `atelier check-process` vérifie que chacune de ses lignes est présente dans le `CLAUDE.md` du projet (les ajouts du projet sont acceptés). `/atelier:init` relancé sur un projet déjà installé ne se contente plus de vérifier la configuration : il propose d'ajouter les lignes manquantes, sans jamais réécrire sans accord.
- Rattachement après coup : ajouter `rel_parent` à une spec signée passe par un amendement ; un chantier déjà clos n'est pas rattaché, l'EPIC le cite dans son contexte comme travail antérieur.

**Site** : six types dans `fondations/types.md` (sans présenter l'EPIC comme une exception), une section sur les relations entre chantiers, les templates `spec-epic` et `plan-epic` dans Référence > Templates, les commandes concernées mises à jour.

Hors périmètre :
- un graphe ou une vue globale des relations du projet (au-delà de ce qu'affiche `status` pour le chantier courant) ;
- toute relation générique « lié à » ;
- la synchronisation des relations vers Notion (index Notion, chantier ultérieur) ;
- une protection par hook du plan de l'EPIC ou des champs `rel_*`.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->
- `plugins/atelier/lib/core.mjs` : `CHANTIER_TYPES`, `ID_PATTERN` (dérivé des types : les branches `epic/EPIC-n-…` deviennent des chantiers actifs), `TDD_RECOMMENDATION`, `REQUIRED_SECTIONS`, `nextStep`, `decideWrite` ; nouvelles fonctions pures : lecture des `rel_*`, enfants et dépendants calculés, vérification de clôture.
- `plugins/atelier/lib/core.mjs`, `closeProblems` : exemption de revue pour l'EPIC, vérification des dépendances et des enfants.
- `plugins/atelier/lib/cli.mjs` : `status` (affichage des relations), `set-status done` (vérifications), `set-tdd`, `check-spec`, `check-process` (nouveau) ; lecture des en-têtes de spec dans toutes les branches par un appel git groupé (pas un appel par branche).
- `plugins/atelier/templates/` : `spec-epic.md`, `plan-epic.md`, section Process (nouveaux).
- Effet de bord accepté : avec `EPIC` dans `ID_PATTERN`, une ancienne branche du type `feature/epic-12-…` est vue comme le chantier EPIC-12 (le hook parle alors de spec non signée au lieu d'absence de chantier).
- Skills : `new` (type EPIC, `tdd: no`, questions de relation, proposition d'un EPIC), `plan` (découpage d'un EPIC, signal d'un périmètre trop grand), `status`, `close` (EPIC et dépendances), `init` (mise à jour de la section Process).
- Section Process du `CLAUDE.md` : aujourd'hui écrite en dur dans le skill `init` ; la sortir dans un template pour que la CLI puisse la comparer à celle du projet.
- `plugins/atelier/test/core.test.mjs` : tests de la logique et du hook d'écriture (règle du `CLAUDE.md`).
- Site : `site/fondations/types.md`, `site/fondations/chantier.md`, `site/reference/templates.md`, `site/reference/commandes.md`, `README.md` (table des types).

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->
Aucune : les questions relevées à l'écriture et à la relecture critique sont tranchées dans la description.

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné un en-tête `rel_depends_on: FEAT-12,  tec-15`, quand il est lu, alors les relations valent `['FEAT-12', 'TEC-15']` (espaces tolérés, casse normalisée, doublons retirés) ; un champ vide ou absent donne une liste vide.
- [ ] CA-2 : Étant donné des chantiers répartis entre l'arbre courant et d'autres branches, dont deux portent `rel_parent: EPIC-5` (l'un fusionné, l'autre seulement sur sa branche), quand on calcule les enfants de EPIC-5, alors on obtient exactement ces deux chantiers ; celui qui n'est que sur sa branche compte comme ouvert, quel que soit son statut sur cette branche.
- [ ] CA-3 : Étant donné un chantier signé dont `rel_depends_on` cite un chantier qui n'est pas `done` dans l'arbre courant (ouvert, `abandoned`, ou clos seulement sur une branche non fusionnée), quand on lance `atelier set-status done`, alors la clôture est refusée avec un message qui nomme le chantier bloquant et son statut.
- [ ] CA-4 : Étant donné un chantier dont toutes les dépendances sont `done` dans l'arbre courant, quand on lance `atelier set-status done`, alors la vérification des relations ne bloque pas.
- [ ] CA-5 : Étant donné une spec, quand on lance `atelier check-spec`, alors sont signalés comme manques (bloquant la signature) : un identifiant de `rel_parent` ou `rel_depends_on` introuvable dans toutes les branches ; un identifiant mal formé dans n'importe quel `rel_*` ; plusieurs valeurs dans `rel_parent` ; un `rel_parent` qui ne désigne pas un EPIC, ou un EPIC clos ; une auto-référence ; un cycle sur `rel_parent` ou sur `rel_depends_on`. Un `rel_origin` vers un identifiant historique sans dossier n'est pas signalé.
- [ ] CA-6 : Étant donné le type `EPIC`, quand on lance `atelier next-id EPIC`, alors l'identifiant suit le compteur unique du projet ; et une branche `epic/EPIC-7-x` est reconnue comme chantier actif EPIC-7.
- [ ] CA-7 : Étant donné `atelier template spec-epic`, quand le template est produit, alors il contient `tdd: no` et les sections Vision, Pourquoi, Critères d'acceptation globaux, Cadre, Hors périmètre, que `check-spec` exige avant signature ; `atelier template plan-epic` produit le template de découpage ; `atelier set-tdd yes` est refusé sur un EPIC ; et `check-spec` signale comme manque un EPIC dont l'en-tête porte `tdd: yes`.
- [ ] CA-8 : Étant donné un EPIC signé sur sa branche, sans débrayage, quand l'agent écrit un fichier hors des chemins libres, alors l'écriture est refusée avec un message qui explique qu'un EPIC n'implémente rien ; une écriture dans `docs/` reste autorisée.
- [ ] CA-9 : Étant donné un EPIC signé, quand on lance `atelier set-status done`, alors : aucune revue n'est exigée ; la clôture est refusée avec la liste des enfants ouverts s'il en reste ; refusée si aucun enfant n'est `done` (aucun enfant, ou tous abandonnés) ; permise quand tous les enfants sont clos et au moins un est `done`. Un EPIC enfant ouvert bloque la clôture de son EPIC parent. `atelier set-status abandoned` reste permis avec des enfants ouverts et les liste.
- [ ] CA-10 : Étant donné un EPIC signé, quand on demande la prochaine étape, alors `status` indique : concevoir le découpage sans `plan.md` ; sinon les enfants encore ouverts et leur nombre ; puis la clôture quand tous sont clos ; sans jamais proposer `/atelier:review`.
- [ ] CA-11 : Étant donné un chantier courant avec des relations, quand on lance `atelier status`, alors il affiche son parent, ses dépendances avec leur statut, son origine, ce qu'il remplace et, pour un EPIC, ses enfants directs calculés avec leur statut.
- [ ] CA-12 : Étant donné un `CLAUDE.md`, quand on lance `atelier check-process`, alors les lignes du template de la section « Process (atelier) » absentes du fichier sont listées (toutes si la section est absente) ; si toutes sont présentes, rien n'est signalé, même si le projet a ajouté ses propres lignes.
- [ ] CA-13 : Étant donné le site, quand on lance `npm run build` dans `site/`, alors il réussit, la page des types présente six types et la page Templates inclut les templates `spec-epic` et `plan-epic`.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : N/A, aucun nouvel accès ; les champs `rel_*` sont du texte déclaratif, ils ne déclenchent aucune commande.
- Performance : la découverte lit les en-têtes de spec de toutes les branches par un appel git groupé ; quelques centaines de chantiers et quelques dizaines de branches doivent rester sous 100 ms environ, sans cache. Indication, pas critère d'acceptation.
- Accessibilité : N/A, sortie texte de la CLI et pages statiques du site déjà existantes.
- Données personnelles : N/A, aucune donnée nouvelle.
- Compatibilité : les specs existantes sans `rel_*` se comportent exactement comme avant ; Node ≥ 20, aucune dépendance, parseur d'en-tête plat conservé.

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->
Dépôts git fictifs créés dans un répertoire temporaire par les tests : un EPIC avec deux enfants (un fusionné `done`, un ouvert sur sa seule branche), un EPIC imbriqué, un FEAT dépendant d'un chantier `signed` puis `done`, une dépendance close sur une branche non fusionnée, une relation vers un identifiant inexistant, un cycle de dépendances, un `rel_origin` vers `BUG-421`.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
- 2026-11-20 : `check-spec` signale un EPIC dont l'en-tête porte `tdd: yes` (description et CA-7), pour que « `tdd: no` d'office » tienne aussi avant la signature, quand l'en-tête est encore modifiable à la main ; relevé à la conception.
