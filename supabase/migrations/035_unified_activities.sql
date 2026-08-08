-- ==============================================================================
-- 035_unified_activities.sql
-- Lot 2 : Journal d'activité unique.
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE public.activity_type AS ENUM (
    'note',
    'task',
    'call',
    'meeting',
    'email',
    'stage_change',
    'estimation',
    'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  type public.activity_type NOT NULL DEFAULT 'note',
  title text,
  content text,
  due_at timestamptz,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_activity_target CHECK (
    contact_id IS NOT NULL OR opportunity_id IS NOT NULL OR lead_id IS NOT NULL
  )
);

CREATE INDEX idx_activities_contact ON public.activities(contact_id);
CREATE INDEX idx_activities_opp ON public.activities(opportunity_id);
CREATE INDEX idx_activities_lead ON public.activities(lead_id);
CREATE INDEX idx_activities_type ON public.activities(type);
CREATE INDEX idx_activities_due ON public.activities(due_at) WHERE completed_at IS NULL;

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS (temporaire, on autorise tout pour les requêtes authentifiées, l'admin bypass de toute façon)
CREATE POLICY "Activities all for auth" ON public.activities FOR ALL USING (auth.role() = 'authenticated');

-- ETL: Reprise depuis opportunity_events
INSERT INTO public.activities (
  id, opportunity_id, type, title, content, due_at, occurred_at, completed_at, metadata, created_by, created_at, updated_at
)
SELECT 
  id, opportunity_id, type::text::public.activity_type, title, content, due_at, occurred_at, completed_at, metadata, created_by, created_at, updated_at
FROM public.opportunity_events;

-- ETL: Reprise depuis lead_events
-- Note: les lead_events "note" ont type, content, due_date, done dans payload
INSERT INTO public.activities (
  lead_id, type, title, content, due_at, occurred_at, completed_at, metadata, created_by, created_at
)
SELECT
  lead_id,
  CASE
    WHEN kind = 'note' AND payload->>'type' = 'task' THEN 'task'::public.activity_type
    WHEN kind = 'note' THEN 'note'::public.activity_type
    WHEN kind = 'status_change' THEN 'stage_change'::public.activity_type
    ELSE 'system'::public.activity_type
  END as type,
  CASE
    WHEN kind = 'status_change' THEN 'Changement d''étape'
    WHEN kind = 'note' AND payload->>'type' = 'task' THEN 'Tâche'
    WHEN kind = 'note' THEN 'Note'
    ELSE kind::text
  END as title,
  CASE
    WHEN kind = 'status_change' THEN 'De ' || COALESCE(payload->>'from', '') || ' à ' || COALESCE(payload->>'to', '')
    WHEN kind = 'note' THEN payload->>'content'
    ELSE payload::text
  END as content,
  CASE WHEN (payload->>'due_date') IS NOT NULL AND (payload->>'due_date') != '' THEN (payload->>'due_date')::timestamptz ELSE NULL END as due_at,
  created_at as occurred_at,
  CASE 
    WHEN (payload->>'done')::boolean = true THEN CASE WHEN (payload->>'done_at') IS NOT NULL AND (payload->>'done_at') != '' THEN (payload->>'done_at')::timestamptz ELSE created_at END
    ELSE NULL
  END as completed_at,
  payload as metadata,
  created_by,
  created_at
FROM public.lead_events;
