import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/leads/list — Liste paginée/filtrée des leads
 *
 * Query params :
 *   - status    : filtre par statut (ex: "nouveau,contacte")
 *   - tool      : filtre par outil (ex: "vendre,acheter")
 *   - q         : recherche texte (email, nom, prénom)
 *   - source    : filtre source CRM
 *   - priority  : filtre priorité CRM
 *   - from      : date début ISO (created_at >=)
 *   - to        : date fin ISO (created_at <=)
 *   - page      : numéro de page (défaut: 1)
 *   - page_size : taille de page (défaut: 20, max: 100)
 *   - sort_by   : champ de tri (défaut: created_at)
 *   - sort_dir  : asc|desc (défaut: desc)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status')       // "nouveau,contacte"
    const toolFilter = searchParams.get('tool')           // "vendre,acheter"
    const q = searchParams.get('q')                       // recherche texte
    const sourceFilter = searchParams.get('source')
    const priorityFilter = searchParams.get('priority')
    const communeFilter = searchParams.get('commune')
    const dateFrom = searchParams.get('from')             // ISO date
    const dateTo = searchParams.get('to')                 // ISO date
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') ?? '20', 10) || 20))
    const sortBy = searchParams.get('sort_by') ?? 'created_at'
    const sortDir = searchParams.get('sort_dir') === 'asc' ? 'asc' as const : 'desc' as const

    const offset = (page - 1) * pageSize

    // Construire la requête
    let query = supabaseAdmin
        .from('leads')
        .select(
            `
        id,
        tool,
        status,
        form_data,
        commune,
        source_channel,
        priority,
        next_action,
        due_date,
        follow_up_at,
        magic_link_sent_at,
        created_at,
        updated_at,
        prospect:prospects!leads_prospect_id_fkey (
          id,
          email,
          first_name,
          last_name,
          phone
        )
      `,
            { count: 'exact' },
        )
        .is('deleted_at', null)
        .eq('is_test', false)

    // Filtres
    if (statusFilter) {
        const statuses = statusFilter.split(',').map((s) => s.trim()).filter(Boolean)
        if (statuses.length > 0) {
            query = query.in('status', statuses as never)
        }
    }

    if (toolFilter) {
        const tools = toolFilter.split(',').map((t) => t.trim()).filter(Boolean)
        if (tools.length > 0) {
            query = query.in('tool', tools as never)
        }
    }

    if (sourceFilter) {
        const sources = sourceFilter.split(',').map((s) => s.trim()).filter(Boolean)
        if (sources.length > 0) query = query.in('source_channel', sources as never)
    }

    if (priorityFilter) {
        const priorities = priorityFilter.split(',').map((p) => p.trim()).filter(Boolean)
        if (priorities.length > 0) query = query.in('priority', priorities as never)
    }

    if (communeFilter?.trim()) {
        query = query.ilike('commune', `%${communeFilter.trim()}%`)
    }

    if (dateFrom) {
        query = query.gte('created_at', dateFrom)
    }

    if (dateTo) {
        query = query.lte('created_at', dateTo)
    }

    // Recherche texte — on filtre côté serveur par email via prospect join first
    // Puis on complète par une deuxième requête si q est fourni
    let leads: unknown[] = []
    let totalCount = 0

    if (q && q.trim().length > 0) {
        // Recherche par email dans prospects
        const searchTerm = q.trim()
        const { data: matchedProspects } = await supabaseAdmin
            .from('prospects')
            .select('id')
            .or(
                `email.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`,
            )
            .limit(100)

        const prospectIds = matchedProspects?.map((p) => p.id) ?? []

        if (prospectIds.length > 0) {
            query = query.in('prospect_id', prospectIds)
        } else {
            // Aucun prospect trouvé → résultat vide
            return NextResponse.json({
                success: true,
                data: [],
                pagination: { page, pageSize, total: 0, totalPages: 0 },
            })
        }
    }

    // Tri
    const allowedSortFields = ['created_at', 'updated_at', 'status', 'tool', 'magic_link_sent_at', 'priority', 'due_date', 'follow_up_at']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at'
    query = query.order(sortField, { ascending: sortDir === 'asc' })

    // Pagination
    const { data, error, count } = await query.range(offset, offset + pageSize - 1)

    if (error) {
        console.error('[API GET /leads/list]', error)
        return NextResponse.json(
            { success: false, error: 'Erreur base de données' },
            { status: 500 },
        )
    }

    leads = data ?? []
    totalCount = count ?? 0

    const leadIds = (leads as Array<{ id: string }>).map((lead) => lead.id)
    const sellerByLead = new Map<string, unknown>()
    const opportunityByLead = new Map<string, unknown>()

    if (leadIds.length > 0) {
        const [{ data: sellerProperties }, { data: opportunities }] = await Promise.all([
            supabaseAdmin
                .from('seller_properties')
                .select('*')
                .in('lead_id', leadIds),
            supabaseAdmin
                .from('opportunities')
                .select('id, lead_id, title, stage, priority, created_at')
                .in('lead_id', leadIds)
                .order('created_at', { ascending: false }),
        ])

        for (const sellerProperty of sellerProperties ?? []) {
            const key = (sellerProperty as { lead_id?: string }).lead_id
            if (key && !sellerByLead.has(key)) sellerByLead.set(key, sellerProperty)
        }
        for (const opportunity of opportunities ?? []) {
            const key = (opportunity as { lead_id?: string | null }).lead_id
            if (key && !opportunityByLead.has(key)) opportunityByLead.set(key, opportunity)
        }
    }

    const enriched = (leads as Array<{ id: string }>).map((lead) => ({
        ...lead,
        seller_property: sellerByLead.get(lead.id) ?? null,
        opportunity: opportunityByLead.get(lead.id) ?? null,
    }))

    return NextResponse.json({
        success: true,
        data: enriched,
        pagination: {
            page,
            pageSize,
            total: totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
        },
    })
}
