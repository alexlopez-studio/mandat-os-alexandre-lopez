-- =============================================================
-- Migration 029 — Assistant Telegram (V1 texte)
-- Capture de notes, taches et contacts depuis Telegram, avec
-- journal reversible : chaque ecriture peut etre annulee.
-- =============================================================

create extension if not exists "pgcrypto";

-- ── 1. Journal brut des messages recus ─────────────────────────
-- update_id est unique : Telegram reemet un update tant qu'il n'a
-- pas recu de 200, cette contrainte garantit l'idempotence.
create table if not exists public.telegram_messages (
  id           uuid primary key default gen_random_uuid(),
  update_id    bigint not null unique,
  chat_id      bigint not null,
  message_id   bigint,
  kind         text not null default 'text' check (kind in ('text', 'voice', 'command', 'callback')),
  body         text,
  raw          jsonb not null default '{}'::jsonb,
  status       text not null default 'received' check (status in ('received', 'processed', 'rejected', 'failed')),
  error        text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists telegram_messages_chat_idx
  on public.telegram_messages (chat_id, created_at desc);

create index if not exists telegram_messages_status_idx
  on public.telegram_messages (status, created_at desc);

-- ── 2. Journal reversible des operations ───────────────────────
-- `ref` est le numero court affiche dans Telegram (« ✅ #47 »),
-- celui qu'Alexandre reutilise pour « /annuler 47 ».
create table if not exists public.telegram_operations (
  id           uuid primary key default gen_random_uuid(),
  ref          integer generated always as identity,
  chat_id      bigint not null,
  intent       text not null,
  summary      text not null,
  source_text  text not null,
  target_table text,
  target_id    uuid,
  undo         jsonb not null default '{}'::jsonb,
  status       text not null default 'applied' check (status in ('applied', 'undone', 'failed')),
  error        text,
  undone_at    timestamptz,
  created_at   timestamptz not null default now()
);

create unique index if not exists telegram_operations_ref_idx
  on public.telegram_operations (ref);

create index if not exists telegram_operations_recap_idx
  on public.telegram_operations (chat_id, created_at desc);

comment on column public.telegram_operations.undo is
  'Instruction de reversion : {"type":"delete","table":"...","id":"..."}. Rejouee par /annuler.';

-- ── 3. Memoire courte de conversation ──────────────────────────
-- Le webhook est sans etat : cette table porte la question en
-- attente (« quel Dupont ? ») entre deux messages.
create table if not exists public.telegram_sessions (
  chat_id               bigint primary key,
  pending               jsonb not null default '{}'::jsonb,
  last_opportunity_id   uuid,
  expires_at            timestamptz,
  updated_at            timestamptz not null default now()
);

do $$ begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists telegram_sessions_updated_at on public.telegram_sessions;
    create trigger telegram_sessions_updated_at before update on public.telegram_sessions
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.telegram_messages   enable row level security;
alter table public.telegram_operations enable row level security;
alter table public.telegram_sessions   enable row level security;

comment on table public.telegram_messages is
  'Messages Telegram bruts. Aucune RLS policy : acces uniquement via service role cote serveur.';
