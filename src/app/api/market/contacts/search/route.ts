import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const limit = Math.min(Number(searchParams.get('limit')) || 10, 50)

    let query = supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email, phone, source')
      
    if (q) {
      // Or search across names, email, phone
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
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
