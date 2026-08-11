-- ==============================================================================
-- 044_drop_buyer_lead_candidates.sql
-- Abandon du scan des e-mails acquereurs (migration 042).
--
-- La capture des leads acquereurs passe desormais par l'extension Chrome
-- Playiad (`extensions/playiad-sync`) : la file de candidats issue de Gmail
-- n'a plus de producteur ni d'ecran de validation.
--
-- ATTENTION : cette migration detruit les candidats encore stockes. La
-- verifier avant application :
--   select status, count(*) from public.buyer_lead_candidates group by status;
-- ==============================================================================

DROP TABLE IF EXISTS public.buyer_lead_candidates;
