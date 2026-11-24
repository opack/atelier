---
id: FEAT-30
type: FEAT
title: Calibrer la rigueur des relectures
status: signed
tdd: no
created_at: 2026-11-24
signed_by: Opack
signed_at: 2026-11-24
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

**Bilan de chaque point**, bloquant ou à discuter (`SB`, `SD`, `OB`, `OD`, `RB`, `RD`). En plus de la correction proposée, le relecteur donne :
- le **coût de la correction** : lignes de code et de tests estimées, et tout nouveau concept à maintenir (option, champ, cas particulier, commande) ;
- le **coût de la non-correction** : le scénario concret dans l'usage réel du projet, ce qui arrive alors, et si l'échec est **silencieux** (rien ne le signale : revue validée à tort, donnée perdue ou fausse) ou **bruyant** (erreur claire, visible tout de suite) ;
- un **verdict** : corriger ou ne pas corriger, avec sa raison en une phrase.

Pour un point bloquant, le verdict est « corriger » par définition : le bilan sert à justifier la gravité. Si le coût de la non-correction ne montre pas d'échec réel dans l'usage du projet, le point est à discuter, pas bloquant, et le relecteur le classe comme tel.

Quand le point est une question plutôt qu'une correction (ambiguïté d'une spec, par exemple), le relecteur donne la réponse qu'il retiendrait par défaut, le coût de cette réponse, et le risque de laisser l'ambiguïté (SD6).

L'usage réel (qui utilise le projet, comment, dans quel environnement) se tire des documents existants du projet (`CLAUDE.md`, `README`) : aucun nouveau fichier ni réglage. Quand ces documents ne le disent pas, le relecteur le signale une fois dans son rapport et juge sur ce qu'il voit du code.

**Règle de proportion**. Quand la correction pèse nettement plus lourd que le problème qu'elle traite, le relecteur le dit et propose, à côté de la correction complète, l'option la moins chère : documenter la limite, un message d'erreur clair, ou une idée de chantier séparé. Pour un point bloquant, l'option la moins chère doit supprimer le problème bloquant (par exemple refuser un cas par une erreur claire plutôt que le prendre en charge) : documenter ou reporter ne suffit pas. L'utilisateur garde les traitements existants (SD3).

**Relances** (SD4). Le premier passage d'un relecteur couvre tout son périmètre. Une **relance** est un nouveau passage sur la même portée après des corrections :
- `/atelier:review` : une nouvelle revue de la même tranche (ou du chantier) après correction de points de la revue précédente. La revue de la tranche suivante et la revue du chantier sont des premiers passages. Le reviewer reçoit le commit de la revue précédente (consigné dans `revue.md`) : ce qui n'a pas changé depuis ce commit est « inchangé ».
- `/atelier:sign` et `/atelier:build` : un nouveau passage de `spec-critic` ou d'`overfit-checker` dans la même session, après des retouches. L'agent principal lui transmet les points précédents et les sections ou fichiers modifiés. Un passage dans une nouvelle session est un premier passage.

Lors d'une relance, le relecteur :
- vérifie les corrections annoncées et signale leurs régressions ;
- peut signaler, quelle que soit sa gravité, un point **causé par une correction**, même sur du code ou du texte déjà relu (un appelant devenu faux, une vérification devenue inutile, un commentaire qui ment désormais), en nommant la correction qui le cause ;
- ne retient un point sur du code ou du texte inchangé, que le passage précédent pouvait déjà voir, que s'il est bloquant ; sinon il le mentionne en une ligne, à part, comme **idée**, sans traitement exigé.

Une idée ne porte aucun identifiant et n'entre pas dans les tableaux `### Bloquant` / `### À discuter` de `revue.md` : `set-reviewed` ne la voit donc pas. Elle peut figurer en texte libre sous la section de la revue. Si l'utilisateur veut la traiter, elle devient un point nouveau, avec son numéro (SB1).

