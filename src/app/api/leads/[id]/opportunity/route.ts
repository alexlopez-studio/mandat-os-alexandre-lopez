import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { asRecord, asText } from '@/lib/leads-crm'
import { NEW_CONTACT_STAGE } from '@/lib/market/seller-opportunity'

type RouteContext = { params: Promise<{ id: string }> }

function formatTitle(lead: {
  commune: string | null
  prospect?: { first_name?: string | null; last_name?: string | null } | null
}, sellerProperty: { type_bien?: string | null } | null) {
  const name = [lead.prospect?.first_name, lead.prospect?.last_name].filter(Boolean).join(' ').trim()
  const property = [sellerProperty?.type_bien, lead.commune].filter(Boolean).join(' ')
  if (name && property) return `${name} - ${property}`
  if (name) return `${name} - projet vendeur`
  if (property) return `Vendeur - ${property}`
  return 'Opportunité vendeur'
}

export async function POST(_req: Request, context: RouteContext) {
  try {
    const { id } = await context.params

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingError) {
      console.error('[API /leads/[id]/opportunity] existing:', existingError)
      return NextResponse.json({ success: false, error: 'Erreur lecture opportunité' }, { status: 500 })
    }

    if (existing?.[0]) {
      return NextResponse.json({ success: true, data: existing[0], existing: true })
    }

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*, prospect:prospects!leads_prospect_id_fkey (*)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (leadError) {
      console.error('[API /leads/[id]/opportunity] lead:', leadError)
      return NextResponse.json({ success: false, error: 'Erreur lecture lead' }, { status: 500 })
    }

    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead introuvable' }, { status: 404 })
    }

    const { data: sellerProperties } = await supabaseAdmin
      .from('seller_properties')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(1)

    const sellerProperty = sellerProperties?.[0] ?? null
    const prospect = lead.prospect as { first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null } | null
    const title = formatTitle(lead as never, sellerProperty)
    const formData = asRecord(lead.form_data)

    const { data: opportunity, error } = await supabaseAdmin
      .from('opportunities')
      .insert({
        lead_id: id,
        title,
        description: asText(formData.note) ?? '',
        stage: NEW_CONTACT_STAGE,
        priority: lead.priority ?? 'medium',
        signal_type: 'manual',
        next_action: lead.next_action ?? 'Préparer la pré-estimation',
        due_date: lead.due_date ?? null,
        follow_up_at: lead.follow_up_at ?? null,
        created_from: 'lead',
        seller_name: [prospect?.first_name, prospect?.last_name].filter(Boolean).join(' ').trim() || null,
        seller_phone: prospect?.phone ?? null,
        seller_email: prospect?.email ?? null,
        source_channel: lead.source_channel ?? 'prospection',
        property_address: sellerProperty?.adresse ?? null,
        property_city: lead.commune ?? null,
        property_type: sellerProperty?.type_bien ?? null,
        property_surface: sellerProperty?.surface ?? null,
        property_land_surface: sellerProperty?.surface_terrain ?? null,
        property_rooms: sellerProperty?.nb_pieces ?? null,
        estimated_price_min: sellerProperty?.prix_estime ?? null,
        estimated_price_max: sellerProperty?.prix_estime ?? null,
        selling_timeline: sellerProperty?.delai ?? null,
      } as never)
      .select('*')
      .single()

    if (error) {
      console.error('[API /leads/[id]/opportunity] insert:', error)
      return NextResponse.json({ success: false, error: 'Erreur création opportunité' }, { status: 500 })
    }

    await supabaseAdmin.from('lead_events').insert({
      lead_id: id,
      kind: 'system',
      payload: { text: 'Opportunité créée depuis le lead', opportunity_id: opportunity.id },
      created_by: 'admin',
    } as never)

    return NextResponse.json({ success: true, data: opportunity, existing: false }, { status: 201 })
  } catch (err) {
    console.error('[API /leads/[id]/opportunity]', err)
    return NextResponse.json({ success: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
