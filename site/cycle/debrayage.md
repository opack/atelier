# Urgence : le débrayage

La production est en panne et chaque minute compte. Le débrayage autorise à corriger **avant** d’écrire la spec, en gardant une trace.

```text
/atelier:off la synchronisation est bloquée pour tous les utilisateurs
```

## Ce que ça fait

- Le blocage du code est levé **sur la branche courante**, pour la durée de l’urgence.
- Chaque commit porte le trailer `Atelier-Bypass: <raison>`.
- `/atelier:status` vous rappelle qu’il reste à écrire la spec et le bilan.
- `/atelier:close` lève le débrayage.
- Le débrayage est stocké dans `.atelier/bypass.json`, que les outils d’édition de l’agent ne peuvent pas écrire : il passe par la commande, avec votre accord.

## Ce que ça ne fait pas

Le débrayage n’est **pas** une voie pour les petites tâches. Une montée de version ou une règle ESLint passe par un chantier `TEC` avec une spec de trois lignes : le *pourquoi* est toujours tracé.

| Situation | Bonne voie |
|---|---|
| Production en panne | Débrayage, puis spec et bilan après coup |
| Bug gênant mais pas urgent | [Voie rapide](./correction) |
| Petite maintenance | Chantier `TEC`, spec de trois lignes |
| Exploration | Chantier `SPIKE` |
