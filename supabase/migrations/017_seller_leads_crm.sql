-- =============================================================
-- Migration 017 — Leads CRM vendeur
-- Recentre la table leads comme base CRM de prospection vendeur
-- et relie les opportunites a leur lead d'origine.
-- =============================================================

alter table public.prospects
  alter column email drop not null;

alter table public.leads
  add column if not exists source_channel text,
  add column if not exists priority text not null default 'medium',
  add column if not exists next_action text,
  add column if not exists due_date date,
  add column if not exists follow_up_at date;

alter table public.opportunities
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists leads_source_channel_idx
  on public.leads(source_channel);

create index if not exists leads_priority_idx
  on public.leads(priority);

create index if not exists leads_due_date_idx
  on public.leads(due_date);

create index if not exists leads_follow_up_at_idx
  on public.leads(follow_up_at);

create index if not exists opportunities_lead_id_idx
  on public.opportunities(lead_id);

comment on column public.leads.source_channel is 'Origine CRM du lead : flyer, porte_a_porte, appel_entrant, estimation_site, recommandation, autre.';
comment on column public.leads.priority is 'Priorite CRM du lead : low, medium, high, critical.';
comment on column public.leads.next_action is 'Prochaine action commerciale prevue.';
comment on column public.leads.due_date is 'Echeance de la prochaine action.';
comment on column public.leads.follow_up_at is 'Date de relance, notamment pour le suivi moyen terme.';
comment on column public.opportunities.lead_id is 'Lead vendeur source de l''opportunite, si la piste vient du CRM Leads.';
