import { supabaseAdmin } from '@/lib/supabase'
import { BON_DE_VISITE_ADVISOR, getLegalText } from './legal'
import type { BonDeVisite, CreateBonDeVisiteInput, EmailDeliveryStatus, VisitorInfo } from './types'
import type { Json } from '@/types/supabase'
import { randomBytes } from 'crypto'

const FALLBACK_SETTINGS_PREFIX = 'bon_de_visite:'

export function generateToken(): string {
  return randomBytes(16).toString('hex')
}

export async function generateNextReference(): Promise<string> {
  const currentYear = new Date().getFullYear()
  const prefix = `BV-${currentYear}-`

  try {
    // 1. Try from bons_de_visite table
    const { data, error } = await supabaseAdmin
      .from('bons_de_visite')
      .select('reference')
      .ilike('reference', `${prefix}%`)
      .order('reference', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const lastRef = data[0].reference
      const numPart = parseInt(lastRef.replace(prefix, ''), 10)
      if (!isNaN(numPart)) {
        const nextNum = (numPart + 1).toString().padStart(3, '0')
        return `${prefix}${nextNum}`
      }
    }
  } catch {
    // Fallback if table doesn't exist
  }

  try {
    // 2. Try from app_settings fallback
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .ilike('key', `${FALLBACK_SETTINGS_PREFIX}%`)

    if (settings && settings.length > 0) {
      let maxNum = 0
      for (const item of settings) {
        const bon = item.value as unknown as BonDeVisite
        if (bon?.reference && bon.reference.startsWith(prefix)) {
          const num = parseInt(bon.reference.replace(prefix, ''), 10)
          if (!isNaN(num) && num > maxNum) maxNum = num
        }
      }
      return `${prefix}${(maxNum + 1).toString().padStart(3, '0')}`
    }
  } catch {
    // ignore
  }

  return `${prefix}001`
}

export async function saveBonDeVisite(input: CreateBonDeVisiteInput): Promise<BonDeVisite> {
  const reference = await generateNextReference()
  const token = generateToken()
  const now = new Date().toISOString()
  const visitAt = input.visit_at || now

  const signerName =
    input.signer_name ||
    (input.visitors.length > 0
      ? `${input.visitors[0].first_name} ${input.visitors[0].last_name}`.trim()
      : 'Visiteur')

  const parsedVisitors: VisitorInfo[] = input.visitors.map((v) => ({
    first_name: v.first_name.trim(),
    last_name: v.last_name.trim(),
    id_type: v.id_type || 'cni',
    cni_number: v.cni_number?.trim() || '',
    email: v.email?.trim() ? v.email.trim().toLowerCase() : null,
    phone: v.phone?.trim() || null,
    address: v.address?.trim() || null,
  }))

  const record: BonDeVisite = {
    id: crypto.randomUUID(),
    reference,
    token,
    project_id: input.project_id || null,
    property_address: input.property_address.trim(),
    property_city: input.property_city.trim(),
    property_zipcode: input.property_zipcode?.trim() || null,
    property_type: input.property_type?.trim() || null,
    property_price: input.property_price ?? null,
    mandate_ref: input.mandate_ref?.trim() || null,
    visit_at: visitAt,
    visitors_count: parsedVisitors.length,
    visitors: parsedVisitors,
    legal_text: getLegalText(),
    signature_data_url: input.signature_data_url,
    signer_name: signerName,
    advisor_name: BON_DE_VISITE_ADVISOR.name,
    advisor_email: BON_DE_VISITE_ADVISOR.email,
    advisor_phone: BON_DE_VISITE_ADVISOR.phone,
    advisor_rsac: BON_DE_VISITE_ADVISOR.rsac,
    email_status: 'pending',
    email_sent_at: null,
    notes: input.notes?.trim() || null,
    created_at: now,
    updated_at: now,
  }

  // 1. Try inserting directly into bons_de_visite
  let savedInTable = false
  try {
    const { data, error } = await supabaseAdmin
      .from('bons_de_visite')
      .insert({
        id: record.id,
        reference: record.reference,
        token: record.token,
        project_id: record.project_id,
        property_address: record.property_address,
        property_city: record.property_city,
        property_zipcode: record.property_zipcode,
        property_type: record.property_type,
        property_price: record.property_price,
        mandate_ref: record.mandate_ref,
        visit_at: record.visit_at,
        visitors_count: record.visitors_count,
        visitors: record.visitors as unknown as Json,
        legal_text: record.legal_text,
        signature_data_url: record.signature_data_url,
        signer_name: record.signer_name,
        advisor_name: record.advisor_name,
        advisor_email: record.advisor_email,
        advisor_phone: record.advisor_phone,
        advisor_rsac: record.advisor_rsac,
        email_status: record.email_status,
        email_sent_at: record.email_sent_at,
        notes: record.notes,
        created_at: record.created_at,
        updated_at: record.updated_at,
      })
      .select('*')
      .single()

    if (!error && data) {
      savedInTable = true
    }
  } catch {
    savedInTable = false
  }

  // 2. Fallback to app_settings if table isn't migrated
  if (!savedInTable) {
    try {
      await supabaseAdmin.from('app_settings').upsert({
        key: `${FALLBACK_SETTINGS_PREFIX}${record.id}`,
        value: record as unknown as Json,
        updated_at: now,
      })
    } catch (err) {
      console.error('[BonDeVisite Storage] Fallback upsert error:', err)
    }
  }

  // 3. Automatically sync visitors to CRM Contacts table
  await syncVisitorsToContacts(record)

  // 4. If project_id provided, add timeline activity to Project
  if (record.project_id) {
    await linkActivityToProject(record)
  }

  return record
}

