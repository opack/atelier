---
id: FEAT-30
type: FEAT
title: Calibrer la rigueur des relectures
status: draft
tdd: no
created_at: 2026-11-24
signed_by:
signed_at:
---

# FEAT-30 Calibrer la rigueur des relectures

## 1. Contexte
<!-- Pourquoi maintenant ? Qui est concerné ? Quel problème (pas la solution) ?
Questions si manquant : quel problème utilisateur, observé où ? Que se passe-t-il si on ne fait rien ? -->

Les trois relecteurs (`spec-critic`, `overfit-checker`, `reviewer`) remontent des points justes, dont certains sont possibles mais peu probables dans l'usage réel du projet. Ils proposent une correction sans en chiffrer le coût, ni le coût de ne rien faire. L'utilisateur n'ose pas refuser un cas qui peut réellement se produire : une petite ligne devient un chantier, et le code, les tests et la maintenance s'alourdissent. Exemples dans ce dépôt : TEC-15 (26 points corrigés sur 28), la revue de la tranche 1 de REF-29 (six durcissements de scripts de preuve jetables), RD2 de FIX-28 (finalement accepté comme limite documentée).

Deuxième effet : chaque relance après correction tire de nouveaux points, y compris sur du code inchangé que le tour précédent pouvait déjà voir. Un LLM relancé produit de nouvelles remarques à chaque tirage : les tours s'enchaînent sans converger.

Enfin, l'agent principal présente parfois les points par leur seul identifiant (« SD1. Je propose… ») : l'utilisateur doit remonter au rapport pour savoir de quoi il s'agit.

Sans rien faire, chaque chantier continue de payer ce surcoût, et l'utilisateur continue d'arbitrer sans les éléments pour le faire.

## 2. Description
<!-- Comportement attendu, du point de vue de l'utilisateur. Hors périmètre explicite.
Questions si manquant : qu'est-ce qui est hors périmètre ? Quelle est la plus petite version utile ? -->

**Ce qui ne change pas** : les relecteurs cherchent et signalent tout ce qu'ils trouvent, petits problèmes compris, avec leurs grilles actuelles (cas limites, sécurité, performance…). Ils proposent toujours une correction. Le chantier ne réduit pas la recherche : il outille la décision.

**Bilan de chaque point à discuter** (`SD`, `OD`, `RD`). En plus de la correction proposée, le relecteur donne :
- le **coût de la correction** : lignes de code et de tests estimées, et tout nouveau concept à maintenir (option, champ, cas particulier, commande) ;
- le **coût de la non-correction** : le scénario concret dans l'usage réel du projet, ce qui arrive alors, et si l'échec est **silencieux** (rien ne le signale : revue validée à tort, donnée perdue ou fausse) ou **bruyant** (erreur claire, visible tout de suite) ;
- un **verdict** : corriger ou ne pas corriger, avec sa raison en une phrase.

L'usage réel (qui utilise le projet, comment, dans quel environnement) se tire des documents existants du projet (`CLAUDE.md`, `README`) : aucun nouveau fichier ni réglage. Quand ces documents ne le disent pas, le relecteur le signale une fois dans son rapport et juge sur ce qu'il voit du code.

**Règle de proportion**. Quand la correction pèse nettement plus lourd que le problème qu'elle traite, le relecteur le dit et propose, à côté de la correction complète, l'option la moins chère : documenter la limite, un message d'erreur clair, ou une idée de chantier séparé. Un point bloquant se corrige quel que soit son coût.

