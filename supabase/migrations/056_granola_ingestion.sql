-- ==============================================================================
-- 056_granola_ingestion.sql
-- Ingestion Granola : connexion OAuth, suivi d'extraction, garde-fous d'ecriture IA.
--
-- Trois familles d'ecriture, trois garde-fous (cf. docs/GRANOLA_INGESTION.md §5) :
--   A. creer une entite  -> cle d'identite (index unique partiel)
--   B. ajouter un evenement -> cle de provenance (source + external_id + rang)
--   C. modifier un champ -> trace de l'ancienne valeur (applicatif, cf. dispatch)
--
-- Regle transverse : toute ligne ecrite par l'IA porte une signature de source
-- du type `ai:granola` dans `source` / `created_by` / `proposed_by`.
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- A. Connexion Granola : OAuth au lieu d'une cle API statique
--
-- Le plan gratuit n'expose pas de cle API : l'acces passe par le MCP distant
-- `https://mcp.granola.ai/mcp` en OAuth. `encrypted_api_key` avait ete concue
-- pour une cle statique ; elle devient facultative, et le jeu de jetons
-- (acces + rafraichissement + expiration) prend sa place.
-- ──────────────────────────────────────────────────────────────────────────────

alter table public.granola_connections
  alter column encrypted_api_key drop not null;

alter table public.granola_connections
  add column if not exists account_email text,
  add column if not exists server_url text not null default 'https://mcp.granola.ai/mcp',
  add column if not exists encrypted_access_token text,
  add column if not exists encrypted_refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists scopes text[] not null default '{}',
  add column if not exists oauth_client_id text,
  add column if not exists encrypted_oauth_client_secret text,
  add column if not exists oauth_metadata jsonb not null default '{}'::jsonb;

comment on column public.granola_connections.encrypted_api_key is
  'Facultatif depuis la 056 : le plan gratuit ne fournit pas de cle statique, l''acces se fait en OAuth.';
comment on column public.granola_connections.token_expires_at is
  'Expiration du jeton d''acces. Un rafraichissement impossible bascule status en error et renseigne last_error.';

-- ──────────────────────────────────────────────────────────────────────────────
-- B. Transcripts : suivi de l'extraction IA
-- ──────────────────────────────────────────────────────────────────────────────

alter table public.external_transcripts
  add column if not exists extracted_at timestamptz,
  add column if not exists extraction_error text;