async function syncVisitorsToContacts(bon: BonDeVisite): Promise<void> {
  for (const visitor of bon.visitors) {
    if (!visitor.email && !visitor.last_name) continue

    try {
      let existingId: string | null = null

      if (visitor.email) {
        const { data: existing } = await supabaseAdmin
          .from('contacts')
          .select('id, types')
          .eq('email', visitor.email)
          .limit(1)

        if (existing && existing.length > 0) {
          existingId = existing[0].id
          const currentTypes: string[] = Array.isArray(existing[0].types) ? existing[0].types : []
          if (!currentTypes.includes('acquereur')) {
            await supabaseAdmin
              .from('contacts')
              .update({
                types: Array.from(new Set([...currentTypes, 'acquereur'])),
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingId)
          }
        }
      }

      if (!existingId) {
        await supabaseAdmin.from('contacts').insert({
          first_name: visitor.first_name,
          last_name: visitor.last_name,
          email: visitor.email || null,
          phone: visitor.phone || null,
          source: 'bon_de_visite',
          types: ['acquereur'],
          status: 'qualified',
        })
      }
    } catch (err) {
      console.error('[BonDeVisite Storage] Error syncing contact:', err)
    }
  }
}

async function linkActivityToProject(bon: BonDeVisite): Promise<void> {
  if (!bon.project_id) return

  try {
    const visitorNames = bon.visitors.map((v) => `${v.first_name} ${v.last_name}`).join(', ')
    const content = `Bon de visite certifié ${bon.reference} signé avec ${visitorNames} pour le bien à ${bon.property_city}.`

    // 1. Enregistrement dans les activités générales du projet
    await supabaseAdmin.from('activities').insert({
      opportunity_id: bon.project_id,
      type: 'meeting',
      title: `Visite effectuée (${bon.reference})`,
      content,
      occurred_at: bon.visit_at,
      metadata: {
        bon_de_visite_id: bon.id,
        reference: bon.reference,
        token: bon.token,
        visitors_count: bon.visitors_count,
        property_address: bon.property_address,
      } as unknown as Json,
    })

    // 2. Synchronisation automatique dans l'Espace Client Propriétaire (client_dossier_events)
    const { data: dossiers } = await supabaseAdmin
      .from('client_dossiers')
      .select('id')
      .eq('opportunity_id', bon.project_id)
      .limit(1)

    if (dossiers && dossiers.length > 0) {
      const dossierId = dossiers[0].id
      await supabaseAdmin.from('client_dossier_events').insert({
        dossier_id: dossierId,
        type: 'visit',
        title: `Visite effectuée - ${visitorNames}`,
        description: bon.notes
          ? `Compte-rendu : ${bon.notes}`
          : `Visite effectuée par ${bon.visitors_count} visiteur(s) (${visitorNames}).`,
        status: 'done',
        event_date: bon.visit_at,
        payload: {
          buyer_name: visitorNames,
          feedback: bon.notes || null,
          visitors_count: bon.visitors_count,
          bon_reference: bon.reference,
          bon_token: bon.token,
          email_status: bon.email_status,
        } as unknown as Json,
        visible_to_client: true,
        created_by: 'bon_de_visite',
      } as never)
    }
  } catch (err) {
    console.error('[BonDeVisite Storage] Error recording project activity / client dossier event:', err)
  }
}

export async function updateBonDeVisiteEmailStatus(
  id: string,
  status: EmailDeliveryStatus,
  sentAt?: string
): Promise<void> {
  const timestamp = sentAt || new Date().toISOString()

  try {
    await supabaseAdmin
      .from('bons_de_visite')
      .update({
        email_status: status,
        email_sent_at: timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
  } catch {
    // ignore
  }

  try {
    const { data: item } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', `${FALLBACK_SETTINGS_PREFIX}${id}`)
      .single()

    if (item?.value) {
      const bon = item.value as unknown as BonDeVisite
      bon.email_status = status
      bon.email_sent_at = timestamp
      bon.updated_at = new Date().toISOString()

      await supabaseAdmin.from('app_settings').update({
        value: bon as unknown as Json,
        updated_at: new Date().toISOString(),
      }).eq('key', `${FALLBACK_SETTINGS_PREFIX}${id}`)
    }
  } catch {
    // ignore
  }
}

export async function getBonDeVisiteByToken(token: string): Promise<BonDeVisite | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('bons_de_visite')
      .select('*')
      .eq('token', token)
      .single()

    if (!error && data) {
      return {
        ...data,
        visitors: (data.visitors as unknown as VisitorInfo[]) || [],
        email_status: data.email_status as EmailDeliveryStatus,
      } as BonDeVisite
    }
  } catch {
    // ignore
  }

  try {
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .ilike('key', `${FALLBACK_SETTINGS_PREFIX}%`)

    if (settings) {
      for (const s of settings) {
        const bon = s.value as unknown as BonDeVisite
        if (bon?.token === token) return bon
      }
    }
  } catch {
    // ignore
  }

  return null
}

export async function getBonDeVisiteById(id: string): Promise<BonDeVisite | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('bons_de_visite')
      .select('*')
      .eq('id', id)
      .single()

    if (!error && data) {
      return {
        ...data,
        visitors: (data.visitors as unknown as VisitorInfo[]) || [],
        email_status: data.email_status as EmailDeliveryStatus,
      } as BonDeVisite
    }
  } catch {
    // ignore
  }

  try {
    const { data: item } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', `${FALLBACK_SETTINGS_PREFIX}${id}`)
      .single()

    if (item?.value) {
      return item.value as unknown as BonDeVisite
    }
  } catch {
    // ignore
  }

  return null
}

