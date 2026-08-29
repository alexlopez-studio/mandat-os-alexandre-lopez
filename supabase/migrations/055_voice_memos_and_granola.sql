-- ==============================================================================
-- 055_voice_memos_and_granola.sql
-- Module Voice & Vision Intelligence (Clone Granola.ai pour Mandat OS)
-- Capture de mémos vocaux et photos de réunions/visites, transcription, OCR et CRM.
-- ==============================================================================

create table if not exists public.voice_memos (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  -- Pas de cle etrangere ici : `opportunities` est une VUE de compatibilite
  -- au-dessus de `projects` (migration `restore_views_instead_of_triggers`),
  -- et Postgres refuse une FK vers une vue. En l'etat, cette migration
  -- echouait a l'application — c'est pourquoi la table n'existait sur aucun
  -- environnement. Le rattachement metier se fait par `project_id`.
  opportunity_id uuid,
  
  -- Titre et type de réunion
  title text not null default 'Compte-rendu de réunion',
  meeting_type text not null default 'general', -- 'discovery_r1', 'estimation_r2', 'followup_call', 'visit', 'negotiation', 'general'
  
  -- Fichiers médias
  audio_url text,
  audio_storage_path text,
  audio_duration_seconds numeric,
  photos jsonb not null default '[]'::jsonb, -- Array de { url, storage_path, name, mime_type, ocr_data }
  
  -- Données IA
  transcript text,
  structured_summary jsonb not null default '{}'::jsonb, -- { context, key_points, objections, client_situation, property_insights }
  action_items jsonb not null default '[]'::jsonb, -- Array de { title, due_date, priority, assignee, completed }
  lead_temperature text default 'warm', -- 'cold', 'warm', 'hot'
  
  -- Métadonnées techniques
  source text not null default 'web', -- 'ios_shortcut', 'dictaphone', 'telegram', 'web'
  ai_provider text,
  ai_model text,
  raw_ai_response jsonb,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexation
create index if not exists idx_voice_memos_contact on public.voice_memos(contact_id);
create index if not exists idx_voice_memos_project on public.voice_memos(project_id);
create index if not exists idx_voice_memos_opp on public.voice_memos(opportunity_id);
create index if not exists idx_voice_memos_created on public.voice_memos(created_at desc);

-- RLS
alter table public.voice_memos enable row level security;
create policy "Voice memos accessible by authenticated users" on public.voice_memos for all using (auth.role() = 'authenticated');

-- Trigger updated_at
do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists voice_memos_updated_at on public.voice_memos;
    create trigger voice_memos_updated_at before update on public.voice_memos
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Création du bucket de stockage voice-memos dans Supabase si inexistant
insert into storage.buckets (id, name, public)
values ('voice-memos', 'voice-memos', true)
on conflict (id) do nothing;