create index if not exists external_transcripts_provider_status_idx
  on public.external_transcripts (provider, status, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────────
-- C. Normalisation du telephone (necessaire aux cles d'identite)
--
-- IMMUTABLE : condition sine qua non pour servir d'expression d'index.
-- ──────────────────────────────────────────────────────────────────────────────

create or replace function public.normalized_phone(value text)
returns text
language sql
immutable
as $$
  select case
    when d = '' then null
    when length(d) = 11 and left(d, 2) = '33' then '0' || right(d, 9)
    when length(d) = 12 and left(d, 3) = '033' then '0' || right(d, 9)
    else d
  end
  from (select regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g') as d) t;
$$;

comment on function public.normalized_phone(text) is
  'Telephone reduit a ses chiffres, prefixe 33 ramene a 0. Sert de cle de deduplication des contacts.';

-- ──────────────────────────────────────────────────────────────────────────────
-- D. Garde-fou A — creer une entite : cle d'identite
--
-- `contacts` n'avait aucune cle unique alors que l'IA va y ecrire. Les index
-- sont partiels : ils ne contraignent que les fiches qui portent un point
-- d'accroche identifiant, jamais les fiches reduites a un prenom.
--
-- La creation est tentee sous DO/EXCEPTION : si des doublons preexistent, la
-- migration ne casse pas — elle pose un index non unique et remonte un WARNING
-- avec la marche a suivre. Le garde-fou applicatif reste actif entre-temps.
-- ──────────────────────────────────────────────────────────────────────────────

do $$
begin
  begin
    create unique index if not exists contacts_email_unique_idx
      on public.contacts (email)
      where email is not null and email::text <> '';
  exception when unique_violation then
    raise warning 'contacts_email_unique_idx non cree : doublons d''email preexistants. Fusionnez-les puis rejouez la migration.';
    create index if not exists contacts_email_idx
      on public.contacts (email)
      where email is not null and email::text <> '';
  end;

  begin
    create unique index if not exists contacts_phone_unique_idx
      on public.contacts (public.normalized_phone(phone))
      where public.normalized_phone(phone) is not null;
  exception when unique_violation then
    raise warning 'contacts_phone_unique_idx non cree : doublons de telephone preexistants. Fusionnez-les puis rejouez la migration.';
    create index if not exists contacts_phone_idx
      on public.contacts (public.normalized_phone(phone))
      where public.normalized_phone(phone) is not null;
  end;
end $$;

-- `types` vide passe le CHECK `<@` existant (un tableau vide est inclus dans
-- tout tableau). Une fiche creee par l'IA doit porter au moins un type, sinon
-- elle devient invisible dans les filtres du CRM.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contacts_ai_types_not_empty' and conrelid = 'public.contacts'::regclass
  ) then
    alter table public.contacts
      add constraint contacts_ai_types_not_empty
      check (source is null or source not like 'ai:%' or coalesce(array_length(types, 1), 0) > 0)
      not valid;
    alter table public.contacts validate constraint contacts_ai_types_not_empty;
  end if;
end $$;

-- Tables d'entites que l'IA n'ecrit pas encore — protegees d'avance.
create unique index if not exists warm_contacts_email_unique_idx
  on public.warm_contacts (lower(email))
  where email is not null and email <> '';

create unique index if not exists warm_contacts_phone_unique_idx
  on public.warm_contacts (public.normalized_phone(phone))
  where public.normalized_phone(phone) is not null;

-- `seller_properties` n'a pas d'identifiant naturel : l'adresse normalisee,
-- rattachee au lead, en tient lieu.
create unique index if not exists seller_properties_lead_adresse_unique_idx
  on public.seller_properties (lead_id, lower(regexp_replace(adresse, '\s+', ' ', 'g')))
  where lead_id is not null and adresse is not null and adresse <> '';

-- ──────────────────────────────────────────────────────────────────────────────
-- E. Garde-fou B — ajouter un evenement : cle de provenance
--
-- Ces journaux n'ont aucune cle naturelle et n'en auront jamais. Le risque
-- n'est pas le doublon d'entite mais le REJEU : retraiter un compte rendu
-- recreerait les memes taches. On generalise donc le motif
-- `(provider, external_id)` sous forme de cle de provenance stockee dans
-- `metadata`, avec un index unique sur les seules lignes produites par l'IA.
--
--   metadata.source_provider    -> 'granola'
--   metadata.source_external_id -> UUID de la reunion d'origine
--   metadata.source_item_key    -> rang / cle de l'element extrait
-- ──────────────────────────────────────────────────────────────────────────────

alter table public.property_notes
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_by text;

alter table public.voice_memos
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_by text;

create unique index if not exists activities_ai_provenance_idx
  on public.activities (
    (metadata ->> 'source_provider'),
    (metadata ->> 'source_external_id'),
    (metadata ->> 'source_item_key')
  )
  where created_by like 'ai:%' and metadata ->> 'source_external_id' is not null;

create unique index if not exists opportunity_events_ai_provenance_idx
  on public.opportunity_events (
    (metadata ->> 'source_provider'),
    (metadata ->> 'source_external_id'),
    (metadata ->> 'source_item_key')
  )
  where created_by like 'ai:%' and metadata ->> 'source_external_id' is not null;

create unique index if not exists property_notes_ai_provenance_idx
  on public.property_notes (
    (metadata ->> 'source_provider'),
    (metadata ->> 'source_external_id'),
    (metadata ->> 'source_item_key')
  )
  where created_by like 'ai:%' and metadata ->> 'source_external_id' is not null;

create unique index if not exists voice_memos_ai_provenance_idx
  on public.voice_memos (
    (metadata ->> 'source_provider'),
    (metadata ->> 'source_external_id'),
    (metadata ->> 'source_item_key')
  )
  where created_by like 'ai:%' and metadata ->> 'source_external_id' is not null;

-- Signature de source : sans elle, une extraction ratee sur trois semaines
-- devient impossible a distinguer de la saisie manuelle, donc impossible a
-- annuler. Ces index rendent le nettoyage de masse instantane.
create index if not exists activities_ai_source_idx
  on public.activities (created_by, created_at desc)
  where created_by like 'ai:%';

create index if not exists contacts_ai_source_idx
  on public.contacts (source, created_at desc)
  where source like 'ai:%';

-- ──────────────────────────────────────────────────────────────────────────────
-- F. Bascule runtime du synchroniseur (convention `app_settings`)
-- ──────────────────────────────────────────────────────────────────────────────

insert into public.app_settings (key, value)
values ('granola_sync_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- ──────────────────────────────────────────────────────────────────────────────
-- G. Piege n° 4 — RLS manquant
--
-- Un `ENABLE` seul bloquerait tout acces : chaque table recoit sa policy.
-- `service_role` (routes serveur) contourne deja RLS ; la policy ouvre la
-- lecture/ecriture aux sessions authentifiees, comme partout ailleurs.
-- ──────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'market_property_sources',
    'market_property_duplicate_candidates',
    'project_reference_counters'
  ] loop
    if exists (select 1 from pg_class where oid = ('public.' || t)::regclass) then
      execute format('alter table public.%I enable row level security', t);
      if not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = t and policyname = t || '_authenticated_all'
      ) then
        execute format(
          'create policy %I on public.%I for all to authenticated using (true) with check (true)',
          t || '_authenticated_all', t
        );
      end if;
    end if;
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- H. Triggers updated_at sur les tables nouvellement dotees de colonnes
-- ──────────────────────────────────────────────────────────────────────────────

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists property_notes_updated_at on public.property_notes;
    create trigger property_notes_updated_at before update on public.property_notes
      for each row execute function public.set_updated_at();
  end if;
end $$;