export async function listBonsDeVisite(options?: {
  search?: string
  projectId?: string
  limit?: number
}): Promise<BonDeVisite[]> {
  const limit = options?.limit ?? 100
  let results: BonDeVisite[] = []

  try {
    let query = supabaseAdmin
      .from('bons_de_visite')
      .select('*')
      .order('visit_at', { ascending: false })
      .limit(limit)

    if (options?.projectId) {
      query = query.eq('project_id', options.projectId)
    }

    const { data, error } = await query
    if (!error && data && data.length > 0) {
      results = data.map((row) => ({
        ...row,
        visitors: (row.visitors as unknown as VisitorInfo[]) || [],
        email_status: row.email_status as EmailDeliveryStatus,
      })) as BonDeVisite[]
    }
  } catch {
    // ignore
  }

  if (results.length === 0) {
    try {
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .ilike('key', `${FALLBACK_SETTINGS_PREFIX}%`)

      if (settings) {
        for (const s of settings) {
          const bon = s.value as unknown as BonDeVisite
          if (bon && bon.id) {
            if (!options?.projectId || bon.project_id === options.projectId) {
              results.push(bon)
            }
          }
        }
        results.sort(
          (a, b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime()
        )
      }
    } catch {
      // ignore
    }
  }

  if (options?.search) {
    const s = options.search.toLowerCase().trim()
    results = results.filter((b) => {
      const haystack = [
        b.reference,
        b.property_address,
        b.property_city,
        b.mandate_ref,
        b.signer_name,
        ...b.visitors.flatMap((v) => [v.first_name, v.last_name, v.email, v.cni_number]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(s)
    })
  }

  return results
}
