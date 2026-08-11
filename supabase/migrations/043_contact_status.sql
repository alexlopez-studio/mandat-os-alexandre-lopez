-- ==============================================================================
-- 043_contact_status.sql
-- Statut de qualification du contact (cycle de vie), distinct des typologies.
--
-- Le code applicatif ecrivait jusqu'ici le statut dans `contacts.types`, ce que
-- la contrainte `contacts_types_valid` (migration 039) rejette : toute
-- qualification ou archivage renvoyait une erreur 500. Le statut recoit donc sa
-- propre colonne, et `types` reste reserve aux typologies metier.
-- ==============================================================================

-- 1. Colonne de statut
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'qualified';

DO $$ BEGIN
  ALTER TABLE public.contacts ADD CONSTRAINT contacts_status_valid
    CHECK (status IN ('prospect', 'qualified', 'client', 'inactive', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts (status);

COMMENT ON COLUMN public.contacts.status IS
  'Statut de qualification : prospect | qualified | client | inactive | archived. Distinct de types (typologies metier).';

-- 2. Backfill reproduisant la deduction faite jusqu'ici cote client
--    (`getContactStatus` dans src/lib/contact-types.ts) : un contact capture
--    automatiquement est un prospect brut, un contact rattache a un projet est
--    un client actif, le reste est considere comme qualifie.
UPDATE public.contacts
SET status = 'prospect'
WHERE source IS NOT NULL
  AND (
    lower(source) LIKE '%playiad%'
    OR lower(source) LIKE '%email%'
    OR lower(source) LIKE '%seloger%'
    OR lower(source) = 'prospect'
  );

UPDATE public.contacts c
SET status = 'client'
WHERE EXISTS (SELECT 1 FROM public.project_contacts pc WHERE pc.contact_id = c.id);

-- 3. Vue annuaire : exposer le statut (colonne ajoutee en fin de projection
--    pour rester compatible avec CREATE OR REPLACE VIEW).
CREATE OR REPLACE VIEW public.contacts_directory
WITH (security_invoker = on) AS
SELECT
  c.id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.company,
  c.relation,
  c.source,
  c.types,
  c.created_at,
  c.updated_at,
  COALESCE(
    (
      SELECT array_agg(DISTINCT t ORDER BY t)
      FROM (
        SELECT unnest(c.types) AS t
        UNION
        SELECT CASE p.kind WHEN 'vente' THEN 'vendeur' ELSE 'acquereur' END
        FROM public.project_contacts pc
        JOIN public.projects p ON p.id = COALESCE(pc.opportunity_id, pc.buyer_criteria_id)
        WHERE pc.contact_id = c.id
      ) s(t)
      WHERE t IS NOT NULL
    ),
    ARRAY[]::text[]
  ) AS all_types,
  (SELECT count(*) FROM public.project_contacts pc WHERE pc.contact_id = c.id) AS projects_count,
  c.status
FROM public.contacts c;

COMMENT ON VIEW public.contacts_directory IS 'Annuaire des contacts : all_types cumule les typologies saisies et celles deduites des projets rattaches, status porte le cycle de vie.';

GRANT SELECT ON public.contacts_directory TO anon, authenticated, service_role;
