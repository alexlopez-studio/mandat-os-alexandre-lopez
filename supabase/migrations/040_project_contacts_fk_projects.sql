-- ==============================================================================
-- 040 : project_contacts pointe sur projects, plus sur les tables legacy
-- ==============================================================================
--
-- Contexte
-- --------
-- `project_contacts.opportunity_id` / `buyer_criteria_id` referencaient encore
-- `legacy_opportunities` / `legacy_buyer_criteria` (migration 034), alors que
-- depuis 036/038 les projets vivent dans `projects` et que `opportunities` /
-- `buyer_criteria` ne sont plus que des vues (INSTEAD OF INSERT -> projects).
--
-- Consequence : tout rattachement de contact sur un projet de VENTE cree apres
-- la 038 violait `project_contacts_opportunity_id_fkey` (l'id n'existe pas dans
-- `legacy_opportunities`). L'insert echouait silencieusement cote API, d'ou des
-- fiches projet sans contact rattache.
--
-- Correction : les deux FK pointent desormais sur `projects(id)`.
-- Elles sont creees NOT VALID pour ne pas casser les lignes historiques qui
-- referencent des enregistrements legacy jamais repris dans `projects`.
-- Les nouvelles lignes, elles, sont bien controlees.

ALTER TABLE public.project_contacts
  DROP CONSTRAINT IF EXISTS project_contacts_opportunity_id_fkey;

ALTER TABLE public.project_contacts
  DROP CONSTRAINT IF EXISTS project_contacts_buyer_criteria_id_fkey;

ALTER TABLE public.project_contacts
  ADD CONSTRAINT project_contacts_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.project_contacts
  ADD CONSTRAINT project_contacts_buyer_criteria_id_fkey
  FOREIGN KEY (buyer_criteria_id) REFERENCES public.projects(id) ON DELETE CASCADE
  NOT VALID;

-- Un contact ne peut etre rattache qu'une fois au meme projet.
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_contacts_unique_opp
  ON public.project_contacts (opportunity_id, contact_id)
  WHERE opportunity_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_contacts_unique_buyer
  ON public.project_contacts (buyer_criteria_id, contact_id)
  WHERE buyer_criteria_id IS NOT NULL;
