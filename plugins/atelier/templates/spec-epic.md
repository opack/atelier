---
id: {{ID}}
type: EPIC
title: {{TITLE}}
status: draft
tdd: no              # un EPIC n'implémente rien : toujours no
integration_branch:  # yes | no (vide : no) : branche d'intégration ; les enfants partent de la branche de l'EPIC et y sont fusionnés par commit de fusion, revue d'ensemble avant une seule fusion dans la branche par défaut ; figée à la signature
created_at: {{DATE}}
signed_by:
signed_at:
---

# {{ID}} {{TITLE}}

<!-- Chantier d'organisation : il n'implémente rien, il définit un chantier plus large que d'autres chantiers concrétisent
(rattachés par `rel_parent: {{ID}}` dans leur en-tête). Étapes : spec → signature → plan (découpage) → chantiers enfants → clôture.
Clôture possible quand tous les enfants sont clos et qu'au moins l'un d'eux est done ; sinon l'EPIC est abandonné. -->

## 1. Vision
<!-- Ce qui existera quand l'EPIC sera réalisé, du point de vue de l'utilisateur.
Questions si manquant : qui l'utilise, pour faire quoi ? À quoi reconnaît-on que c'est fini ? -->

## 2. Pourquoi
<!-- Le problème, le besoin, l'enjeu. Ce qui arrive si on ne fait rien. Pourquoi un ensemble de chantiers plutôt qu'un seul. -->

## 3. Critères d'acceptation globaux
<!-- Ce que l'ensemble doit permettre, vérifiable une fois les chantiers enfants livrés.
Format : - AC-1 : Étant donné …, quand …, alors … -->

## 4. Cadre
<!-- Le cadre commun aux chantiers enfants : choix fonctionnels (vocabulaire, parcours, règles métier) et techniques
(architecture, conventions, contraintes) qu'ils partagent. Ce qui n'est pas cadré ici se décide dans chaque enfant. -->

## 5. Hors périmètre
<!-- Ce que l'EPIC ne couvre pas, même si on pourrait l'y attendre. -->

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
