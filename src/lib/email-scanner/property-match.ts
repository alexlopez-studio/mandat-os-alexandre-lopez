import { supabaseAdmin } from '@/lib/supabase'

/**
 * Rattachement d'une demande d'acquéreur à l'un des biens en mandat.
 *
 * « Mes biens » = les projets de vente (`projects` avec `kind = 'vente'`).
 * Trois signaux, du plus fiable au plus faible ; on s'arrête au premier qui
 * tranche. Aucun rapprochement approximatif n'est renvoyé sans dire pourquoi :
 * `reason` s'affiche dans la file de validation, et c'est ce qui permet de
 * corriger un mauvais rattachement d'un coup d'œil plutôt qu'à l'aveugle.
 */

export type PropertyMatch = {
  projectId: string
  reason: string
}

type SaleProject = {
  id: string
  title: string | null
  property_city: string | null
  property_zipcode: string | null
  property_type: string | null
  market_property_id: string | null
}

function normalize(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export async function matchBuyerEmailToProperty(input: {
  propertyReference: string | null
  communes: string[]
  propertyType: string | null
  subject: string
}): Promise<PropertyMatch | null> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('id, title, property_city, property_zipcode, property_type, market_property_id')
    .eq('kind', 'vente')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data?.length) return null
  const projects = data as SaleProject[]

  // 1. Référence d'annonce — le seul signal qui désigne un bien sans ambiguïté.
  const ref = normalize(input.propertyReference)
  if (ref.length >= 4) {
    const byExternalId = await findByExternalId(ref, projects)
    if (byExternalId) return byExternalId

    const byTitle = projects.find((p) => normalize(p.title).includes(ref))
    if (byTitle) {
      return { projectId: byTitle.id, reason: `Référence « ${input.propertyReference} » trouvée dans le titre du mandat` }
    }
  }

  // 2. Commune + type de bien. Les communes viennent de l'extraction IA ; à
  //    défaut on retombe sur l'objet de l'e-mail, où les portails la placent.
  const haystack = normalize([...input.communes, input.subject].join(' '))
  const wantedType = normalize(input.propertyType)

  const cityMatches = projects.filter((p) => {
    const city = normalize(p.property_city)
    return city.length >= 3 && haystack.includes(city)
  })

  if (cityMatches.length === 1) {
    return { projectId: cityMatches[0].id, reason: `Commune « ${cityMatches[0].property_city} » citée dans l'e-mail` }
  }

  if (cityMatches.length > 1 && wantedType) {
    const typed = cityMatches.filter((p) => normalize(p.property_type) === wantedType)
    if (typed.length === 1) {
      return {
        projectId: typed[0].id,
        reason: `Commune « ${typed[0].property_city} » et type « ${input.propertyType} » concordants`,
      }
    }
  }

  // Plusieurs mandats possibles : ne rien affirmer. Un rattachement faux coûte
  // plus cher qu'un rattachement absent, que la validation permet de faire à la main.
  return null
}

async function findByExternalId(ref: string, projects: SaleProject[]): Promise<PropertyMatch | null> {
  const withMarketProperty = projects.filter((p) => p.market_property_id)
  if (!withMarketProperty.length) return null

  const { data, error } = await supabaseAdmin
    .from('market_properties')
    .select('id, external_id')
    .in('id', withMarketProperty.map((p) => p.market_property_id as string))

  if (error || !data?.length) return null

  const hit = (data as { id: string; external_id: string | null }[]).find(
    (row) => row.external_id && normalize(row.external_id) === ref,
  )
  if (!hit) return null

  const project = withMarketProperty.find((p) => p.market_property_id === hit.id)
  return project ? { projectId: project.id, reason: `Référence d'annonce ${hit.external_id} rattachée au mandat` } : null
}