**Présentation par l'agent principal** (`/atelier:sign`, `/atelier:build`, `/atelier:review`). Chaque point est présenté par son identifiant suivi d'un résumé du problème en quelques mots, puis la correction proposée, son coût, le coût de la non-correction, le verdict du relecteur et l'avis de l'agent : `SD1, les utilisateurs pourraient ne pas voir le bouton : je propose…, ça coûte…, sinon…, avis : …`. Corriger n'est plus le choix implicite : l'utilisateur tranche avec les deux coûts sous les yeux.

**Traitement consigné** (SD2). Dans `/atelier:review`, chaque issue d'un point correspond à un traitement existant : ne pas corriger (verdict suivi) → `exception acceptée`, avec le verdict pour motif ; chantier séparé → `reporté` ; limite documentée → `corrigé` avec le commit de la documentation. `écarté` reste réservé au point non fondé.

**Hors périmètre** :
- les traitements de `revue.md` (`exception acceptée`, `écarté`…) et leur contrôle par `set-reviewed` : inchangés ;
- les grilles de recherche des relecteurs et les cas limites suggérés par les templates de spec : inchangés ;
- un réglage par projet des domaines de relecture ;
- un quota de points par passage ;
- tout code de `lib/` ou de `bin/` : le chantier ne touche que des consignes (agents, skills) et le site.

## 3. Points techniques identifiés
<!-- Fichiers / couches concernés, contraintes, dépendances. Optionnel. -->

- Agents : `plugins/atelier/agents/spec-critic.md`, `overfit-checker.md`, `reviewer.md` (forme de réponse, règle de proportion, règle de relance).
- Skills : `sign/SKILL.md` (présentation des `SB`/`SD`, relance de `spec-critic`), `build/SKILL.md` (présentation des `OB`/`OD`, relance d'`overfit-checker`), `review/SKILL.md` (présentation des `RB`/`RD`, consignes passées au reviewer lors d'une nouvelle revue : la liste des corrections faites depuis la revue précédente).
- Site : `site/cycle/signature.md`, `site/cycle/implementation.md`, `site/cycle/revue.md` (« Toute évolution du plugin met le site à jour dans la même PR »), et `README.md`, qui décrit les points de relecture (SD7).
- `plugins/atelier/test/docs.test.mjs` vérifie déjà la présence de marqueurs dans les agents et skills : les tests de présence de CA-8 y vont (SD5). Il interdit aussi « tour(s) de revue », « tour N » et « à chaque tour » dans `reviewer.md`, `review/SKILL.md`, le site et le README : parler de « relance » et de « revue », jamais de « tour ».
- Aucun conflit avec REF-29 : rien dans `lib/`.

## 4. Questions ouvertes
<!-- Questions à trancher avant ou pendant la conception. Les réponses vont dans decisions.md. Optionnel. -->

## 5. Critères d'acceptation
<!-- Format : - [ ] CA-1 : Étant donné …, quand …, alors …
Chacun testable automatiquement. Penser aux cas limites : vide, doublon, hors-ligne, utilisateur non autorisé, grand volume.
Questions si manquant : chaque critère peut-il devenir un test ? Que se passe-t-il si la liste est vide, très grande, si l'utilisateur n'a pas le droit, si le réseau tombe ? -->

