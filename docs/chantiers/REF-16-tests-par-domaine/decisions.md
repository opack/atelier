# Décisions : REF-16 Tests rangés par domaine

## 2026-11-23 : CA-13 de FEAT-7 rangé dans write-guard
- Contexte : son nom affirme à la fois la garde d'écriture et le contrôle de fin.
- Écarté : `stop-hook`, ou scinder le `describe` `FEAT-7 write guard and stop hook per slice` (31 lignes) pour un seul test.
- Conséquence : le `describe` part en entier dans `write-guard`.

## 2026-11-23 : V-10 de TEC-6 reste dans identifiers
- Contexte : « la garde d'écriture applique les règles du chantier déduit des commits » touche la garde et la déduction.
- Écarté : `write-guard`, parce que ce que le test établit est quel chantier est actif.
- Conséquence : `default branch resolved through origin/HEAD` part en entier dans `identifiers`.

## 2026-11-23 : review-points scindé en quatre sous-domaines
- Contexte : environ 560 lignes, au-delà de 400.
- Écarté : deux fichiers, parce que le contrôle des points seul fait environ 300 lignes et qu'avec la lecture il dépasse 400.
- Conséquence : `review-points-reading`, `-checks`, `-numbering`, `-refusal`.

## 2026-11-23 : helpers.mjs exporte par un bloc unique
- Contexte : le contrôle de lignes exige des définitions inchangées.
- Écarté : préfixer chaque définition par `export`, qui modifie chaque ligne de définition.
- Conséquence : un bloc `export { … }` en fin de fichier, compté parmi les lignes d'export tolérées.

## 2026-11-23 : la base est rejouée dans un worktree temporaire
- Contexte : les noms des tests générés en boucle n'existent qu'à l'exécution.
- Écarté : une liste de noms de base figée dans le dossier du chantier, qui ne se revérifie pas.
- Conséquence : `check-moves.mjs` dure environ 60 à 70 s (base et suite actuelle en parallèle).

## 2026-11-23 : écart de `})` toléré pour les describe scindés
- Contexte : scinder un `describe` ajoute une ligne `})`, que le §4 ne tolère pas.
- Écarté : réunir les tests scindés dans un `describe` existant de la destination, qui mêle des origines.
- Conséquence : amendement de la spec (§4) avant la tranche 1 : écart du nombre de `})` toléré à hauteur de l'écart du nombre de `describe`.

## 2026-11-23 : les lignes de titre sont normalisées, pas écartées
- Contexte : le §4 tolère les différences de titre des `describe`, des `it` et des libellés de `cases`.
- Écarté : ignorer ces lignes en entier, ce qui laisserait passer un changement du reste de la ligne (`async`, contenu d'un cas de `cases`).
- Conséquence : `check-moves.mjs` remplace seulement le premier littéral de chaîne de ces lignes par `<titre>` et compare le reste.
- Révisé le 2026-11-23 (revue de la tranche 1, D1) : seuls les titres des `describe` deviennent `<titre>`. Ceux des `it` et les libellés de `cases` deviennent `<titre:…>`, leur texte sans étiquette (amendement du §4), et chaque ligne du corps d'un `it` est préfixée par ce titre (`<titre:…> ¦ <ligne>`).
  - Écarté : comparer seulement les titres sans étiquette, qui laisse passer l'échange de deux titres ou le déplacement d'une assertion d'un test à l'autre (le multiensemble des lignes est le même).
  - Conséquence : plus strict que le §4. Tout changement du corps d'un test, ou de son titre hors étiquette, fait échouer le contrôle ; un échec de lignes s'affiche préfixé du titre du test concerné.
  - Limite acceptée : les lignes hors d'un corps d'`it` (utilitaires de `helpers.mjs`, fonctions et variables au niveau d'un `describe`) ne sont rattachées à rien ; échanger une ligne entre deux utilitaires passerait. Les utilitaires ont été déplacés à l'identique en tranche 1 (vérifié à l'octet près en revue) et les tranches suivantes déplacent des blocs entiers.

## 2026-11-23 : imports et exports tolérés sous leur seule forme d'instruction
- Contexte : les lignes d'import et d'export entre fichiers sont tolérées.
- Écarté : tolérer toute ligne commençant par `export`, qui laisserait passer une définition modifiée en `export function …`.
- Conséquence : seules les instructions `import … from '…'` (sur une ou plusieurs lignes) et les blocs `export { … }` sont écartés de la comparaison.

## 2026-11-23 : le reste de `FEAT-4 EPIC type` garde son titre jusqu'à la tranche 3
- Contexte : la tranche 2 en retire CA-6 (`identifiers`) et les quatre CA-7 (`spec`) ; CA-8 part dans `write-guard` en tranche 3.
- Écarté : renommer dès maintenant le `describe` restant en `write guard on an EPIC`, qui ferait toucher en tranche 2 un domaine de la tranche 3.
- Conséquence : `core.test.mjs` garde un `describe('FEAT-4 EPIC type')` réduit à CA-8, renommé au déplacement.

## 2026-11-23 : check-moves.mjs lance un processus par fichier de test
- Contexte : depuis la fusion de `main`, un nom de test garde sa forme ancienne tant que son fichier de la base existe ; il faut donc connaître le fichier de chaque test. La sortie TAP ne donne `location` que pour un test en échec.
- Écarté : retrouver le fichier par le titre du `describe` de tête, fragile (titres échappés, doublons possibles).
- Conséquence : un `node --test` par fichier, comme `node --test` le fait déjà en interne ; nombres et suites en échec additionnés.

## 2026-11-23 : un titre de test donné par une variable se lit comme un gabarit
- Contexte : les tests générés en boucle de FIX-22 (`it(name, …)`) reçoivent l'étiquette de leur `describe` : `` it(`${name} [FIX-22 CA-2]`, …) ``.
- Écarté : mettre l'étiquette dans les clés des tableaux de données, qui modifierait des lignes de données.
- Conséquence : le contrôle de lignes lit `it(name,` comme `` it(`${name}`, `` avant de retirer l'étiquette. Sabotages rejoués : étiquette héritée fausse et assertion affaiblie dans un test généré, tous deux refusés.

## 2026-11-23 : le commit de fusion de main reste tel quel (revue de la tranche 2, D2)
- Contexte : `6585ba5` porte le message par défaut de git, sans `[REF-16]`, et la suite y est rouge jusqu'à `aa47b2f` (import de `spawnSync` déplacé dans `helpers.mjs` par la tranche 1).
- Écarté : refaire la fusion, qui réécrit l'historique (§6) alors que la branche est déjà sur `origin`.
- Conséquence : pour les fusions suivantes, `git merge --no-commit main`, suite relancée et corrigée avant le commit, message `chore(merge): [REF-16] fusion de main (<sha>)`.
