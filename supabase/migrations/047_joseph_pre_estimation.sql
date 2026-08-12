-- ==============================================================================
-- 047_joseph_pre_estimation.sql
-- Avance le projet Joseph & Régine (Barjols) à l'étape « Pré-estimation » du
-- pipeline SMQ v1, avec fourchette indicative issue des moyennes DVF Barjols
-- (maisons) : prix moyen 356 711 €, 3 683 €/m², surface moyenne 98 m².
-- Jalons posés : changement d'étape + pré-estimation.
-- Idempotent : ciblé par titre, rejouable sans risque.
-- ==============================================================================

do $$
declare
  v_project_id uuid;
begin
  select id into v_project_id
  from public.projects
  where title like 'Vente maison — Joseph & Régine — Barjols%'
  order by created_at
  limit 1;

  if v_project_id is null then
    raise notice 'Projet Joseph & Régine introuvable — rien à faire.';
    return;
  end if;

  -- 1. Passage en Pré-estimation + données pré-estimation
  update public.projects
  set stage = 'Pré-estimation',
      seller_name = coalesce(seller_name, 'Joseph & Régine'),
      property_type = coalesce(property_type, 'maison'),
      source_channel = coalesce(source_channel, 'manual'),
      estimated_price_min = 300000,
      estimated_price_max = 400000,
      pre_estimation_done_at = now(),
      next_action = 'Planifier la visite d''estimation',
      property_snapshot = jsonb_build_object(
        'city', 'Barjols',
        'type', 'maison',
        'fourchette', jsonb_build_object('min', 300000, 'max', 400000),
        'note', 'Fourchette indicative DVF Barjols (prix moyen 356 711 €, 3 683 €/m²) — à affiner à la visite'
      ),
      updated_at = now()
  where id = v_project_id;

  -- 2. Événement changement d'étape
  insert into public.opportunity_events (opportunity_id, type, title, content, created_by)
  values (v_project_id, 'stage_change', 'Passage en Pré-estimation',
          'Projet avancé de Prospection à Pré-estimation.', 'admin');

  -- 3. Jalon pré-estimation (fourchette indicative DVF)
  insert into public.opportunity_events (opportunity_id, type, title, content, metadata, created_by)
  values (v_project_id, 'estimation', 'Pré-estimation réalisée',
          'Fourchette indicative 300 000 – 400 000 €. DVF Barjols : prix moyen 356 711 €, 3 683 €/m², surface moyenne 98 m², 320 ventes.',
          jsonb_build_object(
            'dvf', jsonb_build_object('prix_moyen', 356711, 'prix_m2', 3683, 'surface_moy', 98, 'nb_ventes', 320),
            'fourchette', jsonb_build_object('min', 300000, 'max', 400000)
          ),
          'admin');
end $$;
