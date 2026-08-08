import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params
    const contactId = params.id

    // 1. Fetch Contact Info
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      console.error('[API /market/contacts/[id]] Contact not found:', contactError)
      return NextResponse.json({ error: 'Contact introuvable' }, { status: 404 })
    }

    // 2. Fetch linked projects (Opportunities and Buyer Criteria)
    const { data: projectLinks, error: linksError } = await supabaseAdmin
      .from('project_contacts')
      .select('opportunity_id, buyer_criteria_id')
      .eq('contact_id', contactId)

    if (linksError) {
      console.error('[API /market/contacts/[id]] Failed to fetch project links:', linksError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des projets' }, { status: 500 })
    }

    const opportunityIds = Array.from(new Set(projectLinks.map(l => l.opportunity_id).filter(Boolean) as string[]))
    const buyerCriteriaIds = Array.from(new Set(projectLinks.map(l => l.buyer_criteria_id).filter(Boolean) as string[]))

    // 3. Fetch Opportunities details
    let opportunities: any[] = []
    if (opportunityIds.length > 0) {
      const { data: opps } = await supabaseAdmin
        .from('opportunities')
        .select('id, title, stage, property_city, property_type, estimated_price_min, estimated_price_max, created_at')
        .in('id', opportunityIds)
      
      if (opps) opportunities = opps
    }

    // 4. Fetch Buyer Criteria details (and their leads)
    let buyerCriteria: any[] = []
    let leadIds: string[] = []
    if (buyerCriteriaIds.length > 0) {
      const { data: bc } = await supabaseAdmin
        .from('buyer_criteria')
        .select('id, lead_id, type_bien, communes, budget_max, stage, active, created_at')
        .in('id', buyerCriteriaIds)
      
      if (bc) {
        buyerCriteria = bc
        leadIds = Array.from(new Set(bc.map(b => b.lead_id).filter(Boolean) as string[]))
      }
    }

    // 5. Fetch Global History (Activities)
    // We want activities where contact_id = contactId OR opportunity_id IN opportunityIds OR lead_id IN leadIds
    const orConditions: string[] = [`contact_id.eq.${contactId}`]
    if (opportunityIds.length > 0) {
      orConditions.push(`opportunity_id.in.(${opportunityIds.join(',')})`)
    }
    if (leadIds.length > 0) {
      orConditions.push(`lead_id.in.(${leadIds.join(',')})`)
    }

    const { data: activities, error: actError } = await supabaseAdmin
      .from('activities')
      .select('*')
      .or(orConditions.join(','))
      .order('occurred_at', { ascending: false })

    if (actError) {
      console.error('[API /market/contacts/[id]] Failed to fetch activities:', actError)
      // Non-fatal, we can just return empty activities
    }

    return NextResponse.json({
      contact,
      opportunities,
      buyerCriteria,
      activities: activities || []
    }, { status: 200 })
  } catch (error) {
    console.error('[API /market/contacts/[id]] error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
