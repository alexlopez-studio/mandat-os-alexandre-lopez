# SMQ v1 — Processus vendeur et opportunité pivot

Date de cadrage : 05/07/2026

## Principe directeur

L'objet métier principal est l'**opportunité vendeur** : un projet de mandat = une opportunité.

Les leads, contacts de liste chaude, estimations site et annonces importées sont des points d'entrée. Ils ne doivent pas devenir plusieurs dossiers concurrents. Le quotidien se pilote depuis `/app/opportunities`.

## Parcours cible

1. **P1 Captation des pistes**
   - Sources acceptées : estimation site, appel entrant, prospection terrain, bouche-à-oreille, annonce particulier, annonce agence, autre.
   - Toute création manuelle passe par `Ajouter une piste vendeur`.

2. **P2 Détection doublon / rattachement**
   - Recherche obligatoire avant création : nom, téléphone, email, commune, adresse ou annonce.
   - Si un lead ou un bien est déjà lié à une opportunité, l'utilisateur ouvre ou rattache l'existant.
   - Les estimations site créent une opportunité uniquement si aucune opportunité du même prospect n'existe déjà.

3. **P3 Qualification vendeur**
   - L'opportunité démarre en `Nouveau contact`, sauf annonce agence sans vendeur identifié.
   - Prochaine action et priorité sont obligatoires dans l'usage, même si l'interface reste souple pour les cas terrain.

4. **P4 Pré-estimation et RDV**
   - Les jalons attendus sont `Pré-estimation`, `Visite d'estimation`, puis `Remise de l'estimation`.
   - Les événements d'opportunité gardent les notes, appels, emails, tâches et changements d'étape.

5. **P5 Décision vendeur**
   - `Décision vendeur` et `Suivi moyen terme` servent à distinguer l'opportunité chaude de la relance longue.
   - En cas de perte, le motif doit être renseigné ou une tâche qualité est créée.

6. **P6 Visite d'estimation → portail client**
   - Le portail client peut etre ouvert des la `Visite d'estimation` pour
     presenter le rapport et preparer la suite avec le vendeur.
   - L'ouverture automatique au `Mandat signé` reste conservee comme filet de
     securite.
   - Les donnees pre-mandat deja saisies sur l'opportunite alimentent le
     portail client.
   - Si l'opportunité a un lead avec email, le dossier client est préparé ou rattaché automatiquement.
   - Si le lead ou l'email manque, une tâche signale le complément nécessaire.

7. **P7 Veille / vendu / perdu**
   - `Veille annonce` accueille les annonces agence ou biens sans vendeur exploitable.
   - `Vendu` et `Perdu / Écarté` sortent l'opportunité du flux commercial actif.

## Statuts pipeline

1. Veille annonce
2. Nouveau contact
3. Pré-estimation
4. Visite d'estimation
5. Remise de l'estimation
6. Décision vendeur
7. Suivi moyen terme
8. Mandat signé
9. Vendu
10. Perdu / Écarté

## Preuves qualité conservées

- Source de la piste : `source_channel`.
- Date de création et dernière mise à jour.
- Lead rattaché, bien en annonce rattaché, ou les deux.
- Données pré-mandat de l'opportunité : `property_snapshot` et `professional_opinion`.
- Prochaine action, échéance et priorité.
- Événements timeline : notes, tâches, appels, emails, RDV, changements d'étape.
- Événements système : création automatique, rattachement doublon, préparation dossier client.
- Motif ou tâche qualité quand une opportunité passe en `Perdu / Écarté` sans explication.

## Indicateurs SMQ v1

- Délai moyen entre captation et premier contact.
- Taux de doublons évités ou rattachés.
- Taux estimation site → opportunité qualifiée.
- Taux annonce détectée → contact vendeur identifié.
- Taux opportunité → mandat signé.
- Motifs de perte récurrents.

## Règles produit retenues

- L'opportunité est la fiche pivot.
- Les leads restent utiles comme matière entrante et historique prospect.
- Les sections `Bien & technique` et `Estimation` sont saisies sur l'opportunité avant mandat, pas dans un dossier client.
- Les annonces agence sans contact sont en `Veille annonce`, pas dans les relances actives.
- La création rapide reste possible, mais une recherche anti-doublon est demandée avant création.
- Le portail client peut demarrer des la `Visite d'estimation`.
- `/api/market/clients` refuse l'ouverture vendeur avant la `Visite d'estimation`.
