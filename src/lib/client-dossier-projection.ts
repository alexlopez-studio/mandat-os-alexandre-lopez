import type { Database, Json } from '@/types/supabase'

type ClientDossierProjectionFields = Pick<
  Database['public']['Tables']['client_dossiers']['Row'],
  'property_snapshot' | 'professional_opinion'
>

type OpportunityProjectionFields = Pick<
  Database['public']['Tables']['opportunities']['Row'],
  'property_snapshot' | 'professional_opinion'
>

export function projectClientDossierFromOpportunity<T extends ClientDossierProjectionFields>(
  dossier: T,
  opportunity: OpportunityProjectionFields | null | undefined,
): T {
  if (!opportunity) return dossier

  return {
    ...dossier,
    property_snapshot: mergeJsonObjects(dossier.property_snapshot, opportunity.property_snapshot),
    professional_opinion: mergeJsonObjects(dossier.professional_opinion, opportunity.professional_opinion),
  }
}

function mergeJsonObjects(base: Json | null | undefined, overlay: Json | null | undefined): Json {
  return {
    ...asObject(base),
    ...asObject(overlay),
  }
}

function asObject(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
