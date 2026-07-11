-- 021 — Espace client vendeur : profils, dossiers, documents et jalons

create extension if not exists "citext";
create extension if not exists "pgcrypto";

do $$ begin
  create type public.client_document_status as enum ('missing', 'requested', 'uploaded', 'validated', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.client_dossier_event_type as enum ('milestone', 'visit', 'offer', 'note', 'document', 'system');
exception when duplicate_object then null;
end $$;

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email citext unique not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_dossiers (
  id uuid primary key default gen_random_uuid(),
  client_profile_id uuid not null references public.client_profiles(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  seller_property_id uuid references public.seller_properties(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  title text not null default 'Dossier vendeur',
  property_snapshot jsonb not null default '{}'::jsonb,
  advisor_note text,
  professional_opinion jsonb not null default '{}'::jsonb,
  client_welcome_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_dossiers_scope_check check (
    lead_id is not null or seller_property_id is not null or opportunity_id is not null
  )
);

create unique index if not exists client_dossiers_lead_unique_idx
  on public.client_dossiers (lead_id)
  where lead_id is not null;

create index if not exists client_dossiers_profile_idx
  on public.client_dossiers (client_profile_id, created_at desc);

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.client_dossiers(id) on delete cascade,
  label text not null,
  category text not null default 'general',
  status public.client_document_status not null default 'requested',
  storage_path text,
  file_name text,
  mime_type text,
  file_size integer,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz,
  validated_at timestamptz,
  validated_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_documents_dossier_idx
  on public.client_documents (dossier_id, created_at asc);

create table if not exists public.client_dossier_events (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.client_dossiers(id) on delete cascade,
  type public.client_dossier_event_type not null default 'milestone',
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'done', 'blocked', 'info')),
  event_date date,
  payload jsonb not null default '{}'::jsonb,
  visible_to_client boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_dossier_events_dossier_idx
  on public.client_dossier_events (dossier_id, event_date asc nulls last, created_at asc);

drop trigger if exists client_profiles_updated_at on public.client_profiles;
create trigger client_profiles_updated_at
  before update on public.client_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists client_dossiers_updated_at on public.client_dossiers;
create trigger client_dossiers_updated_at
  before update on public.client_dossiers
  for each row execute function public.set_updated_at();

drop trigger if exists client_documents_updated_at on public.client_documents;
create trigger client_documents_updated_at
  before update on public.client_documents
  for each row execute function public.set_updated_at();

drop trigger if exists client_dossier_events_updated_at on public.client_dossier_events;
create trigger client_dossier_events_updated_at
  before update on public.client_dossier_events
  for each row execute function public.set_updated_at();

create or replace function public.sync_client_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    return new;
  end if;

  insert into public.client_profiles (user_id, email, first_name, last_name)
  values (
    new.id,
    new.email::citext,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (email) do update
  set
    user_id = coalesce(public.client_profiles.user_id, excluded.user_id),
    first_name = case
      when public.client_profiles.first_name = '' then excluded.first_name
      else public.client_profiles.first_name
    end,
    last_name = case
      when public.client_profiles.last_name = '' then excluded.last_name
      else public.client_profiles.last_name
    end,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_client_profile_from_auth on auth.users;
create trigger sync_client_profile_from_auth
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_client_profile_from_auth();

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

alter table public.client_profiles enable row level security;
alter table public.client_dossiers enable row level security;
alter table public.client_documents enable row level security;
alter table public.client_dossier_events enable row level security;

drop policy if exists client_profiles_self_select on public.client_profiles;
create policy client_profiles_self_select
  on public.client_profiles
  for select
  to authenticated
  using (
    is_active
    and (
      user_id = auth.uid()
      or email = (auth.jwt() ->> 'email')::citext
    )
  );

drop policy if exists client_profiles_self_update on public.client_profiles;
create policy client_profiles_self_update
  on public.client_profiles
  for update
  to authenticated
  using (is_active and user_id = auth.uid())
  with check (is_active and user_id = auth.uid());

drop policy if exists client_dossiers_self_select on public.client_dossiers;
create policy client_dossiers_self_select
  on public.client_dossiers
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_profiles cp
      where cp.id = client_dossiers.client_profile_id
        and cp.is_active
        and (cp.user_id = auth.uid() or cp.email = (auth.jwt() ->> 'email')::citext)
    )
  );

drop policy if exists client_documents_self_select on public.client_documents;
create policy client_documents_self_select
  on public.client_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where cd.id = client_documents.dossier_id
        and cp.is_active
        and (cp.user_id = auth.uid() or cp.email = (auth.jwt() ->> 'email')::citext)
    )
  );