**Relances**. Le premier passage d'un relecteur couvre tout son périmètre. Lors d'une relance après correction (nouvelle revue dans `/atelier:review`, nouveau passage de `spec-critic` ou d'`overfit-checker` dans la même session), le relecteur :
- vérifie les corrections annoncées et signale leurs régressions ;
- peut signaler, quelle que soit sa gravité, un point **causé par une correction**, même sur du code ou du texte déjà relu (un appelant devenu faux, une vérification devenue inutile, un commentaire qui ment désormais), en nommant la correction qui le cause ;
- ne retient un point sur du code ou du texte inchangé, que le passage précédent pouvait déjà voir, que s'il est bloquant ; sinon il le mentionne en une ligne, à part, comme idée, sans traitement exigé.

**Présentation par l'agent principal** (`/atelier:sign`, `/atelier:build`, `/atelier:review`). Chaque point est présenté par son identifiant suivi d'un résumé du problème en quelques mots, puis la correction proposée, son coût, le coût de la non-correction, le verdict du relecteur et l'avis de l'agent : `SD1, les utilisateurs pourraient ne pas voir le bouton : je propose…, ça coûte…, sinon…, avis : …`. Corriger n'est plus le choix implicite : l'utilisateur tranche avec les deux coûts sous les yeux.

**Hors périmètre** :
- les traitements de `revue.md` (`exception acceptée`, `écarté`…) et leur contrôle par `set-reviewed` : inchangés ;
- les grilles de recherche des relecteurs et les cas limites suggérés par les templates de spec : inchangés ;
- un réglage par projet des domaines de relecture ;
- un quota de points par passage ;
- les points bloquants (`SB`, `OB`, `RB`) : leur forme ne change pas, hormis le résumé à la présentation ;
- tout code de `lib/` ou de `bin/` : le chantier ne touche que des consignes (agents, skills) et le site.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

- Agents : `plugins/atelier/agents/spec-critic.md`, `overfit-checker.md`, `reviewer.md` (forme de réponse, règle de proportion, règle de relance).
- Skills : `sign/SKILL.md` (présentation des `SB`/`SD`, relance de `spec-critic`), `build/SKILL.md` (présentation des `OB`/`OD`, relance d'`overfit-checker`), `review/SKILL.md` (présentation des `RB`/`RD`, consignes passées au reviewer lors d'une nouvelle revue : la liste des corrections faites depuis la revue précédente).
- Site : `site/cycle/signature.md`, `site/cycle/implementation.md`, `site/cycle/revue.md` (« Toute évolution du plugin met le site à jour dans la même PR »).
- `plugins/atelier/test/docs.test.mjs` vérifie déjà la présence de marqueurs dans les agents et skills : c'est là que vont d'éventuels tests de présence des consignes.
- Aucun conflit avec REF-29 : rien dans `lib/`.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

- [ ] CA-1 : Étant donné les consignes de `spec-critic`, `overfit-checker` et `reviewer`, quand on les lit, alors chacune demande, pour chaque point à discuter, la correction proposée, son coût (lignes de code et de tests, nouveaux concepts à maintenir), le coût de la non-correction (scénario dans l'usage réel du projet, échec silencieux ou bruyant) et un verdict corriger / ne pas corriger motivé.
- [ ] CA-2 : Étant donné ces trois consignes, quand on les lit, alors chacune dit de tirer l'usage réel du projet de `CLAUDE.md` et du `README`, et de signaler une fois leur silence sur ce point.
- [ ] CA-3 : Étant donné ces trois consignes, quand on les lit, alors chacune énonce la règle de proportion : une correction nettement plus lourde que le problème s'accompagne de l'option la moins chère (documenter la limite, message d'erreur clair, chantier séparé), et un point bloquant se corrige quel que soit son coût.
- [ ] CA-4 : Étant donné ces trois consignes, quand on les lit, alors chacune distingue le premier passage (tout le périmètre) d'une relance (corrections et leurs régressions ; point causé par une correction recevable quelle que soit sa gravité, avec la correction qui le cause ; point sur du code ou du texte inchangé retenu seulement s'il est bloquant, sinon mentionné à part comme idée sans traitement exigé).
- [ ] CA-5 : Étant donné `/atelier:review`, quand il lance une nouvelle revue après des corrections, alors ses consignes lui font passer au reviewer qu'il s'agit d'une relance et la liste des corrections faites depuis la revue précédente ; de même `/atelier:sign` pour une relance de `spec-critic` et `/atelier:build` pour une relance d'`overfit-checker`.
- [ ] CA-6 : Étant donné `/atelier:sign`, `/atelier:build` et `/atelier:review`, quand ils présentent les points d'un relecteur, alors leurs consignes imposent, pour chaque point, l'identifiant suivi d'un résumé du problème en quelques mots, puis la correction, les deux coûts, le verdict du relecteur et l'avis de l'agent.
- [ ] CA-7 : Étant donné le site, quand on lit les pages Signature, Implémentation et Revue, alors elles décrivent le bilan des points à discuter, la règle de proportion et la règle de relance.
- [ ] CA-8 : Étant donné le dépôt, quand `npm test` tourne, alors tous les tests passent, dont ceux de `docs.test.mjs`.

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : N/A, consignes textuelles seulement ; les relecteurs restent en lecture seule.
- Performance : rapports un peu plus longs par point à discuter ; en contrepartie, moins de tours de relance.
- Accessibilité : N/A, aucune interface.
- Données personnelles : N/A.
- Compatibilité : les `revue.md` existants restent valides (format des tableaux et traitements inchangés).

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

Essai réel au premier chantier qui suit : comparer le nombre de points à discuter corrigés et de tours de relance avec TEC-15 et REF-29.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
