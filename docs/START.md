# Commande `start`

Quand Alexandre commence une nouvelle session et dit simplement :

```text
start
```

l'assistant doit comprendre :

```text
On reprend le projet Mandat OS / MandatFinder.

Avant toute chose :
1. Lis docs/MEMOIRE_SESSION.md et docs/SUIVI_PROJET.md.
2. Fais git fetch --all --prune.
3. Verifie git status --short --branch.
4. Compare la branche locale preview avec origin/preview.
5. Ne fais aucun reset, rebase destructif ou ecrasement de fichiers sans me demander.
6. Travaille uniquement en local par defaut.
7. Ne pousse rien sans mon ordre explicite.
8. Identifie la derniere entree horodatee du journal dans docs/SUIVI_PROJET.md.
9. Reprends le contexte a partir de cette derniere action, en signalant ce qui etait fait, en cours, bloque ou a verifier.
10. Lance ou verifie le serveur local Next sur un port disponible, en priorite `npm run dev -- --port 3002` si le port est libre.
11. Donne l'URL localhost active, en priorite `http://localhost:3002/app/dashboard`.

Important :
- Codex est seul responsable du developpement et du design pour le moment.
- La branche de reference et de travail est preview.
- origin/preview est la source de verite GitHub.
- On ne travaille plus avec des branches design/features separees, sauf decision explicite.
- Quand on visualise en local, ouvre directement le dashboard logiciel `http://localhost:<port>/app/dashboard`.
- Pour le flux Stream Estate, ouvrir aussi `/app/zones` afin de tester la sync contrôlée, le budget items et la prévisualisation avant import.
- Ouvre la visualisation dans VS Code quand c'est possible, via le Simple Browser integre.
- Ne suppose pas qu'une redirection login middleware est active : verifier l'etat reel du middleware et de la garde layout.
- Le suivi courant se fait dans les docs du repo, pas dans Linear.
- A chaque fin de tache, meme petite, mets a jour docs/SUIVI_PROJET.md avant de conclure.
- Apres chaque modification, audit ou decision structurante, ajoute une entree horodatee dans docs/SUIVI_PROJET.md.
- Apres un changement significatif, lance l'audit Playwright adapte et trace le resultat.

Ensuite, fais un resume de depart et propose le point de reprise.
```

## Reponse attendue

L'assistant doit :

1. Lire la memoire et le suivi projet.
2. Fetch `origin`.
3. Verifier l'etat Git.
4. Identifier si `origin/preview` a avance.
5. Signaler toute divergence ou changement local non commite.
6. Demarrer ou reutiliser le serveur local Next et donner l'URL active.
7. Lire la derniere entree horodatee du journal et repartir de cette action, pas d'une ancienne hypothese.
8. Faire un court compte rendu de depart :
   - etat Git local / distant,
   - URL locale active,
   - derniere action horodatee,
   - ce qui vient d'etre termine,
   - taches en cours, bloquees, a verifier ou planifiees.
9. Proposer le prochain pas sans toucher a des operations destructives.
10. Travailler localement tant qu'Alexandre ne demande pas explicitement un push.
11. Mettre a jour `docs/SUIVI_PROJET.md` avec un horodatage apres chaque action importante et a chaque fin de tache.

## Fin de tache obligatoire

Avant toute reponse finale apres une tache, l'assistant doit verifier que `docs/SUIVI_PROJET.md` indique :

- ce qui vient d'etre fait,
- les fichiers principaux touches,
- l'etat final : fait, en cours, bloque ou a verifier,
- l'audit ou la verification realisee,
- le prochain point de reprise si la tache continue plus tard.

## Taches ouvertes a rappeler au demarrage

Ces points doivent etre relus au `start` et actualises dans `docs/SUIVI_PROJET.md` quand ils changent :

- Auth admin : la garde locale de `/admin/market` est temporairement neutralisee pour accelerer la navigation locale ; verifier/reactiver avant mise en production.
- Radar : les endpoints `/api/radar/listings` peuvent logguer des erreurs Supabase si les tables `listings` / `listing_events` ne sont pas presentes dans l'environnement.
- Audit qualite : completer un audit Playwright cible sur la navigation sidebar et les routes `/app/*` quand l'environnement de test est pret.
- Documentation : garder `docs/ROUTES.md` et la memoire de session alignes avec les URLs canoniques `/app/dashboard`, `/app/leads`, `/app/radar`, etc.