drop policy if exists client_documents_self_insert on public.client_documents;
create policy client_documents_self_insert
  on public.client_documents
  for insert
  to authenticated
  with check (
    uploaded_by_user_id = auth.uid()
    and exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where cd.id = client_documents.dossier_id
        and cp.is_active
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists client_documents_self_update on public.client_documents;
create policy client_documents_self_update
  on public.client_documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where cd.id = client_documents.dossier_id
        and cp.is_active
        and cp.user_id = auth.uid()
    )
  )
  with check (
    uploaded_by_user_id = auth.uid()
    and exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where cd.id = client_documents.dossier_id
        and cp.is_active
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists client_dossier_events_self_select on public.client_dossier_events;
create policy client_dossier_events_self_select
  on public.client_dossier_events
  for select
  to authenticated
  using (
    visible_to_client
    and exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where cd.id = client_dossier_events.dossier_id
        and cp.is_active
        and (cp.user_id = auth.uid() or cp.email = (auth.jwt() ->> 'email')::citext)
    )
  );

drop policy if exists client_dossier_events_self_insert on public.client_dossier_events;
create policy client_dossier_events_self_insert
  on public.client_dossier_events
  for insert
  to authenticated
  with check (
    visible_to_client
    and exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where cd.id = client_dossier_events.dossier_id
        and cp.is_active
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists leads_client_portal_select on public.leads;
create policy leads_client_portal_select
  on public.leads
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where cd.lead_id = leads.id
        and cp.is_active
        and (cp.user_id = auth.uid() or cp.email = (auth.jwt() ->> 'email')::citext)
    )
  );

drop policy if exists prospects_client_portal_select on public.prospects;
create policy prospects_client_portal_select
  on public.prospects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      join public.client_dossiers cd on cd.lead_id = l.id
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where l.prospect_id = prospects.id
        and cp.is_active
        and (cp.user_id = auth.uid() or cp.email = (auth.jwt() ->> 'email')::citext)
    )
  );

drop policy if exists seller_properties_client_portal_select on public.seller_properties;
create policy seller_properties_client_portal_select
  on public.seller_properties
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where (cd.seller_property_id = seller_properties.id or cd.lead_id::text = seller_properties.lead_id)
        and cp.is_active
        and (cp.user_id = auth.uid() or cp.email = (auth.jwt() ->> 'email')::citext)
    )
  );

drop policy if exists opportunities_client_portal_select on public.opportunities;
create policy opportunities_client_portal_select
  on public.opportunities
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_dossiers cd
      join public.client_profiles cp on cp.id = cd.client_profile_id
      where (cd.opportunity_id = opportunities.id or cd.lead_id = opportunities.lead_id)
        and cp.is_active
        and (cp.user_id = auth.uid() or cp.email = (auth.jwt() ->> 'email')::citext)
    )
  );

drop policy if exists client_documents_storage_insert on storage.objects;
create policy client_documents_storage_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'client-documents' and owner = auth.uid());

drop policy if exists client_documents_storage_select on storage.objects;
create policy client_documents_storage_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'client-documents' and owner = auth.uid());

comment on table public.client_profiles is 'Comptes vendeurs externes rattaches a Supabase Auth, distincts des admins.';
comment on table public.client_dossiers is 'Perimetre client : dossier vendeur expose dans l espace client.';
comment on table public.client_documents is 'Checklist et fichiers de dossier vendeur dans le bucket client-documents.';
comment on table public.client_dossier_events is 'Jalons et evenements visibles dans le suivi de vente client.';
