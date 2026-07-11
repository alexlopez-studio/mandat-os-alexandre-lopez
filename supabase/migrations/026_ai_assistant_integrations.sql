-- 026 — Assistant IA plug-and-play, credentials et integrations

create extension if not exists "pgcrypto";

create table if not exists public.ai_providers (
  id text primary key,
  label text not null,
  category text not null default 'direct',
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_credentials (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  label text not null,
  encrypted_api_key text not null,
  default_model text,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_tested_at timestamptz,
  last_error text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_credentials_provider_active_idx
  on public.ai_credentials (provider_id)
  where status = 'active';

create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Conversation IA',
  dossier_id uuid references public.client_dossiers(id) on delete set null,
  provider_id text,
  model text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_thread_idx
  on public.ai_messages (thread_id, created_at asc);

create table if not exists public.ai_action_queue (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  action_type text not null,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'executed', 'failed')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  dossier_id uuid references public.client_dossiers(id) on delete set null,
  thread_id uuid references public.ai_threads(id) on delete set null,
  source text not null default 'assistant',
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  proposed_by text,
  reviewed_by text,
  reviewed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_action_queue_status_idx
  on public.ai_action_queue (status, created_at desc);
create index if not exists ai_action_queue_dossier_idx
  on public.ai_action_queue (dossier_id, created_at desc);

create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  account_email text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.granola_connections (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'Granola',
  encrypted_api_key text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_synced_at timestamptz,
  last_cursor text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists granola_connections_label_active_idx
  on public.granola_connections (label)
  where status = 'active';

create table if not exists public.external_transcripts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  title text not null,
  meeting_at timestamptz,
  summary text,
  transcript_text text,
  raw_payload jsonb not null default '{}'::jsonb,
  dossier_id uuid references public.client_dossiers(id) on delete set null,
  classification_confidence numeric(4,3),
  status text not null default 'needs_review' check (status in ('classified', 'needs_review', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create index if not exists external_transcripts_dossier_idx
  on public.external_transcripts (dossier_id, created_at desc);

create table if not exists public.dossier_ai_insights (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.client_dossiers(id) on delete cascade,
  kind text not null,
  content jsonb not null default '{}'::jsonb,
  source text not null default 'assistant',
  confidence numeric(4,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dossier_ai_insights_dossier_idx
  on public.dossier_ai_insights (dossier_id, kind, created_at desc);

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists ai_providers_updated_at on public.ai_providers;
    create trigger ai_providers_updated_at before update on public.ai_providers
      for each row execute function public.set_updated_at();

    drop trigger if exists ai_credentials_updated_at on public.ai_credentials;
    create trigger ai_credentials_updated_at before update on public.ai_credentials
      for each row execute function public.set_updated_at();

    drop trigger if exists ai_threads_updated_at on public.ai_threads;
    create trigger ai_threads_updated_at before update on public.ai_threads
      for each row execute function public.set_updated_at();

    drop trigger if exists ai_action_queue_updated_at on public.ai_action_queue;
    create trigger ai_action_queue_updated_at before update on public.ai_action_queue
      for each row execute function public.set_updated_at();

    drop trigger if exists google_connections_updated_at on public.google_connections;
    create trigger google_connections_updated_at before update on public.google_connections
      for each row execute function public.set_updated_at();

    drop trigger if exists granola_connections_updated_at on public.granola_connections;
    create trigger granola_connections_updated_at before update on public.granola_connections
      for each row execute function public.set_updated_at();

    drop trigger if exists external_transcripts_updated_at on public.external_transcripts;
    create trigger external_transcripts_updated_at before update on public.external_transcripts
      for each row execute function public.set_updated_at();

    drop trigger if exists dossier_ai_insights_updated_at on public.dossier_ai_insights;
    create trigger dossier_ai_insights_updated_at before update on public.dossier_ai_insights
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.ai_providers enable row level security;
alter table public.ai_credentials enable row level security;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_action_queue enable row level security;
alter table public.google_connections enable row level security;
alter table public.granola_connections enable row level security;
alter table public.external_transcripts enable row level security;
alter table public.dossier_ai_insights enable row level security;

insert into public.ai_providers (id, label, category, metadata)
values
  ('openrouter', 'OpenRouter', 'router', '{"models_endpoint":"https://openrouter.ai/api/v1/models"}'::jsonb),
  ('openai', 'OpenAI', 'direct', '{}'::jsonb),
  ('anthropic', 'Anthropic', 'direct', '{}'::jsonb),
  ('google', 'Google Gemini', 'direct', '{}'::jsonb),
  ('mistral', 'Mistral AI', 'direct', '{}'::jsonb),
  ('deepseek', 'DeepSeek', 'direct', '{}'::jsonb),
  ('xai', 'xAI', 'direct', '{}'::jsonb),
  ('groq', 'Groq', 'direct', '{}'::jsonb),
  ('perplexity', 'Perplexity', 'direct', '{}'::jsonb),
  ('together', 'Together AI', 'direct', '{}'::jsonb),
  ('fireworks', 'Fireworks AI', 'direct', '{}'::jsonb),
  ('cohere', 'Cohere', 'direct', '{}'::jsonb)
on conflict (id) do update
set label = excluded.label,
    category = excluded.category,
    metadata = public.ai_providers.metadata || excluded.metadata,
    updated_at = now();

comment on table public.ai_credentials is 'Cles API IA chiffrees cote serveur. Ne jamais exposer encrypted_api_key au client.';
comment on table public.ai_action_queue is 'Actions proposees par IA. Execution seulement apres validation humaine.';
comment on table public.external_transcripts is 'Transcripts externes (Granola, etc.) rattaches ou a revoir pour les dossiers clients.';
