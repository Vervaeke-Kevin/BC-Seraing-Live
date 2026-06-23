# BC Seraing Live

Application live de tournoi badminton.

## Lancer en local

```bash
npm start
```

Puis ouvrir :

```text
http://localhost:4174
```

## État actuel

L'app est structurée comme une vraie version connectée :

- frontend public et organisateur ;
- API centrale `/api/state` ;
- boucle de synchronisation automatique ;
- moteur de chronos terrain ;
- repos joueur : 30 min après simple, 15 min après double ;
- pages Salle, Prochains matchs, Tournoi, Joueur, Infos ;
- stats fun ;
- conseils nutrition dans la fiche joueur.

Pour l'instant, elle utilise les données de simulation si TournamentSoftware n'est pas lisible.

## Brancher TournamentSoftware

Le serveur essaie de lire :

```text
{TOURNAMENT_URL}/matches
{TOURNAMENT_URL}/players
```

Par défaut :

```text
https://badvla.tournamentsoftware.com/tournament/884F54A2-099B-4426-8259-0E9E40BAE311
```

On peut changer l'URL :

```bash
TOURNAMENT_URL="https://badvla.tournamentsoftware.com/tournament/ID_DU_TOURNOI" npm start
```

Si l'accès live est bloqué, déposer les fichiers HTML ici :

```text
data/matches.html
data/players.html
```

La synchro utilisera ces fichiers avant de tenter le fetch live.

## À affiner avec les vrais HTML TS

- extraction exacte des joueurs ;
- extraction exacte du club ;
- extraction exacte du terrain depuis l'icône info ;
- détection score / W-O / forfait ;
- ordre des prochains matchs ;
- durées officielles une fois le score publié.

## Pages

- `Salle` : 12 terrains, échauffement, chrono match, boutons organisateur.
- `Prochains` : ordre horaire + repos à respecter.
- `Tournoi` : résultats, stats fun, filtres par club.
- `Joueur` : fiche individuelle, repos, résultats, nutrition.
- `Infos` : récompenses, partenaires, copyright.
