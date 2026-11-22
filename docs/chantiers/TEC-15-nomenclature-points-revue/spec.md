---
id: TEC-15
type: TEC
title: Identifiants stables des points de relecture
status: signed
tdd: yes
created_at: 2026-11-21
signed_by: Opack
signed_at: 2026-11-21
rel_depends_on: FEAT-7
tests_commit: 9a00da6
slice: 2
slice_base: 6f04b01722fc85db6cf01cfd586cacea6da6fe50
---

# TEC-15 Identifiants stables des points de relecture

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->
Chaque point soulevé par un sous-agent de relecture porte un identifiant stable, formé d'un préfixe et d'un numéro : `RB1`, `RD2` pour la revue de code, `SB1`, `SD1` pour la relecture de spec, `OB1`, `OD1` pour la vérification de surapprentissage. On le cite dans la conversation, les commits, `revue.md` et le bilan. Une commande donne les prochains numéros de la revue, et un contrôle déterministe refuse d'enregistrer la revue ou de clore le chantier tant qu'un point de revue n'a pas de traitement consigné.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->
- Les sous-agents rendent deux listes, **Bloquant** et **À discuter**, sans identifiant. Pour parler d'un point, il faut le paraphraser (« le truc du push »), ce qui est lent et ambigu.
- La nomenclature `B1`/`D1` est apparue spontanément sur TEC-3, et a montré son utilité : on écrit « je corrige B2, on écarte D3 », et le bilan, la spec et les commits peuvent y renvoyer. Mais elle n'est écrite nulle part, et l'usage dérive d'un chantier à l'autre :
  - TEC-3 : `B1`, `B2`, `D1` à `D6` au tour 1, puis plus d'identifiant aux tours suivants (« la correction de B2 » renvoie à un point sans nom) ;
  - TEC-5 : numérotation continue d'un tour à l'autre (`D7` au tour 3), citée dans la spec, le bilan et l'amendement : le bon usage ;
  - FEAT-4 : `B1`, `D1` à `D6` au tour 1, puis `1.`, `2.`, `3.` qui repartent de 1 à chaque tour : « le point 2 » désigne trois choses différentes ;
  - TEC-6 : aucun identifiant.
- Avec FEAT-7 (revue par tranche, puis revue du chantier), un chantier aura plusieurs revues : sans numérotation à l'échelle du chantier, `RB1` de la tranche 1 et `RB1` de la tranche 2 entreraient en collision.
- Rien ne vérifie aujourd'hui que chaque point a été traité : « continue jusqu'à zéro point bloquant non traité » est une consigne, pas un contrôle.
- Si on ne fait rien : la convention reste une habitude d'agent, qui disparaît à la première session qui ne l'a pas vue.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->

### Préfixes

| Source | Bloquant | À discuter | Où le point est tracé |
|---|---|---|---|
| Revue de code (`reviewer`, `/atelier:review`) | `RB` | `RD` | `revue.md`, bilan §7 |
| Relecture de spec (`spec-critic`, `/atelier:sign`) | `SB` | `SD` | conversation ; spec ou `decisions.md` quand le point change quelque chose |
| Surapprentissage (`overfit-checker`, `/atelier:build`) | `OB` | `OD` | conversation ; `decisions.md` quand le point est reporté ou accepté |

Les préfixes distincts évitent toute collision entre relectures d'un même chantier. Les chantiers déjà clos (`B1`/`D1`, ou sans identifiant) ne sont pas réécrits.

### Numérotation
- **Revue (`RB`/`RD`)** : numérotation continue sur tout le chantier, toutes revues confondues (tranches et revue du chantier de FEAT-7 comprises), une série par préfixe. Un numéro n'est jamais réutilisé.
  - Un point **nouveau** prend le numéro suivant du préfixe.
  - Un point **encore ouvert** à la revue suivante (correction incomplète ou remise en cause) garde son identifiant ; il est repris dans la nouvelle section de `revue.md`, marqué `(repris)` après l'identifiant.
  - Un point dont la gravité change (`RD3` devenu bloquant) prend un nouvel identifiant dans l'autre série et renvoie à l'ancien : « RB4 (ex-RD3) ». L'identifiant porte donc toujours la gravité qu'il annonce. L'ancien point est fermé par le traitement `requalifié (RB4)`, écrit dans sa dernière occurrence.
  - `/atelier:review` obtient les prochains numéros par `atelier review-ids` et les passe au sous-agent `reviewer`, avec la liste des points encore ouverts. Le reviewer ne calcule pas les numéros lui-même : un modèle compte mal dans un tableau.
