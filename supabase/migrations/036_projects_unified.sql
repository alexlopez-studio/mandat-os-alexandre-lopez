-- ==============================================================================
-- 036_projects_unified.sql
-- Lot 4 : Le projet unifié (Point de non-retour)
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE public.project_kind AS ENUM ('vente', 'achat');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Create the new projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.project_kind NOT NULL,
  
  -- Common fields
  title text NOT NULL,
  stage text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  next_action text,
  due_date timestamptz,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  follow_up_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  
  -- Vente specific (legacy)
  market_property_id uuid REFERENCES public.market_properties(id) ON DELETE SET NULL,
  description text,
  signal_type text,
  note text,
  seller_name text,
  seller_phone text,
  seller_email text,
  source_channel text,
  property_address text,
  property_city text,
  property_zipcode text,
  property_type text,
  property_surface numeric,
  property_land_surface numeric,
  property_rooms numeric,
  estimated_price_min numeric,
  estimated_price_max numeric,
  selling_timeline text,
  pre_estimation_done_at timestamptz,
  visit_at timestamptz,
  report_delivered_at timestamptz,
  property_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  professional_opinion jsonb NOT NULL DEFAULT '{}'::jsonb,
  internal_intel jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_from text,

  -- Achat specific (legacy)
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  type_bien text,
  communes text[],
  budget_max numeric,
  surface_min numeric,
  pieces_min numeric,
  criteres text[],
  active boolean DEFAULT true,
  matched_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_projects_kind ON public.projects(kind);
CREATE INDEX idx_projects_stage ON public.projects(stage);
CREATE INDEX idx_projects_lead_id ON public.projects(lead_id);
CREATE INDEX idx_projects_prospect_id ON public.projects(prospect_id);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Projects all for auth" ON public.projects FOR ALL USING (auth.role() = 'authenticated');

-- Updated at trigger
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Migrate Data
-- Migrate opportunities
INSERT INTO public.projects (
  id, kind, market_property_id, lead_id, title, description, stage, priority,
  signal_type, next_action, due_date, note, seller_name, seller_phone, seller_email,
  source_channel, property_address, property_city, property_zipcode, property_type,
  property_surface, property_land_surface, property_rooms, estimated_price_min,
  estimated_price_max, selling_timeline, pre_estimation_done_at, visit_at,
  report_delivered_at, follow_up_at, property_snapshot, professional_opinion,
  internal_intel, created_from, is_test, created_at, updated_at
)
SELECT 
  id, 'vente'::public.project_kind, market_property_id, lead_id, title, description, stage, priority,
  signal_type, next_action, due_date, note, seller_name, seller_phone, seller_email,
  source_channel, property_address, property_city, property_zipcode, property_type,
  property_surface, property_land_surface, property_rooms, estimated_price_min,
  estimated_price_max, selling_timeline, pre_estimation_done_at, visit_at,
  report_delivered_at, follow_up_at, property_snapshot, professional_opinion,
  internal_intel, created_from, is_test, created_at, updated_at
FROM public.opportunities;

-- Migrate buyer_criteria
INSERT INTO public.projects (
  id, kind, lead_id, prospect_id, title, stage, type_bien, communes, budget_max,
  surface_min, pieces_min, criteres, active, next_action, due_date, matched_at,
  created_at, updated_at
)
SELECT 
  id, 'achat'::public.project_kind, lead_id::uuid, prospect_id::uuid, 
  'Recherche acquéreur', -- fallback title since buyer_criteria has no title
  stage, type_bien, communes, budget_max,
  surface_min, pieces_min, criteres, active, next_action, due_date, matched_at,
  created_at, updated_at
FROM public.buyer_criteria;

-- 3. Rename old tables to free the names for the views
ALTER TABLE public.opportunities RENAME TO legacy_opportunities;
ALTER TABLE public.buyer_criteria RENAME TO legacy_buyer_criteria;

-- 4. Create views mapping strictly to the legacy tables
-- Vente (Opportunities)
CREATE OR REPLACE VIEW public.opportunities AS
SELECT 
  id, market_property_id, lead_id, title, description, stage, priority,
  signal_type, next_action, due_date, note, seller_name, seller_phone, seller_email,
  source_channel, property_address, property_city, property_zipcode, property_type,
  property_surface, property_land_surface, property_rooms, estimated_price_min,
  estimated_price_max, selling_timeline, pre_estimation_done_at, visit_at,
  report_delivered_at, follow_up_at, property_snapshot, professional_opinion,
  internal_intel, created_from, is_test, created_at, updated_at
FROM public.projects
WHERE kind = 'vente';

-- Achat (Buyer Criteria)
CREATE OR REPLACE VIEW public.buyer_criteria AS
SELECT 
  id, lead_id, prospect_id, type_bien, communes, budget_max, surface_min, pieces_min,
  criteres, active, stage, next_action, due_date, matched_at, created_at, updated_at
FROM public.projects
WHERE kind = 'achat';

