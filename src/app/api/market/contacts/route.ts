import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { first_name, last_name, email, phone, source } = body

    const { data: contact, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        first_name: first_name || '',
        last_name: last_name || '',
        email: email || null,
        phone: phone || null,
        source: source || 'system',
      })
      .select('*')
      .single()

    if (error) {
      console.error('[API /market/contacts] Creation error:', error)
      return NextResponse.json({ error: 'Erreur lors de la création du contact' }, { status: 500 })
    }

    return NextResponse.json({ contact }, { status: 201 })
  } catch (e) {
    console.error('[API /market/contacts] POST error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
