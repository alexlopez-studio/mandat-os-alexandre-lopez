-- 031 — Workflow de revue pour les imports d'estimation (skill Claude → admin)

alter table public.estimation_imports
  add column if not exists status text not null default 'pending' check (status in ('pending','applied','rejected')),
  add column if not exists applied_at timestamptz,
  add column if not exists applied_by uuid references public.admin_users(id) on delete set null,
  add column if not exists reviewed_note text;

create index if not exists estimation_imports_status_idx on public.estimation_imports (status);
create index if not exists estimation_imports_opportunity_status_idx on public.estimation_imports (opportunity_id, status);