- [ ] CA-1 : Étant donné les consignes de `spec-critic`, `overfit-checker` et `reviewer`, quand on les lit, alors chacune demande, pour chaque point, bloquant ou à discuter, la correction proposée, son coût (lignes de code et de tests, nouveaux concepts à maintenir), le coût de la non-correction (scénario dans l'usage réel du projet, échec silencieux ou bruyant) et un verdict corriger / ne pas corriger motivé (toujours « corriger » pour un bloquant, dont le bilan justifie la gravité, faute de quoi le point est à discuter) ; pour un point qui est une question, la réponse par défaut et le risque de laisser l'ambiguïté.
- [ ] CA-2 : Étant donné ces trois consignes, quand on les lit, alors chacune dit de tirer l'usage réel du projet de `CLAUDE.md` et du `README`, et de signaler une fois leur silence sur ce point.
- [ ] CA-3 : Étant donné ces trois consignes, quand on les lit, alors chacune énonce la règle de proportion : une correction nettement plus lourde que le problème s'accompagne de l'option la moins chère (documenter la limite, message d'erreur clair, chantier séparé), et, pour un point bloquant, l'option la moins chère doit supprimer le problème bloquant (documenter ou reporter ne suffit pas).
- [ ] CA-4 : Étant donné ces trois consignes, quand on les lit, alors chacune distingue le premier passage (tout le périmètre) d'une relance (corrections et leurs régressions ; point causé par une correction recevable quelle que soit sa gravité, avec la correction qui le cause ; point sur du code ou du texte inchangé retenu seulement s'il est bloquant, sinon mentionné à part comme idée, sans identifiant ni place dans les tableaux de `revue.md`).
- [ ] CA-5 : Étant donné `/atelier:review`, quand il lance une nouvelle revue de la même portée après des corrections, alors ses consignes définissent la relance (la revue de la tranche suivante et celle du chantier sont des premiers passages) et lui font passer au reviewer le commit de la revue précédente et la liste des corrections faites depuis ; de même `/atelier:sign` et `/atelier:build` pour une relance de `spec-critic` ou d'`overfit-checker` dans la même session (points précédents, sections ou fichiers modifiés), un passage dans une nouvelle session étant un premier passage. `/atelier:review` dit aussi qu'une idée de relance n'entre pas dans `revue.md` comme point, et associe chaque issue d'un point à son traitement (ne pas corriger → `exception acceptée`, chantier séparé → `reporté`, limite documentée → `corrigé`).
- [ ] CA-6 : Étant donné `/atelier:sign`, `/atelier:build` et `/atelier:review`, quand ils présentent les points d'un relecteur, alors leurs consignes imposent, pour chaque point, bloquant ou à discuter, l'identifiant suivi d'un résumé du problème en quelques mots, puis la correction, les deux coûts, le verdict du relecteur et l'avis de l'agent.
- [ ] CA-7 : Étant donné le site et le `README`, quand on lit les pages Signature, Implémentation et Revue et le passage du `README` sur les points de relecture, alors ils décrivent le bilan des points, la règle de proportion et la règle de relance.
- [ ] CA-8 : Étant donné le dépôt, quand `npm test` tourne, alors tous les tests passent, dont, dans `docs.test.mjs`, un test de présence étiqueté `[FEAT-30 CA-x]` pour chacun des critères CA-1 à CA-7, qui vérifie dans les fichiers concernés des marqueurs de la règle (par exemple « coût de la correction », « silencieux », « relance », « idée »).

## 6. Non-fonctionnel
<!-- Une ligne chacun, ou « N/A » + raison.
Questions si manquant : qui peut lire / écrire quoi, et où l'autorisation est-elle vérifiée côté serveur ? Quel volume réaliste ? Comment l'utilise-t-on au clavier et au lecteur d'écran ? -->
- Sécurité / autorisation : N/A, consignes textuelles seulement ; les relecteurs restent en lecture seule.
- Performance : rapports un peu plus longs par point ; en contrepartie, moins de tours de relance.
- Accessibilité : N/A, aucune interface.
- Données personnelles : N/A.
- Compatibilité : les `revue.md` existants restent valides (format des tableaux et traitements inchangés).

## 7. Données de test
<!-- Jeux de données, comptes, cas à reproduire. Optionnel. -->

Essai réel au premier chantier qui suit : comparer le nombre de points à discuter corrigés et de tours de relance avec TEC-15 et REF-29.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec (date, quoi, pourquoi). -->
