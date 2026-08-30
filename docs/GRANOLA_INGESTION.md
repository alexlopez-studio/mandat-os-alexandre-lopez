# Ingestion Granola

Les rendez-vous vendeurs enregistrés dans Granola entrent dans Mandat OS, se
rattachent à une affaire, et produisent des actions graduées par risque.

Le schéma prévoyait déjà tout le chemin (`granola_connections`,
`external_transcripts`, `opportunity_meeting_links`, `ai_action_queue`) : ce
chantier écrit le code qui le remplit. Migration : `056_granola_ingestion.sql`.

---

## 1. Le chemin des données

```
Granola (MCP distant, OAuth)
        │  list_meetings + get_meetings
        ▼
POST /api/integrations/granola/ingest        ← point d'entrée UNIQUE
        │  ingestGranolaMeetings()
        ▼
external_transcripts        UNIQUE (provider, external_id) → idempotent
        │  matchMeetingToProject()
        ▼
opportunity_meeting_links   → projects        (needs_review si sous le seuil)
        │  extractTranscript()  — DeepSeek
        ▼
ai_action_queue             low / medium / high
        │  dispatchGranolaActions()
        ▼
activities · projects · contacts             signature `ai:granola`
```

Le poller quotidien, un webhook (Granola → Zapier) et un rejeu manuel appellent
tous le **même** endpoint d'ingestion : ce sont trois façons interchangeables
d'alimenter le même point d'entrée, sans rien changer en aval.

---

## 2. Ce qu'il faut savoir avant de toucher au code

| Point | Conséquence |
|---|---|
| **Plan gratuit, pas de clé API** | L'accès passe par OAuth sur `https://mcp.granola.ai/mcp`. Le client OAuth est enregistré dynamiquement (RFC 7591) à la première connexion. `encrypted_api_key` est devenue facultative. |
| **Résumés, pas verbatim** | `get_meeting_transcript` est réservé aux plans payants. `transcript_text` reste `NULL` : c'est nominal, pas une erreur. |
| **Le MCP répond en texte, pas en JSON** | `parseGranolaMeetings` lit un balisage `<meeting id=… title=… date=…>`. Un attribut mal lu casse l'idempotence, `external_id` étant la moitié de la clé unique. |
| **Fenêtre de 30 jours** | Au-delà, les réunions sortent de l'historique exposé et sont perdues sans recours. La synchronisation quotidienne n'est pas un confort. Alerte à 20 jours. |
| **Débit ~100 req/min** | Le client MCP espace ses appels de 700 ms. |
| **Deux ancrages différents** | Le rattachement métier fait foi dans `opportunity_meeting_links` (→ `projects`). `external_transcripts.dossier_id` pointe vers `client_dossiers` et restera nul longtemps. |

---

## 3. Les bascules

Toutes dans `app_settings`, ajustables sans redéploiement (page **Comptes rendus**).

| Clé | Défaut | Effet |
|---|---|---|
| `granola_sync_enabled` | `false` | Autorise le synchroniseur. Sans elle, le cron journalise un `blocked` et n'appelle pas Granola. |
| `granola_autodispatch_enabled` | `false` | Exécute les actions `low`. **Tant qu'elle est fausse, tout reste en `proposed`** — le mode proposition intégrale demandé pour juger la qualité d'extraction sur de vrais rendez-vous. |
| `granola_autodispatch_medium_enabled` | `false` | Étend l'exécution automatique au `medium`. |
| `granola_match_threshold` | `0.55` | Seuil de rattachement automatique. Volontairement provisoire : à figer après observation des scores réels. |
| `granola_extraction_model` | `deepseek-chat` | Modèle d'extraction. |

Variables d'environnement : `GRANOLA_INGEST_SECRET` (ou `CRON_SECRET`) pour
l'accès machine à `/api/integrations/granola/*`, `AI_CREDENTIALS_SECRET` pour le
chiffrement des jetons — **la même valeur partout**, sinon les jetons stockés
deviennent illisibles d'un environnement à l'autre.

---

## 4. Gradation des actions

