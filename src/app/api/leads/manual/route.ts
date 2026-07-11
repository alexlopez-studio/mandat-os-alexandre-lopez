import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createLead } from '@/lib/leads-repo'
import { ensureSellerOpportunityForLead } from '@/lib/market/seller-opportunity'
import {
  asNumber,
  asRecord,
  asText,
  cleanJson,
  resolveCommune,
  upsertCrmProspect,
  upsertSellerPropertyForLead,
} from '@/lib/leads-crm'

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical'])
const VALID_SOURCES = new Set([
  'flyer',
  'porte_a_porte',
  'appel_entrant',
  'prospection',
  'recommandation',
  'estimation_site',
  'annonce_particulier',
  'annonce_agence',
  'autre',
])

export async function POST(req: NextRequest) {
  try {
    const body = asRecord(await req.json())
    const sellerName = asText(body.seller_name) ?? asText(body.name)
    const firstName = asText(body.first_name) ?? sellerName ?? ''
    const lastName = asText(body.last_name) ?? ''
    const email = asText(body.email)
    const phone = asText(body.phone) ?? asText(body.telephone)
    const commune = resolveCommune(body)
    const note = asText(body.note)
    const sourceChannel = VALID_SOURCES.has(asText(body.source_channel) ?? '')
      ? asText(body.source_channel)
      : 'prospection'
    const priority = VALID_PRIORITIES.has(asText(body.priority) ?? '')
      ? asText(body.priority)
      : 'medium'

    if (!sellerName && !email && !phone) {
      return NextResponse.json(
        { success: false, error: 'Ajoute au moins un nom, un téléphone ou un email' },
        { status: 400 },
      )
    }

    const formData = {
      seller_name: sellerName,
      phone,
      email,
      source_channel: sourceChannel,
      commune,
      adresse: asText(body.adresse) ?? asText(body.property_address),
      type_bien: asText(body.type_bien) ?? asText(body.property_type),
      surface: asNumber(body.surface) ?? asNumber(body.property_surface),
      surface_terrain: asNumber(body.surface_terrain) ?? asNumber(body.property_land_surface),
      nb_pieces: asNumber(body.nb_pieces) ?? asNumber(body.property_rooms),
      delai: asText(body.delai) ?? asText(body.selling_timeline),
      prix_estime: asNumber(body.prix_estime) ?? asNumber(body.estimated_price),
    }

    const prospect = await upsertCrmProspect({
      email,
      firstName,
      lastName,
      phone,
    })

    const lead = await createLead({
      prospectId: prospect.id,
      tool: 'vendre',
      formData,
      results: {},
      commune,
      sourceChannel,
      priority,
      nextAction: asText(body.next_action),
      dueDate: asText(body.due_date),
      followUpAt: asText(body.follow_up_at),
    })

    const sellerProperty = await upsertSellerPropertyForLead({
      leadId: lead.id,
      prospectId: prospect.id,
      data: formData,
    })

    const events = [
      {
        lead_id: lead.id,
        kind: 'system',
        payload: cleanJson({ text: 'Lead vendeur créé manuellement', source_channel: sourceChannel }),
        created_by: 'admin',
      },
    ]
    if (note) {
      events.push({
        lead_id: lead.id,
        kind: 'note',
        payload: cleanJson({ text: note }),
        created_by: 'admin',
      })
    }

    const { error: eventError } = await supabaseAdmin.from('lead_events').insert(events as never)
    if (eventError) console.error('[API /leads/manual] events:', eventError)

    const sellerOpportunity = await ensureSellerOpportunityForLead(lead.id)

    return NextResponse.json({
      success: true,
      data: {
        lead,
        prospect,
        seller_property: sellerProperty,
        opportunity: sellerOpportunity?.opportunity ?? null,
      },
    }, { status: 201 })
  } catch (err) {
    console.error('[API /leads/manual]', err)
    return NextResponse.json(
      { success: false, error: 'Erreur création lead manuel' },
      { status: 500 },
    )
  }
}
