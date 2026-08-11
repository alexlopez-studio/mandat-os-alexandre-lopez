import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isContactType } from '@/lib/contact-types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const type = searchParams.get('type') ?? ''
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 200)

    let query = supabaseAdmin
      .from('contacts_directory')
      .select('id, first_name, last_name, email, phone, company, relation, source, types, all_types, projects_count, status')

    if (q) {
      // Or search across names, email, phone, company
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`
      )
    }

    if (isContactType(type)) {
      query = query.contains('all_types', [type])
    }

    const { data: contacts, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[API /market/contacts/search] error:', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    return NextResponse.json({ contacts }, { status: 200 })
  } catch (error) {
    console.error('[API /market/contacts/search] error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
