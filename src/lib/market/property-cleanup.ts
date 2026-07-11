import { supabaseAdmin } from '@/lib/supabase'

export type PropertyPurgeResult = {
  deletedProperties: number
  error?: string
}

// Une table de dépendance peut ne pas exister sur tous les environnements (ex. match_results
// absent en local). Dans ce cas il n'y a rien à nettoyer : on ignore l'erreur au lieu d'avorter.
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST205' || error.code === '42P01') return true
  return /Could not find the table|does not exist/i.test(error.message ?? '')
}

export async function purgeMarketPropertiesByIds(ids: string[]): Promise<PropertyPurgeResult> {
  const propertyIds = [...new Set(ids)].filter(Boolean)
  if (propertyIds.length === 0) return { deletedProperties: 0 }

  const cleanupSteps = [
    () => supabaseAdmin.from('property_tags').delete().in('market_property_id', propertyIds),
    () => supabaseAdmin.from('property_price_history').delete().in('market_property_id', propertyIds),
    () => supabaseAdmin.from('notifications').delete().in('market_property_id', propertyIds),
    () => supabaseAdmin.from('property_notes').delete().in('market_property_id', propertyIds),
    () => supabaseAdmin.from('opportunities').update({ market_property_id: null }).in('market_property_id', propertyIds),
    () => supabaseAdmin.from('match_results').delete().in('property_id', propertyIds),
  ]

  for (const step of cleanupSteps) {
    const { error } = await step()
    if (error && !isMissingTableError(error)) {
      return { deletedProperties: 0, error: error.message }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('market_properties')
    .delete()
    .in('id', propertyIds)
    .select('id')

  if (error) return { deletedProperties: 0, error: error.message }

  return { deletedProperties: data?.length ?? 0 }
}

export async function purgeMarketPropertiesByZipcode(zipcode: string): Promise<PropertyPurgeResult> {
  const { data, error } = await supabaseAdmin
    .from('market_properties')
    .select('id')
    .eq('zipcode', zipcode)

  if (error) return { deletedProperties: 0, error: error.message }

  return purgeMarketPropertiesByIds((data ?? []).map((row) => row.id))
}
