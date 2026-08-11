# Extension Chrome — Sync Playiad → Mandat OS

Importe les leads acquéreurs de Playiad (intranet iad) dans Mandat OS : un bouton
sur la page pour un import à la demande, et un scan automatique plusieurs fois
par jour.

## Pourquoi une extension et pas un scan serveur

Playiad n'expose pas d'API et n'est accessible qu'avec une session iad
authentifiée. Un scan côté serveur supposerait de stocker les identifiants iad
et de rejouer une connexion — plus fragile et plus risqué. L'extension réutilise
la session déjà ouverte dans le navigateur : rien à stocker, rien à usurper.

Contrepartie assumée : **le scan automatique n'aboutit que si la session Playiad
est encore valide** dans Chrome. Sinon la page de connexion s'affiche, la lecture
renvoie zéro lead et le scan est simplement ignoré (trace dans la console du
service worker).

## Installation

1. `chrome://extensions` → activer **Mode développeur**.
2. **Charger l'extension non empaquetée** → choisir ce dossier.
3. Cliquer sur l'icône de l'extension et renseigner :
   - **URL du serveur** : `https://app.alexandrelopez.fr` (ou `http://localhost:3000` en local) ;
   - **Clé de synchronisation** : la même valeur que `PLAYIAD_SYNC_SECRET` côté serveur ;
   - **Page des leads** : l'URL exacte de la liste des acquéreurs ;
   - **Fréquence** du scan automatique.
4. **Enregistrer**.

Côté serveur, définir la variable d'environnement :

```
PLAYIAD_SYNC_SECRET=<une chaîne aléatoire longue>
```

Sans cette variable, l'endpoint d'import refuse **toutes** les requêtes (401) :
il écrit dans le CRM et ne doit jamais être ouvert par défaut.

## Vérifier avant d'automatiser

Le bouton **« Tester sans rien importer »** ouvre Playiad en arrière-plan, lit la
page et demande au serveur ce qu'il ferait — sans rien écrire. Il affiche le
nombre de leads lus et, pour chacun, le nom reconnu et le sort qui lui serait
réservé.

C'est l'étape à faire en premier : les sélecteurs d'extraction sont génériques
(lignes de tableau, cartes, éléments dont la classe contient `lead`/`buyer`) et
n'ont pas pu être validés contre la vraie page. Si les noms affichés sont faux ou
si des lignes manquent, envoyer le HTML de la page pour ajuster `content.js`.

## Fonctionnement

| Fichier | Rôle |
| --- | --- |
| `extractor.js` | Lecture du DOM. Ne définit qu'une fonction, sans effet de bord. |
| `content.js` | Bouton flottant sur la page Playiad. Ne connaît pas la clé. |
| `background.js` | Détient la configuration, appelle l'API, gère l'alarme et les notifications. |
| `popup.html/js` | Configuration et test à blanc. |

Le scan programmé ouvre lui-même la page des leads dans un onglet en
arrière-plan, y **injecte** `extractor.js` puis referme l'onglet. L'injection
explicite (plutôt que le content script déclaratif) permet de scanner n'importe
quelle URL de leads configurée, sans dépendre des `matches` du manifeste ni d'un
onglet Playiad déjà ouvert.

L'alarme est créée avec un `delayInMinutes` : sans lui, le premier scan
n'aurait lieu qu'une période complète après le démarrage de Chrome. À noter,
une alarme d'extension ne s'exécute pas navigateur fermé.

## Dédoublonnage

Un lead est identifié par son **e-mail**, à défaut par son **téléphone**
normalisé (`+33 6 12 34 56 78` et `06.12.34.56.78` sont le même numéro).
L'identifiant Playiad n'est utilisé que si la page en fournit un vrai.

Le serveur n'importe pas un acquéreur qui a déjà un projet d'achat ouvert dans
Mandat OS : re-scanner la même page ne crée donc jamais de doublon.
