import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseImport, normalizePhone, type ParsedContact } from '@/lib/warm-list/parse'
import type { Database } from '@/types/supabase'

type WarmContactInsert = Database['public']['Tables']['warm_contacts']['Insert']

/**
 * POST /api/market/warm-contacts/import
 * Body JSON : { filename: string, content: string }
 *
 * Parse un fichier vCard (.vcf) ou CSV, déduplique contre la base existante
 * et contre lui-même (par téléphone/email/nom), puis insère les nouveaux
 * contacts avec source = 'vcard' | 'csv'.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const filename: string = typeof body.filename === 'string' ? body.filename : 'import'
    const content: string = typeof body.content === 'string' ? body.content : ''

    if (!content.trim()) {
      return NextResponse.json({ error: 'Fichier vide' }, { status: 400 })
    }

    const parsed = parseImport(filename, content)
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: 'Aucun contact détecté dans le fichier. Vérifiez le format (vCard .vcf ou CSV avec en-têtes).' },
        { status: 422 },
      )
    }

    const source = filename.toLowerCase().endsWith('.vcf') || /BEGIN:VCARD/i.test(content)
      ? 'vcard'
      : 'csv'

    // Index des contacts existants pour la déduplication
    const { data: existing } = await supabaseAdmin
      .from('warm_contacts')
      .select('full_name, phone, email')

    const existingPhones = new Set<string>()
    const existingEmails = new Set<string>()
    const existingNames = new Set<string>()
    for (const c of existing ?? []) {
      if (c.phone) existingPhones.add(normalizePhone(c.phone))
      if (c.email) existingEmails.add(c.email.toLowerCase())
      if (c.full_name) existingNames.add(c.full_name.toLowerCase().trim())
    }

    // Dédup interne au fichier
    const seenPhones = new Set<string>()
    const seenEmails = new Set<string>()
    const seenNames = new Set<string>()

    const toInsert: WarmContactInsert[] = []
    let skipped = 0

    const isDuplicate = (c: ParsedContact): boolean => {
      const phone = c.phone ? normalizePhone(c.phone) : ''
      const email = c.email ? c.email.toLowerCase() : ''
      const name = c.full_name.toLowerCase().trim()
      if (phone && (existingPhones.has(phone) || seenPhones.has(phone))) return true
      if (email && (existingEmails.has(email) || seenEmails.has(email))) return true
      // Dédup par nom seulement si aucun identifiant fort n'est disponible
      if (!phone && !email && name && (existingNames.has(name) || seenNames.has(name))) return true
      return false
    }

    for (const c of parsed) {
      if (!c.full_name && !c.phone && !c.email) {
        skipped++
        continue
      }
      if (isDuplicate(c)) {
        skipped++
        continue
      }
      if (c.phone) seenPhones.add(normalizePhone(c.phone))
      if (c.email) seenEmails.add(c.email.toLowerCase())
      seenNames.add(c.full_name.toLowerCase().trim())

      toInsert.push({
        full_name: c.full_name || c.email || c.phone || 'Sans nom',
        relation: c.relation || null,
        phone: c.phone || null,
        email: c.email || null,
        notes: c.notes || null,
        status: 'a_contacter',
        source,
      })
    }

    let imported = 0
    if (toInsert.length > 0) {
      // Insertion en lots de 500 pour rester sous les limites
      for (let i = 0; i < toInsert.length; i += 500) {
        const chunk = toInsert.slice(i, i + 500)
        const { data, error } = await supabaseAdmin
          .from('warm_contacts')
          .insert(chunk)
          .select('id')
        if (error) {
          console.error('[API warm-contacts/import] insert error:', error)
          return NextResponse.json(
            { error: 'Erreur lors de l\'insertion', imported, skipped },
            { status: 500 },
          )
        }
        imported += data?.length ?? 0
      }
    }

    return NextResponse.json({
      ok: true,
      detected: parsed.length,
      imported,
      skipped,
      source,
    })
  } catch (e) {
    console.error('[API warm-contacts/import] POST', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
