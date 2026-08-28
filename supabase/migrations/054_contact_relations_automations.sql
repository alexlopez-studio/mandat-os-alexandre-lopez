-- ==============================================================================
-- 054_contact_relations_automations.sql
-- Ajout des coordonnées enrichies, statuts relationnels et automatisations sur les contacts
-- ==============================================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS civilite text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS birth_date text,
  ADD COLUMN IF NOT EXISTS wishes_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS transaction_date text,
  ADD COLUMN IF NOT EXISTS review_request text,
  ADD COLUMN IF NOT EXISTS recommendation_request text,
  ADD COLUMN IF NOT EXISTS is_future_seller boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
