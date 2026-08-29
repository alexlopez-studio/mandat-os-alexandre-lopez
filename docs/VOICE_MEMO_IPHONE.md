# Note vocale iPhone — activation de Groq

Comment brancher une note vocale prise sur l'iPhone à Mandat OS : l'audio part
vers `/api/ai/voice-memo`, Groq Whisper le transcrit, un LLM le structure au
format Granola, et le compte rendu arrive dans le CRM (`voice_memos` +
`activities`, avec les tâches extraites).

## Ce qui est déjà en place

| Brique | Où | État |
| --- | --- | --- |
| Endpoint d'ingestion | `src/app/api/ai/voice-memo/route.ts` | prêt (POST audio/photos, GET historique) |
| Transcription Groq | `src/lib/ai/voice-memo-processor.ts` → `transcribeAudio` | `whisper-large-v3` puis `whisper-large-v3-turbo`, repli OpenAI puis Gemini |
| Structuration Granola | même fichier → `generateGranolaSummary` | DeepSeek → Groq → OpenAI → Gemini |
| Stockage audio/photos | bucket Supabase `voice-memos` | créé par la migration `055` |
| Saisie des clés IA | `/admin/market/settings` → Assistant IA | Groq présent au catalogue |

Il ne reste donc que la configuration : une clé Groq, un secret pour l'iPhone,
et le raccourci iOS.

## 1. Créer la clé Groq

1. Ouvrir <https://console.groq.com/keys> et se connecter.
2. **Create API Key**, la nommer `mandat-os-voice`.
3. Copier la clé (`gsk_…`) — elle n'est affichée qu'une fois.

Le palier gratuit suffit largement pour des comptes rendus de rendez-vous :
Whisper y est facturé en secondes d'audio et les quotas se comptent en heures
par jour.

## 2. Déclarer la clé dans Mandat OS

**Option A — par l'interface (recommandé).** Réglages → Assistant IA →
fournisseur **Groq** → coller la clé → **Tester** puis **Enregistrer**. La clé
est chiffrée en base (`ai_credentials`, secret `AI_CREDENTIALS_SECRET`) et
devient prioritaire sur la variable d'environnement.

> Le bouton **Tester** interroge `/models` avec `llama-3.1-8b-instant` : il
> valide la clé, pas l'accès à Whisper. La vraie vérification, c'est l'étape 5.

**Option B — par variable d'environnement.** Sur Vercel (projet Mandat OS →
Settings → Environment Variables), ajouter `GROQ_API_KEY` en Production +
Preview, puis redéployer. Sert de filet si la table `ai_credentials` est vide.

## 3. Créer le secret du raccourci iOS

`/api/ai/voice-memo` est hors de la protection de session du middleware pour
que l'iPhone puisse écrire sans se connecter : la garde est portée par la route
elle-même, et elle est fail-closed. Deux entrées possibles — une session admin
(l'app web) ou le secret partagé `VOICE_MEMO_API_KEY` (l'iPhone).

```bash
# Génère un secret solide
openssl rand -hex 32
```

Ajouter le résultat dans Vercel sous `VOICE_MEMO_API_KEY` (Production +
Preview), puis redéployer. **Tant que cette variable est absente, l'iPhone
reçoit `401`** — c'est voulu : sans elle, n'importe qui pourrait déposer des
notes dans le CRM et relire les transcriptions.

## 4. Vérifier en ligne de commande

```bash
BASE=https://app.alexandrelopez.fr
KEY=<VOICE_MEMO_API_KEY>

# a) La garde répond bien
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/ai/voice-memo"          # 401 attendu
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $KEY" \
  "$BASE/api/ai/voice-memo"                                                  # 200 attendu

# b) Bout en bout avec un vrai fichier audio
curl -s -X POST "$BASE/api/ai/voice-memo" \
  -H "Authorization: Bearer $KEY" \
  -F "audio=@memo.m4a;type=audio/m4a" \
  -F "source=ios_shortcut" | jq '.data.diagnostics, .data.title, .data.transcript'
```

Réponse attendue si Groq travaille :

```json
{
  "transcription": { "provider": "groq", "model": "whisper-large-v3", "errors": [] },
  "summary": { "provider": "groq", "model": "llama-3.1-8b-instant" }
}
```

`diagnostics.transcription.errors` liste les moteurs écartés et pourquoi
(`groq: aucune clé API active`, `groq/whisper-large-v3: HTTP 401 …`, quota
dépassé…). C'est le premier endroit à regarder quand la transcription déçoit.

