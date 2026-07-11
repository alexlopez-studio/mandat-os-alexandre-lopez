import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = sanitizeRedirect(url.searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.email) {
      await supabaseAdmin
        .from('client_profiles')
        .update({ user_id: user.id } as never)
        .is('user_id', null)
        .ilike('email', user.email)
    }
  }

  return NextResponse.redirect(new URL(next, url.origin))
}

function sanitizeRedirect(value: string | null) {
  if (!value || !value.startsWith('/')) return '/espace-client'
  if (value.startsWith('//')) return '/espace-client'
  return value
}
