-- =============================================================
-- Migration 019 — Revision pipeline opportunites vendeur
-- Renomme les anciens stages et introduit la colonne Vendu.
-- =============================================================

update public.opportunities
set stage = case stage
  when 'RDV / Visite' then 'Visite d''estimation'
  when 'Rapport remis' then 'Remise de l''estimation'
  when 'Rendez-vous à préparer' then 'Visite d''estimation'
  when 'Converti' then 'Mandat signé'
  when 'Vendu' then 'Vendu'
  else stage
end
where stage in (
  'RDV / Visite',
  'Rapport remis',
  'Rendez-vous à préparer',
  'Converti',
  'Vendu'
);

comment on column public.opportunities.stage is 'Pipeline vendeur : Nouveau contact, Pré-estimation, Visite d''estimation, Remise de l''estimation, Décision vendeur, Suivi moyen terme, Mandat signé, Vendu, Perdu / Écarté.';
