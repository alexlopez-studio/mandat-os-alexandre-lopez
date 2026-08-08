-- ==============================================================================
-- 041 : toutes les FK `opportunity_id` pointent sur projects, plus sur legacy
-- ==============================================================================
--
-- Meme cause que la 040, generalisee. Depuis les migrations 036/038 les projets
-- vivent dans `projects` et `opportunities` n'est plus qu'une vue. Or huit
-- tables referencaient encore `legacy_opportunities(id)` : toute ecriture liee a
-- un projet cree apres la 038 violait la FK.
--
-- Symptomes constates :
--   * `activities`   -> impossible d'ajouter note / tache / appel / RDV dans le
--                       journal d'activite (la popup ne se ferme jamais) ;
--   * `project_contacts` (corrige en 040) -> contacts non rattaches ;
--   * les autres tables echouaient de la meme facon des qu'elles etaient
--     sollicitees sur un projet recent.
--
-- Les contraintes sont recreees NOT VALID : des lignes historiques referencent
-- des enregistrements `legacy_opportunities` jamais repris dans `projects`
-- (6 dans `opportunity_events`, 8 dans `activities`). Elles sont conservees en
-- l'etat ; seules les nouvelles ecritures sont controlees.

-- ON DELETE CASCADE ------------------------------------------------------------

ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_opportunity_id_fkey;
ALTER TABLE public.activities
  ADD CONSTRAINT activities_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.opportunity_events
  DROP CONSTRAINT IF EXISTS opportunity_events_opportunity_id_fkey;
ALTER TABLE public.opportunity_events
  ADD CONSTRAINT opportunity_events_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.opportunity_audience_snapshots
  DROP CONSTRAINT IF EXISTS opportunity_audience_snapshots_opportunity_id_fkey;
ALTER TABLE public.opportunity_audience_snapshots
  ADD CONSTRAINT opportunity_audience_snapshots_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.opportunity_meeting_links
  DROP CONSTRAINT IF EXISTS opportunity_meeting_links_opportunity_id_fkey;
ALTER TABLE public.opportunity_meeting_links
  ADD CONSTRAINT opportunity_meeting_links_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.property_notes
  DROP CONSTRAINT IF EXISTS property_notes_opportunity_id_fkey;
ALTER TABLE public.property_notes
  ADD CONSTRAINT property_notes_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE CASCADE
  NOT VALID;

-- ON DELETE SET NULL -----------------------------------------------------------

ALTER TABLE public.client_dossiers
  DROP CONSTRAINT IF EXISTS client_dossiers_opportunity_id_fkey;
ALTER TABLE public.client_dossiers
  ADD CONSTRAINT client_dossiers_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE SET NULL
  NOT VALID;

ALTER TABLE public.estimation_imports
  DROP CONSTRAINT IF EXISTS estimation_imports_opportunity_id_fkey;
ALTER TABLE public.estimation_imports
  ADD CONSTRAINT estimation_imports_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE SET NULL
  NOT VALID;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_opportunity_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_opportunity_id_fkey
  FOREIGN KEY (opportunity_id) REFERENCES public.projects(id) ON DELETE SET NULL
  NOT VALID;