-- 5. Create INSTEAD OF triggers for opportunities
CREATE OR REPLACE FUNCTION public.opportunities_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.projects (
    id, kind, market_property_id, lead_id, title, description, stage, priority,
    signal_type, next_action, due_date, note, seller_name, seller_phone, seller_email,
    source_channel, property_address, property_city, property_zipcode, property_type,
    property_surface, property_land_surface, property_rooms, estimated_price_min,
    estimated_price_max, selling_timeline, pre_estimation_done_at, visit_at,
    report_delivered_at, follow_up_at, property_snapshot, professional_opinion,
    internal_intel, created_from, is_test, created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), 'vente'::public.project_kind, NEW.market_property_id, NEW.lead_id, NEW.title, NEW.description, NEW.stage, NEW.priority,
    NEW.signal_type, NEW.next_action, NEW.due_date, NEW.note, NEW.seller_name, NEW.seller_phone, NEW.seller_email,
    NEW.source_channel, NEW.property_address, NEW.property_city, NEW.property_zipcode, NEW.property_type,
    NEW.property_surface, NEW.property_land_surface, NEW.property_rooms, NEW.estimated_price_min,
    NEW.estimated_price_max, NEW.selling_timeline, NEW.pre_estimation_done_at, NEW.visit_at,
    NEW.report_delivered_at, NEW.follow_up_at, COALESCE(NEW.property_snapshot, '{}'::jsonb), COALESCE(NEW.professional_opinion, '{}'::jsonb),
    COALESCE(NEW.internal_intel, '{}'::jsonb), NEW.created_from, COALESCE(NEW.is_test, false), COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
  ) RETURNING id INTO NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instead_of_insert_opportunities
INSTEAD OF INSERT ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.opportunities_insert_trigger();

CREATE OR REPLACE FUNCTION public.opportunities_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.projects SET
    market_property_id = NEW.market_property_id,
    lead_id = NEW.lead_id,
    title = NEW.title,
    description = NEW.description,
    stage = NEW.stage,
    priority = NEW.priority,
    signal_type = NEW.signal_type,
    next_action = NEW.next_action,
    due_date = NEW.due_date,
    note = NEW.note,
    seller_name = NEW.seller_name,
    seller_phone = NEW.seller_phone,
    seller_email = NEW.seller_email,
    source_channel = NEW.source_channel,
    property_address = NEW.property_address,
    property_city = NEW.property_city,
    property_zipcode = NEW.property_zipcode,
    property_type = NEW.property_type,
    property_surface = NEW.property_surface,
    property_land_surface = NEW.property_land_surface,
    property_rooms = NEW.property_rooms,
    estimated_price_min = NEW.estimated_price_min,
    estimated_price_max = NEW.estimated_price_max,
    selling_timeline = NEW.selling_timeline,
    pre_estimation_done_at = NEW.pre_estimation_done_at,
    visit_at = NEW.visit_at,
    report_delivered_at = NEW.report_delivered_at,
    follow_up_at = NEW.follow_up_at,
    property_snapshot = NEW.property_snapshot,
    professional_opinion = NEW.professional_opinion,
    internal_intel = NEW.internal_intel,
    created_from = NEW.created_from,
    is_test = NEW.is_test,
    updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instead_of_update_opportunities
INSTEAD OF UPDATE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.opportunities_update_trigger();

CREATE OR REPLACE FUNCTION public.opportunities_delete_trigger()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.projects WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instead_of_delete_opportunities
INSTEAD OF DELETE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.opportunities_delete_trigger();


-- 6. Create INSTEAD OF triggers for buyer_criteria
CREATE OR REPLACE FUNCTION public.buyer_criteria_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.projects (
    id, kind, title, lead_id, prospect_id, type_bien, communes, budget_max, surface_min, pieces_min,
    criteres, active, stage, next_action, due_date, matched_at, created_at, updated_at
  ) VALUES (
    COALESCE(NEW.id, gen_random_uuid()), 'achat'::public.project_kind, 'Recherche acquéreur', NEW.lead_id, NEW.prospect_id, NEW.type_bien, NEW.communes, NEW.budget_max, NEW.surface_min, NEW.pieces_min,
    NEW.criteres, COALESCE(NEW.active, true), NEW.stage, NEW.next_action, NEW.due_date, NEW.matched_at, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
  ) RETURNING id INTO NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instead_of_insert_buyer_criteria
INSTEAD OF INSERT ON public.buyer_criteria
FOR EACH ROW EXECUTE FUNCTION public.buyer_criteria_insert_trigger();

CREATE OR REPLACE FUNCTION public.buyer_criteria_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.projects SET
    lead_id = NEW.lead_id,
    prospect_id = NEW.prospect_id,
    type_bien = NEW.type_bien,
    communes = NEW.communes,
    budget_max = NEW.budget_max,
    surface_min = NEW.surface_min,
    pieces_min = NEW.pieces_min,
    criteres = NEW.criteres,
    active = NEW.active,
    stage = NEW.stage,
    next_action = NEW.next_action,
    due_date = NEW.due_date,
    matched_at = NEW.matched_at,
    updated_at = now()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instead_of_update_buyer_criteria
INSTEAD OF UPDATE ON public.buyer_criteria
FOR EACH ROW EXECUTE FUNCTION public.buyer_criteria_update_trigger();

CREATE OR REPLACE FUNCTION public.buyer_criteria_delete_trigger()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.projects WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instead_of_delete_buyer_criteria
INSTEAD OF DELETE ON public.buyer_criteria
FOR EACH ROW EXECUTE FUNCTION public.buyer_criteria_delete_trigger();
