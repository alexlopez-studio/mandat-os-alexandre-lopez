-- =============================================================
-- Migration 018 — Timeline CRM des opportunites
-- Ajoute un journal d'activites dedie aux opportunites vendeur.
-- =============================================================

do $$ begin
  create type public.opportunity_event_type as enum (
    'note',
    'task',
    'call',
    'meeting',
    'email',
    'stage_change',
    'estimation',
    'system'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.opportunity_events (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  type           public.opportunity_event_type not null default 'note',
  title          text,
  content        text,
  due_at         timestamptz,
  occurred_at    timestamptz not null default now(),
  completed_at   timestamptz,
  metadata       jsonb not null default '{}'::jsonb,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists opportunity_events_opportunity_idx
  on public.opportunity_events (opportunity_id, occurred_at desc, created_at desc);

create index if not exists opportunity_events_type_idx
  on public.opportunity_events (type);

create index if not exists opportunity_events_due_idx
  on public.opportunity_events (due_at)
  where completed_at is null;

drop trigger if exists opportunity_events_updated_at on public.opportunity_events;
create trigger opportunity_events_updated_at
  before update on public.opportunity_events
  for each row execute function public.set_updated_at();

alter table public.opportunity_events enable row level security;

-- Migration douce des anciens champs libres vers la nouvelle timeline.
insert into public.opportunity_events (opportunity_id, type, title, content, occurred_at, metadata, created_by)
select
  o.id,
  'system'::public.opportunity_event_type,
  'Contexte importé',
  o.description,
  coalesce(o.updated_at, o.created_at, now()),
  jsonb_build_object('migrated_from', 'opportunities.description'),
  'migration'
from public.opportunities o
where nullif(trim(coalesce(o.description, '')), '') is not null
  and not exists (
    select 1
    from public.opportunity_events e
    where e.opportunity_id = o.id
      and e.metadata ->> 'migrated_from' = 'opportunities.description'
  );

insert into public.opportunity_events (opportunity_id, type, title, content, occurred_at, metadata, created_by)
select
  o.id,
  'note'::public.opportunity_event_type,
  'Journal importé',
  o.note,
  coalesce(o.updated_at, o.created_at, now()),
  jsonb_build_object('migrated_from', 'opportunities.note'),
  'migration'
from public.opportunities o
where nullif(trim(coalesce(o.note, '')), '') is not null
  and not exists (
    select 1
    from public.opportunity_events e
    where e.opportunity_id = o.id
      and e.metadata ->> 'migrated_from' = 'opportunities.note'
  );

comment on table public.opportunity_events is 'Timeline CRM dediee aux opportunites : notes, taches, appels, RDV, emails logues et jalons.';
comment on column public.opportunity_events.due_at is 'Date echeance pour les taches, appels ou RDV planifies.';
comment on column public.opportunity_events.completed_at is 'Renseigne quand une tache ou activite planifiee est terminee.';
