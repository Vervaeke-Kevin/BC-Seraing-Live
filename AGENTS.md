# BC Seraing Live — règles agent

## Architecture
- `server.mjs` sert l'application HTTP, les fichiers statiques de `public/` et les endpoints `/api/*`.
- `src/state.mjs` orchestre la synchronisation TournamentSoftware, les terrains live, les résultats, les prochains matchs et le calcul de repos.
- `src/tournamentsoftware.mjs` contient le parseur HTML TournamentSoftware. Toute évolution de structure TS doit être couverte par un test dans `test/`.
- `public/app.js`, `public/index.html` et `public/styles.css` constituent l'interface publique et organisateur.
- `data/matches.html` et `data/players.html` servent de fallback/local fixtures en mode non-production.

## Règles métier obligatoires
- Les matchs, terrains, joueurs, clubs et résultats doivent provenir automatiquement de TournamentSoftware quand les pages sont lisibles.
- À la détection d'un match actif, démarrer 5 minutes d'échauffement.
- Après 5 minutes sans confirmation organisateur, le terrain passe en état rouge `ready` jusqu'à clic `Match débuté`.
- Quand un résultat TS est détecté, libérer le terrain et enregistrer le résultat.
- Le repos est calculé depuis l'heure de détection/enregistrement du résultat terminé : 30 minutes après un simple, 15 minutes après un double.
- Le repos dépend du match terminé, jamais du type du match suivant.
- La fiche joueur doit lister tous les prochains matchs séparés entre samedi 27 juin 2026 et dimanche 28 juin 2026.
- L'API et l'interface doivent exposer une version visible pour vérifier le déploiement Render.
- Les réponses API et les fichiers `index.html`, `app.js` et `styles.css` doivent être servis sans cache.

## Qualité et vérification
- Avant une modification fonctionnelle, lire les fichiers concernés et exécuter les vérifications disponibles.
- Après modification du parseur TS, exécuter `npm test` et vérifier le comportement avec `data/matches.html` ou des données TS live si le réseau le permet.
- Ne pas ajouter de `try/catch` autour des imports.
