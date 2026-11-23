---
id: TEC-23
type: TEC
title: Lancer les contrôles une seule fois par état du code
status: signed
tdd: yes
created_at: 2026-11-23
source: diagnostic de lenteur des scripts atelier (fil « Accélérer les contrôles d'atelier », 2026-11-23)
signed_by: Opack
signed_at: 2026-11-23
tests_commit: 9222907
slice: 1
reviewed_commit: 9ba0147b6a6493dcd1e85eec5bf197b15def0c5e
---

# TEC-23 Lancer les contrôles une seule fois par état du code

<!-- Chantier technique sans impact utilisateur direct : CI, outillage, dépendances, configuration, sécurité, infra, migration.
Petite tâche (règle ESLint, montée de version) : seules les sections 1, 2 et 5 sont obligatoires. -->

## 1. Quoi
<!-- Le changement technique, en une ou deux phrases. -->

`atelier checks`, `atelier close-check` et `atelier set-status done` partagent avec le hook de fin de tour le résultat « contrôles verts sur cet état du code » (`lastGreen` dans `.atelier/gate.json`, empreinte de l'arbre de travail calculée par `workingTreeId`). Les contrôles ne sont lancés que si l'empreinte actuelle n'est pas déjà connue comme verte ; `atelier checks --force` les relance toujours.

## 2. Pourquoi
<!-- Le déclencheur : risque, dépréciation, échéance, douleur récurrente, faille. Ce qui arrive si on ne fait rien. -->

Les commandes atelier elles-mêmes coûtent 50 à 100 ms (mesure du 2026-11-23, 2 à 6 appels git). Le temps perdu vient des contrôles (`npm test` dans ce dépôt : 13 s en cloud, environ 60 s sous Windows), lancés deux fois de suite sur le même code :

- au build : `atelier checks`, puis le hook de fin de tour, qui ignore que `checks` vient de passer (seul le hook lit et écrit `lastGreen`) ;
- à la clôture : `atelier close-check`, puis `atelier set-status done`, qui refait les mêmes vérifications.

Sans rien faire, chaque build et chaque clôture paient la suite deux fois, et le coût croît avec elle.

## 3. Périmètre
<!-- Fichiers, services, environnements concernés. Hors périmètre. Optionnel pour une petite tâche. -->

- `plugins/atelier/lib/cli.mjs` : `runChecks`, `commandChecks`, `closeCheckProblems` (donc `close-check` et `set-status done`), lecture et écriture de `.atelier/gate.json`.
- `plugins/atelier/lib/core.mjs` : la décision « faut-il lancer les contrôles » en fonction pure, partagée avec `decideStop`.
- Tests dans `plugins/atelier/test/`.
- Site : `site/reference/commandes.md` (`checks`, `--force`, réutilisation par `close-check` et `set-status done`) et `site/reference/configuration.md` (`gate.json` désormais partagé).

Hors périmètre :
- La durée de la suite elle-même : la répartition des tests par fichier (REF-16, EPIC-17) donnera le parallélisme de `node --test`.
- Mémoriser un échec : seul un résultat vert est réutilisé ; un contrôle rouge est relancé à chaque appel, comme aujourd'hui.
- Le comportement du hook de fin de tour, sauf qu'il trouve désormais `lastGreen` écrit par les commandes.

## 4. Impacts indirects
<!-- Comportement visible malgré tout ? Données, déploiement, coûts, autres développeurs. Optionnel pour une petite tâche.
Question si manquant : qu'est-ce qui pourrait changer pour l'utilisateur malgré tout ? -->

- L'empreinte ne couvre que les fichiers vus par git : un changement limité à un fichier ignoré (`node_modules`, `.env`), à la version de Node ou à l'environnement réutilise un vert obtenu avant. Le hook de fin de tour vit déjà avec ce risque ; `--force` permet de relancer.
- `atelier checks` doit dire quand il réutilise un résultat, pour qu'on ne croie pas que les contrôles ont tourné.
- Le calcul de l'empreinte écrit `.atelier/gate-index` (déjà le cas pour le hook).

## 5. Vérification
<!-- Comment prouve-t-on que ça marche : CI verte, test de règles, déploiement sur un environnement, mesure avant / après. -->

- CA-1 : Étant donné un arbre de travail sur lequel `atelier checks` vient de passer, quand le hook de fin de tour s'exécute sans modification entre-temps, alors il ne relance pas les contrôles.
- CA-2 : Étant donné un arbre de travail dont l'empreinte est enregistrée comme verte, quand on lance `atelier checks`, alors les contrôles ne sont pas lancés et la sortie indique qu'ils sont déjà verts sur cet état du code.
- CA-3 : Étant donné un fichier suivi modifié après le dernier vert, quand on lance `atelier checks`, `close-check` ou `set-status done`, alors les contrôles sont lancés.
- CA-4 : Étant donné `atelier close-check` réussi, quand on lance `atelier set-status done` sans modification, alors les contrôles ne sont pas relancés et les autres vérifications de clôture le sont.
- CA-5 : Étant donné un arbre déjà vert, quand on lance `atelier checks --force`, alors les contrôles sont lancés.
- CA-6 : Étant donné un contrôle qui échoue, quand on relance `atelier checks` sans modification, alors les contrôles sont relancés (aucun échec mémorisé).
- CA-7 : Étant donné une empreinte impossible à calculer (erreur git), quand une commande a besoin des contrôles, alors elle les lance comme aujourd'hui.
- Mesure avant / après : nombre de lancements de la commande de contrôle sur la séquence `checks` puis hook de fin de tour, et sur `close-check` puis `set-status done` : 2 avant, 1 après.

## 6. Retour arrière
<!-- Comment annuler si ça casse en production. Optionnel pour une petite tâche. -->

Revert de la PR. Supprimer `.atelier/gate.json` vide le cache sans autre effet que de relancer les contrôles.

## Amendements
<!-- Après signature : une entrée datée par modification de la spec. -->