## 5. Le raccourci iOS

Application **Raccourcis** → **+** → nommer `Note Mandat OS`.

1. **Recevoir** *Fichiers* et *Texte* depuis le **menu de partage** (bouton
   *Détails du raccourci* → « Afficher dans la feuille de partage »). C'est ce
   qui permet de partager un mémo vocal depuis l'app Dictaphone.
2. Action **Obtenir le contenu de l'URL** :
   - URL : `https://app.alexandrelopez.fr/api/ai/voice-memo`
   - Méthode : **POST**
   - En-têtes : `Authorization` = `Bearer <VOICE_MEMO_API_KEY>`
   - Corps de la requête : **Form** (multipart), un champ :
     - `audio` (type *Fichier*) = **Entrée du raccourci**
     - `source` (type *Texte*) = `ios_shortcut`
3. Action **Afficher la notification** avec `Contenu de l'URL` → confirmation
   immédiate du titre généré.

Usage : Dictaphone → un mémo → **Partager** → *Note Mandat OS*. Le compte rendu
apparaît dans le CRM en une vingtaine de secondes.

Champs facultatifs acceptés par la route :

| Champ | Effet |
| --- | --- |
| `audio` (ou `file`) | fichier audio à transcrire |
| `transcript` (ou `text`) | transcription déjà faite — court-circuite Whisper |
| `photos` | une ou plusieurs images (OCR : taxe foncière, DPE, devis…) |
| `contact_id` / `project_id` | force le rattachement au lieu de laisser l'IA rapprocher |
| `source` | `ios_shortcut`, `dictaphone`, `telegram`, `web` |

Variante sans audio : ajouter l'action **Dicter le texte** et envoyer le
résultat dans le champ `transcript`. Plus rapide, moins fidèle qu'un vrai
enregistrement passé à Whisper.

## Dépannage

Un `401` renvoie toujours un champ `reason` qui tranche entre les deux causes
possibles — inutile de chercher à l'aveugle :

```bash
curl -s -H "Authorization: Bearer $KEY" "$BASE/api/ai/voice-memo" | jq '.reason, .error'
```

- `"no-secret-configured"` : ce déploiement n'a pas de `VOICE_MEMO_API_KEY`.
  Trois causes, par ordre de fréquence :
  1. la variable a été posée sur **un autre projet Vercel** — il faut celui qui
     sert `app.alexandrelopez.fr`, soit `mandat-os-alexandre-lopez` ;
  2. elle ne couvre pas l'environnement **Production** (cas classique : seuls
     Preview et Development sont cochés) ;
  3. elle a été ajoutée *après* le dernier déploiement — il faut redéployer,
     une variable n'est jamais rétro-injectée dans un build déjà construit.

  Pour lever le doute sans afficher aucune valeur secrète :

  ```bash
  npx vercel link     # si le dossier n'est pas déjà relié au bon projet
  npx vercel env ls   # noms et environnements de chaque variable
  ```
- `"bad-credentials"` : le serveur a bien un secret, mais la valeur envoyée ne
  correspond pas. Comparer caractère par caractère avec Vercel (les espaces et
  retours à la ligne en début/fin sont ignorés des deux côtés).

| Symptôme | Cause probable |
| --- | --- |
| `401` depuis l'iPhone | lire `reason` ci-dessus ; sinon en-tête `Bearer` mal formé |
| « transcription automatique indisponible » | aucune clé de transcription valide — lire `diagnostics.transcription.errors` |
| `diagnostics.transcription.provider = "openai"` | Groq a échoué et le repli a joué : la cause exacte est dans `errors` |
| `413` sur les longs mémos | limite Vercel d'environ 4,5 Mo par requête. Enregistrer plus court, ou envoyer `transcript` plutôt que l'audio |
| Timeout au-delà de 60 s | `maxDuration = 60` dans la route ; Whisper Groq reste très en dessous pour un mémo de quelques minutes |
| Note créée mais rattachée au mauvais contact | le rapprochement se fait sur les 40 derniers contacts modifiés — préciser `contact_id` dans le raccourci |

## Points connus

- Le bucket `voice-memos` est **public** (migration `055`) : l'URL de l'audio
  est devinable sans authentification. À restreindre avant de traiter des
  enregistrements sensibles.
- La clé enregistrée dans Réglages prime sur `GROQ_API_KEY` : si les deux
  existent et que la première est invalide, c'est elle qui sera utilisée.
