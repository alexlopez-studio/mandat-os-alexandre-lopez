'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setErr('8 caractères minimum'); return }
    if (password !== confirm) { setErr('Les mots de passe ne correspondent pas'); return }
    setLoading(true)
    setErr('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setErr('Lien expiré ou session manquante. Recommencez la procédure.')
        return
      }
      router.push('/app/dashboard')
      router.refresh()
    } catch {
      setErr('Erreur, réessayez')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-9">
        <h1 className="text-xl font-black tracking-tight text-slate-900">Nouveau mot de passe</h1>
        <p className="mb-7 mt-1.5 text-sm text-slate-500">Choisissez un nouveau mot de passe.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            autoFocus
            autoComplete="new-password"
            className="w-full rounded-xl border-[1.5px] border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-sky-500"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirmer le mot de passe"
            autoComplete="new-password"
            className="w-full rounded-xl border-[1.5px] border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-sky-500"
          />
          {err && <p className="text-sm text-red-500">{err}</p>}
          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}