- **Relecture de spec et surapprentissage (`SB`/`SD`, `OB`/`OD`)** : numérotation continue sur tout le chantier, comme pour la revue. Ces points n'ont pas de fichier dédié, mais ils finissent dans `spec.md` (amendements compris) ou `decisions.md`, parfois écrits dans des sessions différentes (avec FEAT-7, `overfit-checker` tourne à chaque tranche). La skill obtient le premier numéro libre par `atelier review-ids` et le passe au sous-agent ; dans une même session, elle continue à la suite de ce qu'elle a déjà présenté.

### Format d'un point dans `revue.md`
- Une **section** est un titre `## ` (une revue : tranche ou revue du chantier, quel que soit le texte du titre). Les tableaux de points sont ceux qui suivent un titre `### Bloquant` ou `### À discuter` dans une section.
- La cellule « Point » a la forme exacte : `<ID>[ (repris)| (ex-<ID>)]. <intitulé>`, soit `^(RB|RD)\d+( \(repris\)| \(ex-R[BD]\d+\))?\. (.+)$`. Exemples : `RB2. Push non vérifié`, `RB2 (repris). Push non vérifié`, `RB4 (ex-RD3). Commit non signé`. L'intitulé est le texte après `. `.
- Une ligne sans point s'écrit `Aucun` (casse ignorée, point final facultatif) dans la cellule « Point », seule.
- `\|` dans une cellule est un caractère `|` littéral, pas un séparateur de colonne.
- Cette forme est donnée dans le template `revue.md` et dans `reviewer.md`.

### Commande `atelier review-ids`
Calcule, pour le chantier actif, le prochain numéro des six préfixes et les points de revue ouverts. `--json` pour les skills.
- `RB`/`RD` : à partir de la colonne « Point » de `revue.md` (identifiants et références `ex-`) ; points ouverts selon le contrôle ci-dessous.
- `SB`/`SD`/`OB`/`OD` : plus grand numéro trouvé (`\b(SB|SD|OB|OD)\d+\b`) dans `spec.md` et `decisions.md`, plus un.
- Sortie JSON : `{ "next": { "RB": 5, "RD": 8, "SB": 1, "SD": 3, "OB": 1, "OD": 1 }, "open": [{ "id": "RB2", "title": "…", "section": "…" }] }`.
- Sans fichier : tous les numéros à 1, aucun point ouvert.

### Traitements
Un point de `revue.md` a un traitement parmi : **corrigé** (commit), **test ajouté**, **spec amendée**, **exception acceptée** (par qui, pourquoi), **écarté** (pourquoi), **reporté** (chantier ou section « Dette et suites » du bilan qui le reprend, ou `reporté (tranche N)` dans le même chantier), **requalifié** (`requalifié (RB4)`), **sans objet**. Le traitement est écrit dans la colonne « Traitement » et **commence par l'un de ces mots-clés** (casse ignorée), suivi du détail libre. Une colonne vide, ou qui ne commence pas par un mot-clé (« À corriger au build », « TODO »), signifie : point ouvert.

`reporté` et `requalifié` sont nouveaux : `reporté` remplace les formulations libres (« chantier à part », « défaut de méthode à traiter ailleurs ») vues sur FEAT-4 et TEC-6. Un point `reporté (tranche N)` doit être repris et traité dans une revue suivante : à la clôture, il compte comme ouvert s'il est encore sa dernière occurrence.

### Contrôle déterministe
Une fonction pure de `lib/core.mjs` lit `revue.md` et renvoie les problèmes :
- un point (`RB` ou `RD`) dont la **dernière** occurrence n'a pas de traitement reconnu ;
- un identifiant présenté comme nouveau (sans `(repris)`) dans deux sections, ou deux fois dans une même section ;
- un `RB` dans un tableau « À discuter », ou un `RD` dans un tableau « Bloquant » ;
- une ligne de tableau de points dont la cellule « Point » n'a pas la forme définie ci-dessus (ancien format `B1.`, numéro seul, texte libre), hors ligne `Aucun` ;
- dans une section, une ligne de tableau dont la première cellule commence par un identifiant `RB`/`RD` (`^(RB|RD)\d+`) hors d'un tableau de points ;
- un titre `###` dont le texte, casse, accents et `*` ignorés, commence par « bloquant » ou « a discuter » sans être exactement `Bloquant` ou `À discuter` (`### Bloquants`, `### A discuter`, `### **Bloquant**`) : ses points ne seraient pas lus ;
- un point dont la dernière occurrence est traitée `requalifié (<ID>)` sans que `<ID> (ex-<ancien ID>)` apparaisse plus loin dans le fichier : le point disparaîtrait ;
- un `<ID> (repris)` sans occurrence de `<ID>` plus haut dans le fichier, ou un `(ex-<ID>)` dont `<ID>` n'apparaît pas plus haut.

