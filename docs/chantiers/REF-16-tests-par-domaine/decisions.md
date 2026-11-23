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

## 2026-11-23 : imports et exports tolérés sous leur seule forme d'instruction
- Contexte : les lignes d'import et d'export entre fichiers sont tolérées.
- Écarté : tolérer toute ligne commençant par `export`, qui laisserait passer une définition modifiée en `export function …`.
- Conséquence : seules les instructions `import … from '…'` (sur une ou plusieurs lignes) et les blocs `export { … }` sont écartés de la comparaison.
