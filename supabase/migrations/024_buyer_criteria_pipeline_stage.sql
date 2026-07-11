alter table public.buyer_criteria
  add column if not exists stage text not null default 'Nouveau contact',
  add column if not exists next_action text,
  add column if not exists due_date date;

create index if not exists buyer_criteria_stage_idx on public.buyer_criteria(stage);
create index if not exists buyer_criteria_due_date_idx on public.buyer_criteria(due_date);

comment on column public.buyer_criteria.stage is
  'Statut pipeline acquereur affiche dans le Kanban opportunites.';
comment on column public.buyer_criteria.next_action is
  'Prochaine action commerciale rattachee au profil acquereur.';
comment on column public.buyer_criteria.due_date is
  'Echeance de la prochaine action acquereur.';
