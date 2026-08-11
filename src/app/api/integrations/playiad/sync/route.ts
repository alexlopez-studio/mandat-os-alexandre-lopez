import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildProjectTitle } from '@/lib/project-stages'
import {
  leadDedupKey,
  leadIdentityKeys,
  normalizeEmail,
  normalizePhone,
  parseNumber,
  parseText,
  type PlayiadLeadPayload,
} from '@/lib/playiad/leads'

export const dynamic = 'force-dynamic'

type SyncOutcome = {
  key: string
  name: string
  status: 'created' | 'already_known' | 'invalid_data' | 'error'
  project_id?: string
  reason?: string
}

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.PLAYIAD_SYNC_SECRET
  // Sans secret configure, l'endpoint reste ferme : il ecrit dans le CRM et ne
  // doit jamais etre ouvert par defaut.
  if (!expected) return false
  const provided = req.headers.get('x-mandat-os-key')
  return typeof provided === 'string' && provided === expected
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Clé de synchronisation absente ou invalide' },
      { status: 401 },
    )
  }

  try {
    const body = await req.json()
    const leadsRaw: unknown[] = Array.isArray(body.leads) ? body.leads : [body]
    // Mode simulation : renvoie ce qui serait importe sans rien ecrire. Sert a
    // valider les selecteurs de l'extension sur la vraie page Playiad.
    const dryRun = body.dryRun === true

    if (leadsRaw.length === 0) {
      return NextResponse.json({ error: 'Aucun lead transmis' }, { status: 400 })
    }

    const normalized = leadsRaw.map((raw) => {
      const item = (raw ?? {}) as PlayiadLeadPayload
      return {
        playiadId: parseText(item.playiad_id),
        firstName: parseText(item.first_name),
        lastName: parseText(item.last_name),
        email: normalizeEmail(item.email),
        phone: normalizePhone(item.phone),
        source: parseText(item.source) || 'Playiad',
        propertyRef: parseText(item.property_ref),
        propertyTitle: parseText(item.property_title),
        propertyType: parseText(item.property_type),
        city: parseText(item.city),
        budgetMax: parseNumber(item.budget_max),
        message: parseText(item.message),
      }
    })

    // Un meme acquereur peut apparaitre plusieurs fois dans une page scrapee.
    const seenInBatch = new Set<string>()
    const outcomes: SyncOutcome[] = []
    let createdCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const lead of normalized) {
      const displayName =
        [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Acquéreur sans nom'
      const key = leadDedupKey(lead)

      if (!key) {
        errorCount += 1
        outcomes.push({
          key: '—',
          name: displayName,
          status: 'invalid_data',
          reason: 'Ni e-mail, ni téléphone exploitable',
        })
        continue
      }

      const identities = leadIdentityKeys(lead)
      if (identities.some((identity) => seenInBatch.has(identity))) {
        skippedCount += 1
        outcomes.push({ key, name: displayName, status: 'already_known', reason: 'Doublon dans la page' })
        continue
      }
      identities.forEach((identity) => seenInBatch.add(identity))

      try {
        // 1. Le contact existe-t-il deja dans l'annuaire ?
        let contactId: string | null = null
        if (lead.email) {
          const { data } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('email', lead.email)
            .maybeSingle()
          contactId = data?.id ?? null
        }
        if (!contactId && lead.phone) {
          const { data } = await supabaseAdmin
            .from('contacts')
            .select('id')
            .eq('phone', lead.phone)
            .maybeSingle()
          contactId = data?.id ?? null
        }

        // 2. A-t-il deja un projet d'achat ouvert ? C'est le vrai critere
        //    d'idempotence : re-scraper la meme page ne doit rien recreer.
        if (contactId) {
          const { data: links } = await supabaseAdmin
            .from('project_contacts')
            .select('opportunity_id, buyer_criteria_id')
            .eq('contact_id', contactId)

          const projectIds = (links ?? [])
            .map((link) => link.buyer_criteria_id || link.opportunity_id)
            .filter((id): id is string => Boolean(id))

          if (projectIds.length > 0) {
            const { data: openBuyerProjects } = await supabaseAdmin
              .from('projects')
              .select('id')
              .in('id', projectIds)
              .eq('kind', 'achat')
              .neq('active', false)

            if ((openBuyerProjects ?? []).length > 0) {
              skippedCount += 1
              outcomes.push({
                key,
                name: displayName,
                status: 'already_known',
                reason: 'Projet acquéreur déjà ouvert',
                project_id: openBuyerProjects![0].id,
              })
              continue
            }
          }
        }

        if (dryRun) {
          createdCount += 1
          outcomes.push({ key, name: displayName, status: 'created', reason: 'Simulation' })
          continue
        }

        // 3. Creer le contact si besoin
        if (!contactId) {
          const { data: newContact, error: contactError } = await supabaseAdmin
            .from('contacts')
            .insert({
              first_name: lead.firstName || 'Acquéreur',
              last_name: lead.lastName || 'Playiad',
              email: lead.email,
              phone: lead.phone,
              source: lead.source,
              types: ['acquereur'],
              status: 'prospect',
            })
            .select('id')
            .single()

          if (contactError || !newContact) {
            throw new Error(contactError?.message || 'Création du contact impossible')
          }
          contactId = newContact.id
        }

        // 4. Creer le projet d'achat
        const criteres = [`Source: ${lead.source}`]
        if (lead.propertyRef) criteres.push(`Réf annonce: ${lead.propertyRef}`)
        if (lead.propertyTitle) criteres.push(`Bien: ${lead.propertyTitle}`)
        if (lead.message) criteres.push(`Message: ${lead.message}`)

        const title =
          buildProjectTitle({
            contactLastNames: lead.lastName ? [lead.lastName] : [],
            propertyType: lead.propertyType,
          }) || `${displayName.toUpperCase()} - Recherche`

        const { data: project, error: projectError } = await supabaseAdmin
          .from('projects')
          .insert({
            kind: 'achat',
            title,
            stage: 'Nouveau contact',
            priority: 'normal',
            active: true,
            type_bien: lead.propertyType,
            budget_max: lead.budgetMax,
            communes: lead.city ? [lead.city] : null,
            criteres,
            next_action: `Qualifier la demande ${lead.source}`,
          })
          .select('id')
          .single()

        if (projectError || !project) {
          throw new Error(projectError?.message || 'Création du projet impossible')
        }

        // 5. Rattacher le contact au projet
        await supabaseAdmin.from('project_contacts').insert({
          contact_id: contactId,
          buyer_criteria_id: project.id,
          role: 'Acquéreur principal',
        })

        createdCount += 1
        outcomes.push({ key, name: displayName, status: 'created', project_id: project.id })
      } catch (itemError) {
        errorCount += 1
        outcomes.push({
          key,
          name: displayName,
          status: 'error',
          reason: itemError instanceof Error ? itemError.message : 'Erreur inconnue',
        })
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      total: normalized.length,
      createdCount,
      skippedCount,
      errorCount,
      results: outcomes,
    })
  } catch (e) {
    console.error('[API /integrations/playiad/sync] POST exception:', e)
    return NextResponse.json(
      { error: 'Erreur serveur lors de la synchronisation Playiad' },
      { status: 500 },
    )
  }
}