« Plus haut » veut dire : dans une section précédente ou dans la même section ; « plus loin » : dans la même section ou une section suivante. Dans une section, l'ordre des lignes ne compte pas (le tableau Bloquant précède le tableau À discuter).

À la clôture (`close-check`), un point dont la dernière occurrence est `reporté (tranche N)` est aussi un problème.

Un `revue.md` dont les sections s'appellent `## Tour …` est antérieur à FEAT-7 et à ce chantier : pas de contrôle (voir §4). Tout autre `revue.md` est contrôlé, y compris s'il ne contient aucun identifiant `RB`/`RD`.

Cette fonction est appelée par :
- `atelier set-reviewed`, qui lit la copie de travail de `revue.md` (il n'est commité qu'après) et refuse d'enregistrer la revue en listant les problèmes ;
- `atelier close-check` (et `set-status done`), qui lit la copie de travail, refuse la clôture si `revue.md` a des modifications non commitées, et refuse pour les mêmes problèmes.

Les `RD` sont soumis au même contrôle que les `RB` (décision de l'utilisateur) : la skill `review` demande déjà un traitement pour chaque point, et un « écarté » motivé coûte une ligne. Sans cela, un point à discuter oublié ne serait vu par personne.

### Messages de commit
Un commit qui traite un point le cite après l'identifiant du chantier : `fix(plugin): [TEC-15] RB2 refuse an empty treatment`. C'est une convention (skills `review` et `build`, site), pas un contrôle : la colonne Traitement de `revue.md` porte déjà le hash du commit.

### Fichiers modifiés
- Agents : `reviewer.md` (reçoit les numéros et les points ouverts, rend des points identifiés, reprend un point ouvert sous son identifiant), `spec-critic.md` et `overfit-checker.md` (reçoivent le premier numéro, rendent des points identifiés).
- Skills : `review` (appel à `review-ids`, traitements `reporté` et `requalifié`, renommage des anciens points, commits, refus de `set-reviewed`), `sign` (numéros `SB`/`SD` par `review-ids`), `build` (numéros `OB`/`OD` par `review-ids`, commits qui traitent un point de revue), `close` (bilan §7 par identifiant, refus de `close-check`), `amend` (l'entrée d'amendement cite le point qui la motive).
- Templates : `revue.md` (consigne de numérotation, `(repris)`, liste des traitements), `bilan.md` (§7 : un point par identifiant avec son traitement).
- CLI : `lib/core.mjs` (lecture de `revue.md`, prochains numéros, problèmes), `lib/cli.mjs` (`review-ids`, appel du contrôle dans `set-reviewed` et `close-check`).
- Tests : `plugins/atelier/test/`.
- Site : `cycle/revue.md`, `cycle/signature.md`, `cycle/implementation.md`, `cycle/cloture.md`, `agent/revue.md`, `reference/commandes.md` (`review-ids`, refus de `set-reviewed` et `close-check`), `reference/glossaire.md` (« point de relecture », préfixes, « traitement »).
- `README.md`, si la revue y est décrite. Version du plugin incrémentée.

### Hors périmètre
- Réécriture des `revue.md` des chantiers clos.
- Persistance des points `SB`/`SD`/`OB`/`OD` dans un fichier dédié (`relecture-spec.md`) : à rouvrir si l'usage montre qu'on les cite après la session.
- Contrôle des messages de commit (citation d'un point).
- Hook : aucun comportement de hook ne change.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->
- **Chantiers en cours au moment de la mise à jour** : leur `revue.md` peut être au format `B1`/`D1` ou sans identifiant. S'il a des sections `## Tour …` (format antérieur à FEAT-7), le contrôle ne s'applique pas : la revue et la clôture se passent comme avant. Un `revue.md` aux sections renommées par FEAT-7 mais aux points sans identifiant `RB`/`RD` est contrôlé : ses lignes sont signalées et il faut les renommer (`B1` → `RB1`) et compléter leurs traitements. La skill `review` le propose. Limite assumée : un `revue.md` qui garde des sections `## Tour` échappe au contrôle.
- **Dépendance à FEAT-7** : ce chantier s'appuie sur la revue par tranche et le vocabulaire de FEAT-7 (« revue » au lieu de « tour »). Il démarre après sa fusion, sur une branche rebasée.
- Pas de donnée, pas de déploiement : le plugin est mis à jour par `/plugin update`.

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->
Critères d'acceptation (testés dans `plugins/atelier/test/`) :
- CA-1 : Étant donné un `revue.md` dont les points vont jusqu'à `RB3` et `RD7`, répartis sur plusieurs sections, quand on calcule les prochains numéros, alors on obtient `RB4` et `RD8`.
- CA-2 : Étant donné l'absence de `revue.md`, ou un `revue.md` sans point, quand on calcule les prochains numéros, alors on obtient `RB1` et `RD1`, sans point ouvert.
- CA-3 : Étant donné un `RB2` corrigé dans la section 1 puis repris `(repris)` sans traitement dans la section 2, quand on liste les points ouverts, alors `RB2` en fait partie (c'est la dernière occurrence qui compte) ; et un `RB1` sans traitement en section 1 mais corrigé en section 2 n'en fait pas partie.
- CA-4 : Étant donné un `RB` à la colonne Traitement vide (ou réduite à des espaces), ou qui ne commence pas par un mot-clé de traitement (« À corriger au build »), quand on contrôle `revue.md`, alors le problème cite l'identifiant et son intitulé. Même chose pour un `RD`. Un traitement qui commence par un mot-clé, quelle que soit sa casse (« Corrigé (abc1234) », « écarté : hors périmètre »), ne produit pas de problème.
- CA-5 : Étant donné un même identifiant présenté comme nouveau dans deux sections, quand on contrôle, alors le problème cite l'identifiant et les titres des deux sections. Même chose pour un identifiant présent deux fois dans une même section.
- CA-6 : Étant donné un `revue.md` aux sections non `## Tour` et une ligne de point dont la cellule n'a pas la forme définie (ancien format `B1.`, numéro seul `1.`, texte libre, identifiant sans `. `), quand on contrôle, alors la ligne est signalée ; la ligne `Aucun` (ou `aucun.`) ne l'est pas.
- CA-7 : Étant donné un `revue.md` aux sections `## Tour 1`, `## Tour 2` (chantier antérieur), quand on contrôle, alors aucun problème ; et un `revue.md` aux autres sections, sans aucun `RB`/`RD` mais avec des points `B1.`, est contrôlé et ses lignes signalées.
- CA-8 : Étant donné un point ouvert dans la copie de travail de `revue.md`, quand on lance `atelier set-reviewed`, en revue de tranche comme en revue du chantier, alors la commande échoue (code non nul), n'écrit rien dans la spec (ni `slice`, ni `slice_base`, ni `tests_commit`, ni `reviewed_commit`) et liste les points ouverts.
- CA-9 : Étant donné un point ouvert dans un `revue.md` commité, quand on lance `atelier close-check`, alors la clôture est refusée avec la liste des points ouverts ; et étant donné un `revue.md` sans point ouvert mais avec des modifications non commitées, la clôture est refusée.
- CA-10 : Étant donné un `revue.md` de plusieurs sections, un `spec.md` qui cite `SD2` et un `decisions.md` qui cite `OB1`, quand on lance `atelier review-ids --json`, alors la sortie a la forme `{ next: { RB, RD, SB, SD, OB, OD }, open: [{ id, title, section }] }`, avec `SD` à 3 et `OB` à 2.
- CA-11 : Les prompts des trois sous-agents, les skills `review`, `sign`, `build`, `close`, `amend` et les templates `revue.md` et `bilan.md` mentionnent leurs préfixes (test de contenu, comme ceux des templates existants). Le site n'est vérifié que par son build.
- CA-12 : Étant donné les cellules `RB2. Intitulé`, `RB2 (repris). Intitulé` et `RB4 (ex-RD3). Intitulé`, quand on analyse `revue.md`, alors on obtient l'identifiant, le marqueur (`repris`, `ex-RD3` ou aucun) et l'intitulé `Intitulé`.
- CA-13 : Étant donné `RD3` traité `requalifié (RB4)` en section 1 et `RB4 (ex-RD3)` corrigé en section 2, quand on contrôle, alors aucun problème ; et le prochain `RD` tient compte de `RD3`.
- CA-14 : Étant donné un `RB` dans un tableau « À discuter » (ou un `RD` dans un tableau « Bloquant »), quand on contrôle, alors la ligne est signalée.
- CA-15 : Étant donné une cellule Fichier qui contient `` `a \| b` ``, quand on analyse la ligne, alors la colonne Traitement est lue correctement.
- CA-16 : Étant donné un point dont la dernière occurrence est `reporté (tranche 2)`, quand on lance `set-reviewed`, alors pas de problème pour ce point ; quand on lance `close-check`, alors la clôture est refusée et le point est listé.
- CA-17 : Étant donné un titre `### Bloquants` (ou `### A discuter`, `### **Bloquant**`) suivi d'un tableau de points, quand on contrôle, alors le titre est signalé ; étant donné une ligne `| RB1. … |` sous un autre titre `###` d'une section (`### Contrôles`), alors la ligne est signalée ; une phrase hors tableau qui cite `RD1` ne l'est pas.
- CA-18 : Étant donné `RD3` traité `requalifié (RB4)` sans aucun `RB4 (ex-RD3)` plus loin, quand on contrôle, alors `RD3` est signalé ; étant donné `RB7 (repris)` sans `RB7` plus haut, ou `RB4 (ex-RD3)` sans `RD3` plus haut, alors la ligne est signalée. Le cas de CA-13 (requalification suivie de `RB4 (ex-RD3)`) reste sans problème, de même qu'une section dont le tableau Bloquant contient `RB4 (ex-RD3)` et le tableau À discuter `RD3 … requalifié (RB4)` ; en revanche `RB4 (ex-RD3)` dans une section qui précède celle de `RD3` est signalé.

Vérifications d'ensemble :
- `npm test` vert ; `claude plugin validate .` et `claude plugin validate ./plugins/atelier` ; `npm run build` dans `site/`.
- Essai manuel : une revue complète de ce chantier menée avec la nomenclature, `revue.md` contrôlé par la CLI. Ce chantier est son propre premier utilisateur.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->
Revert de la PR et publication d'une version suivante du plugin. Les `revue.md` écrits avec les identifiants restent lisibles : ce sont des tableaux Markdown ordinaires.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
- 2026-11-21 : tests rouverts (gel quitté : ff70aa1) : CA-15 : le test écrit \| dans une chaîne JS simple, où le backslash disparaît ; doubler l'échappement
- 2026-11-21 : tests regelés : 4924cad
- 2026-11-21 : tests rouverts (gel quitté : 4924cad) : Revue 1 de la tranche 1 : cas oubliés de CA-12 (D1 ligne vide dans un tableau, D2 nombre de cellules différent de l'en-tête, D3 tableau dans un commentaire HTML)
- 2026-11-21 : tests regelés : 9e36525
- 2026-11-22 : contrôle ajouté (§3, CA-17) : une ligne de point hors tableau de points, ou un titre `###` proche de « Bloquant » / « À discuter », est signalé, parce que les points d'un tableau mal titré (`### Bloquants`) disparaissaient sans signalement (OD1 de la vérification de surapprentissage de la tranche 1, reporté en tranche 2)
- 2026-11-22 : contrôles ajoutés (§3, CA-18) : un `requalifié (<ID>)` sans `<ID> (ex-…)` plus loin, et un `(repris)` ou un `(ex-<ID>)` sans occurrence plus haut, sont signalés, parce qu'un point requalifié vers un identifiant jamais écrit disparaissait sans signalement (OD14 et OD13 de la vérification de surapprentissage de la tranche 2)
- 2026-11-22 : tests rouverts (gel quitté : a834c53) : Spec amendée (CA-18 : requalifié sans renvoi, repris / ex- sans occurrence antérieure) ; tests manquants de OB2 (identifiant repris deux fois dans une section) et OD12 (formes libres de reporté … tranche N)
- 2026-11-22 : tests regelés : af925e0
- 2026-11-22 : CA-18 précisé (§3) : « plus haut » et « plus loin » se jugent entre sections ; dans une même section, l'ordre ne compte pas, parce qu'un RD requalifié pendant le traitement de sa revue est repris en `RB4 (ex-RD3)` dans le tableau Bloquant, placé au-dessus, et la revue était refusée à tort (OD19 de la vérification de surapprentissage de la tranche 2)
- 2026-11-22 : tests rouverts (gel quitté : af925e0) : Spec amendée (CA-18 : ordre indifférent dans une même section, OD19) ; tests manquants de OD20 (requalifié sans identifiant, identifiant suivi d'un commentaire) et OD22 (ordre et mauvais renvoi ex-)
- 2026-11-22 : tests regelés : 9a00da6