| Niveau | Ce que c'est | Traitement |
|---|---|---|
| `low` | Écriture interne réversible : note, tâche, champ **vide** complété | Exécution directe si la bascule est active |
| `medium` | Écrasement d'une valeur renseignée, création de contact | Exécution directe **et** ancienne valeur écrite dans la timeline |
| `high` | Ce qui sort de l'app : e-mail, publication, prix affiché | Reste `proposed` jusqu'à validation. L'app n'envoie rien à la place d'Alexandre : valider revient à acquitter ce qu'il a fait lui-même. |

Le filet est double : le dispatch ne sélectionne jamais les `high`, et
`runAction` refuse un `high` dont l'acteur commence par `ai:`.

---

## 5. Les trois garde-fous d'écriture

**A. Créer une entité** — le risque est le doublon.
Index uniques partiels sur `contacts(email)` et `contacts(normalized_phone(phone))`,
plus la règle applicative que la base ne peut pas porter : *une personne citée
ne devient une fiche que s'il existe un point d'accroche identifiant* — e-mail,
téléphone, ou nom complet assorti d'un rôle. Sinon la mention reste dans une
note. **« Appeler Frédéric » est une tâche, pas un contact.**
CHECK `contacts_ai_types_not_empty` : une fiche créée par l'IA porte au moins un type.

**B. Ajouter un événement** — le risque est le rejeu.
`activities`, `opportunity_events`, `property_notes` et `voice_memos` n'ont
aucune clé naturelle. Chaque écriture IA porte donc une **clé de provenance**
dans `metadata` :

```json
{ "source_provider": "granola",
  "source_external_id": "<uuid de la réunion>",
  "source_item_key": "next_step:3" }
```

adossée à un index unique partiel sur les lignes `created_by like 'ai:%'`.
Retraiter deux fois le même compte rendu ne recrée rien : la violation
d'unicité est interprétée comme « déjà fait », pas comme une erreur.

**C. Modifier un champ** — le risque est l'écrasement silencieux.
L'ancienne valeur est écrite dans la timeline **avant** la modification, sous la
même clé de provenance suffixée `:trace`. Un dispatch fautif reste lisible et
réversible six semaines plus tard.

**Signature transverse** — `contacts.source`, `activities.created_by`,
`ai_action_queue.proposed_by` valent `ai:granola`. C'est ce qui rend un
nettoyage de masse possible :

```sql
-- Annuler toute l'extraction d'un compte rendu, en une requête.
delete from public.activities
where created_by like 'ai:%'
  and metadata->>'source_external_id' = '<uuid de la réunion>';

-- Annuler trois semaines d'extraction ratée.
delete from public.activities where created_by = 'ai:granola' and created_at > now() - interval '21 days';
delete from public.contacts   where source     = 'ai:granola' and created_at > now() - interval '21 days';
```

---

## 6. Exploitation

| Route | Rôle |
|---|---|
| `GET /api/integrations/granola/oauth/start` · `/callback` | Connexion OAuth (découverte + enregistrement dynamique + PKCE) |
| `POST /api/integrations/granola/ingest` | Point d'entrée unique — accepte `{ meetings: [...] }` ou `{ text: "<meetings_data>…" }` |
| `POST /api/integrations/granola/sync` | Synchronisation à la demande |
| `GET`/`PATCH /api/integrations/granola/status` | État, fraîcheur, bascules |
| `GET /api/integrations/granola/transcripts` · `PATCH`/`POST .../[id]` | Arbitrage et extraction |
| `GET`/`POST /api/integrations/granola/actions` | File d'actions, dispatch, décisions |
| `GET /api/jobs/granola-sync` | Cron quotidien (`30 4 * * *`), puis dispatch |

Back-office : **Comptes rendus** (`/app/granola`).

---

## 7. Hors périmètre

La captation des **appels entrants** (montage Twilio) est une phase 2 distincte.
`voice_memos` a reçu les mêmes colonnes de provenance et le même index unique
pour que l'extracteur puisse consommer cette seconde source sans nouvelle
migration.
