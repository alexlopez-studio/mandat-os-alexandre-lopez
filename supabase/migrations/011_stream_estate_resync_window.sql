-- Migration 011 — Stream Estate : fenêtre anti-re-sync
--
-- Objectif :
--   - éviter de re-synchroniser (et donc de re-payer) une zone vue récemment ;
--   - la fenêtre (en minutes) est configurable via app_settings, défaut 360 (6 h).
--   - la sync consulte monitored_zones.last_synced_at avant tout appel API ;
--     si la zone est plus récente que la fenêtre, elle renvoie la base sans appel.

insert into public.app_settings (key, value)
values
  ('stream_estate_resync_window_minutes', '360'::jsonb)
on conflict (key) do nothing;
