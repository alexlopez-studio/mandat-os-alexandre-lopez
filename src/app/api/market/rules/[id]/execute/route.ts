import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const LEGACY_OPPORTUNITY_STAGE_MAP: Record<string, string> = {
  'À qualifier': 'Nouveau contact',
  'À analyser': 'Pré-estimation',
  'À contacter': 'Nouveau contact',
  Contacté: 'Pré-estimation',
  'Rendez-vous à préparer': 'RDV / Visite',
  'En suivi': 'Suivi moyen terme',
  'Mandat potentiel': 'Décision vendeur',
  Converti: 'Mandat signé',
  Écarté: 'Perdu / Écarté',
}

function normalizeOpportunityStage(stage: string | undefined) {
  return stage ? LEGACY_OPPORTUNITY_STAGE_MAP[stage] ?? stage : 'Nouveau contact'
}

/**
 * POST /api/market/rules/[id]/execute
 * Exécute manuellement une règle de gestion.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 1. Récupérer la règle
    const { data: rule, error: ruleError } = await supabaseAdmin
      .from('management_rules')
      .select('*')
      .eq('id', id)
      .single()

    if (ruleError || !rule) {
      return NextResponse.json({ error: 'Règle introuvable' }, { status: 404 })
    }

    // 2. Récupérer les biens (optionnellement filtrés par zipcode)
    const body = await req.json().catch(() => ({}))
    const zipcode: string | undefined = body.zipcode

    let query = supabaseAdmin.from('market_properties').select('*')

    if (zipcode) {
      query = query.eq('zipcode', zipcode)
    }

    const { data: properties, error: propError } = await query

    if (propError) {
      return NextResponse.json({ error: 'Erreur récupération biens' }, { status: 500 })
    }

    const propsToCheck = properties ?? []

    // 3. Évaluer la règle sur chaque bien
    const conditions = rule.conditions_json as { all?: Array<{ field: string; operator: string; value: unknown }> } | null
    const actions = rule.actions_json as { actions?: Array<{ type: string; value?: string; stage?: string; priority?: string }> } | null

    let matchedCount = 0
    let actionCount = 0

    if (!conditions?.all || !actions?.actions) {
      return NextResponse.json({
        success: true,
        matched: 0,
        actions: 0,
        message: 'La règle n\'a pas de conditions ou d\'actions définies',
      })
    }

    for (const property of propsToCheck) {
      const matches = conditions.all.every(cond =>
        evaluateCondition(property as unknown as Record<string, unknown>, cond)
      )
      if (!matches) continue

      matchedCount++

      for (const action of actions.actions) {
        switch (action.type) {
          case 'add_tag':
            await supabaseAdmin.from('property_tags').upsert(
              {
                market_property_id: property.id,
                tag: action.value ?? 'Signal',
                source: 'rule',
                rule_id: rule.id,
              } as never,
              { onConflict: 'market_property_id,tag' as never }
            )
            actionCount++
            break

          case 'create_notification':
            await supabaseAdmin.from('notifications').insert({
              type: 'rule_triggered',
              title: `Règle : ${rule.name}`,
              message: `${property.title ?? 'Bien'} à ${property.city ?? property.zipcode} — ${action.value ?? ''}`,
              priority: action.priority ?? 'medium',
              market_property_id: property.id,
              rule_id: rule.id,
            } as never)
            actionCount++
            break

          case 'create_opportunity':
            await supabaseAdmin.from('opportunities').insert({
              market_property_id: property.id,
              title: `${property.title ?? 'Bien'} — ${rule.name}`,
              description: `Créé automatiquement par la règle "${rule.name}"`,
              stage: normalizeOpportunityStage(action.stage),
              priority: action.priority ?? 'medium',
              signal_type: rule.trigger_type,
              source_channel: 'annonce',
              property_city: property.city,
              property_zipcode: property.zipcode,
              property_type: property.property_type,
              estimated_price_min: property.price,
              estimated_price_max: property.price,
              created_from: 'rule',
            } as never)
            actionCount++
            break
        }
      }
    }

    // 4. Mettre à jour last_run_at
    await supabaseAdmin
      .from('management_rules')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', rule.id)

    return NextResponse.json({
      success: true,
      rule_id: rule.id,
      rule_name: rule.name,
      properties_checked: propsToCheck.length,
      matched: matchedCount,
      actions_executed: actionCount,
    })
  } catch (e) {
    console.error('[API /market/rules/execute]', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ── Évaluateur de condition ──────────────────────────────────

function evaluateCondition(
  property: Record<string, unknown>,
  condition: { field: string; operator: string; value: unknown },
): boolean {
  const { field, operator, value } = condition
  const fieldValue = property[field]

  switch (operator) {
    case 'equals':
      return fieldValue === value
    case 'not_equals':
      return fieldValue !== value
    case 'gt':
      return Number(fieldValue) > Number(value)
    case 'gte':
      return Number(fieldValue) >= Number(value)
    case 'lt':
      return Number(fieldValue) < Number(value)
    case 'lte':
      return Number(fieldValue) <= Number(value)
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(value).toLowerCase())
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue)
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return Number(fieldValue) >= Number(value[0]) && Number(fieldValue) <= Number(value[1])
      }
      return false
    default:
      return false
  }
}
