'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setErr('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      })
      if (error) throw error
      setSent(true)
    } catch {
      // On affiche un message neutre pour ne pas révéler l'existence d'un compte
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-9">
        <h1 className="text-xl font-black tracking-tight text-slate-900">Mot de passe oublié</h1>
        <p className="mb-7 mt-1.5 text-sm text-slate-500">Recevez un lien de réinitialisation par email.</p>
        {sent ? (
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
            Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              autoFocus
              className="w-full rounded-xl border-[1.5px] border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-sky-500"
            />
            {err && <p className="text-sm text-red-500">{err}</p>}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        )}
        <Link href="/admin/login" className="mt-4 inline-block text-xs text-sky-600">← Retour à la connexion</Link>
      </div>
    </div>
  )
}
