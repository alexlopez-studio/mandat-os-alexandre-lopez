import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { upsertCrmProspect } from '@/lib/leads-crm'

export type PlayiadLeadPayload = {
  playiad_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  source?: string
  property_ref?: string
  property_title?: string
  city?: string
  property_type?: string
  budget_max?: number
  message?: string
}

function parseText(val: unknown): string | null {
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  return trimmed || null
}

function parseNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const num = Number(val)
  return Number.isFinite(num) ? num : null
}

export async function GET(_req: NextRequest) {
  try {
    const { data: events, error } = await supabaseAdmin
      .from('lead_events')
      .select('id, lead_id, payload, created_at')
      .eq('kind', 'system' as never)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('[API /integrations/playiad/sync] GET error:', error)
      return NextResponse.json({ error: 'Erreur lecture historique' }, { status: 500 })
    }

    const playiadEvents = (events || []).filter((e: any) => e.payload?.source === 'Playiad')

    return NextResponse.json({ success: true, history: playiadEvents })
  } catch (e) {
    console.error('[API /integrations/playiad/sync] GET exception:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const leadsRaw = Array.isArray(body.leads) ? body.leads : [body]

    if (leadsRaw.length === 0) {
      return NextResponse.json({ error: 'Aucun lead transmis' }, { status: 400 })
    }

    // 1. Récupérer les ID Playiad déjà enregistrés pour l'idempotence
    const { data: existingEvents } = await supabaseAdmin
      .from('lead_events')
      .select('payload')
      .eq('kind', 'system' as never)

    const processedPlayiadIds = new Set<string>()
    existingEvents?.forEach((row: any) => {
      if (row.payload?.playiad_id) {
        processedPlayiadIds.add(String(row.payload.playiad_id))
      }
    })

    let createdCount = 0
    let skippedCount = 0
    let errorCount = 0
    const results: Array<{ playiad_id?: string; name?: string; status: string; buyer_id?: string }> = []

    for (const leadItem of leadsRaw) {
      const playiadId = parseText(leadItem.playiad_id)
      const firstName = parseText(leadItem.first_name)
      const lastName = parseText(leadItem.last_name)
      const email = parseText(leadItem.email)?.toLowerCase() ?? null
      const phone = parseText(leadItem.phone)
      const source = parseText(leadItem.source) || 'Playiad'
      const propertyRef = parseText(leadItem.property_ref)
      const propertyTitle = parseText(leadItem.property_title)
      const propertyType = parseText(leadItem.property_type)
      const budgetMax = parseNumber(leadItem.budget_max)
      const message = parseText(leadItem.message)

      if (playiadId && processedPlayiadIds.has(playiadId)) {
        skippedCount += 1
        results.push({ playiad_id: playiadId, status: 'already_processed' })
        continue
      }

      if (!email && !phone && !firstName && !lastName) {
        errorCount += 1
        results.push({ playiad_id: playiadId || undefined, status: 'invalid_data' })
        continue
      }

      try {
        // A. Insérer ou récupérer dans `contacts` (Annuaire principal)
        let contactId: string | null = null
        if (email) {
          const { data: existingC } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('email', email)
            .maybeSingle()
          if (existingC?.id) contactId = existingC.id
        }
        if (!contactId && phone) {
          const { data: existingP } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('phone', phone)
            .maybeSingle()
          if (existingP?.id) contactId = existingP.id
        }

        if (!contactId) {
          const { data: newC, error: cErr } = await supabaseAdmin
            .from('contacts')
            .insert({
              first_name: firstName || 'Acquéreur',
              last_name: lastName || 'Playiad',
              email,
              phone,
              source,
              types: ['acquereur'],
            })
            .select('id')
            .single()

          if (!cErr && newC) {
            contactId = newC.id
          }
        }

        // B. Upsert dans `prospects` pour la gestion CRM
        const prospect = await upsertCrmProspect({
          email,
          firstName: firstName || 'Acquéreur',
          lastName: lastName || 'Playiad',
          phone,
        }).catch(() => null)

        // C. Créer le Projet d'Achat (`buyer_criteria`)
        const criteresList = [`Source: ${source}`]
        if (propertyRef) criteresList.push(`Ref: ${propertyRef}`)
        if (propertyTitle) criteresList.push(`Bien: ${propertyTitle}`)
        if (message) criteresList.push(`Note: ${message}`)

        const { data: buyer, error: buyerErr } = await supabaseAdmin
          .from('buyer_criteria')
          .insert({
            prospect_id: prospect?.id || contactId || null,
            type_bien: propertyType,
            budget_max: budgetMax,
            criteres: criteresList,
            active: true,
            stage: 'Nouveau contact',
            next_action: `Qualifier la demande Playiad (${propertyTitle || propertyRef || 'Acquéreur'})`,
          })
          .select('*')
          .single()

        if (buyerErr || !buyer) {
          throw new Error(`Création projet acquéreur impossible: ${buyerErr?.message || 'Erreur'}`)
        }

        // D. Jointure `project_contacts`
        if (contactId) {
          await supabaseAdmin.from('project_contacts').insert({
            contact_id: contactId,
            buyer_criteria_id: buyer.id,
            role: 'Acquéreur principal',
          })
        }

        // E. Event d'idempotence dans `lead_events`
        await supabaseAdmin.from('lead_events').insert({
          lead_id: buyer.id,
          kind: 'system' as never,
          payload: {
            source: 'Playiad',
            playiad_id: playiadId || buyer.id,
            contact_id: contactId,
            property_ref: propertyRef,
            property_title: propertyTitle,
          },
          created_by: 'system',
        } as never)

        createdCount += 1
        results.push({
          playiad_id: playiadId || buyer.id,
          name: [firstName, lastName].filter(Boolean).join(' ') || 'Acquéreur',
          status: 'created',
          buyer_id: buyer.id,
        })
      } catch (itemErr) {
        errorCount += 1
        results.push({
          playiad_id: playiadId || undefined,
          status: 'error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      total: leadsRaw.length,
      createdCount,
      skippedCount,
      errorCount,
      results,
    })
  } catch (e) {
    console.error('[API /integrations/playiad/sync] POST exception:', e)
    return NextResponse.json({ error: 'Erreur serveur lors de la synchronisation Playiad' }, { status: 500 })
  }
}
