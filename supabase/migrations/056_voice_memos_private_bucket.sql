-- ==============================================================================
-- 056_voice_memos_private_bucket.sql
-- Ferme le bucket `voice-memos`, ouvert en public par la migration 055.
--
-- Les enregistrements de rendez-vous et les photos de documents (taxe fonciere,
-- titre de propriete, DPE) sont des donnees clients : une URL publique reste
-- lisible par quiconque la recupere, sans authentification et sans expiration.
-- L'application ne sert plus que des liens signes a duree limitee, generes a la
-- lecture depuis `audio_storage_path` / `photos[].storage_path`
-- (`src/lib/ai/voice-memo-storage.ts`).
-- ==============================================================================

update storage.buckets
set public = false
where id = 'voice-memos';

-- Les URL publiques deja enregistrees ne menent plus nulle part et donnaient un
-- acces perpetuel : on les efface. Le chemin de stockage, lui, est conserve —
-- c'est desormais la seule source pour signer un lien.
update public.voice_memos
set audio_url = null
where audio_url is not null;

update public.voice_memos
set photos = (
  select coalesce(jsonb_agg(photo - 'url'), '[]'::jsonb)
  from jsonb_array_elements(photos) as photo
)
where jsonb_typeof(photos) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(photos) as photo
    where photo ? 'url'
  );

-- Meme nettoyage dans le journal CRM, ou la note est dupliquee.
update public.activities
set metadata = metadata - 'audio_url'
where metadata ? 'audio_url'
  and coalesce((metadata ->> 'voice_memo')::boolean, false);
