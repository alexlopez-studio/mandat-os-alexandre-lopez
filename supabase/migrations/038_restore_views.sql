-- ==============================================================================
-- 038_restore_views.sql
-- Restauration temporaire des vues de compatibilité (opportunités et buyer_criteria)
-- pour réparer l'interface qui n'a pas encore migré vers le modèle "Projet" unifié.
-- ==============================================================================

-- 1. Create views mapping strictly to the legacy tables
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

-- 2. Create INSTEAD OF triggers for opportunities
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


-- 3. Create INSTEAD OF triggers for buyer_criteria
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
