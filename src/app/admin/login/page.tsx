'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

const brand = '#0077B6'
const fg = '#0F172A'
const muted = '#64748B'
const border = '#E2E8F0'
const surface = '#F8FAFC'
const white = '#ffffff'
const error = '#EF4444'
const FONT = 'var(--font-inter, system-ui, sans-serif)'

const pageSt: CSSProperties = { minHeight: '100vh', backgroundColor: surface, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const cardSt: CSSProperties = { backgroundColor: white, border: '1px solid ' + border, borderRadius: '20px', padding: '40px 36px', width: '100%', maxWidth: '380px' }
const titleSt: CSSProperties = { fontSize: '20px', fontWeight: 900, color: fg, marginBottom: '6px', letterSpacing: '-0.02em' }
const subSt: CSSProperties = { fontSize: '13px', fontWeight: 300, color: muted, marginBottom: '28px' }
const labelSt: CSSProperties = { fontSize: '12px', fontWeight: 600, color: fg, marginBottom: '6px', display: 'block' }
const inputSt: CSSProperties = { width: '100%', padding: '12px 14px', border: '1.5px solid ' + border, borderRadius: '12px', fontSize: '14px', color: fg, outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }
const btnSt: CSSProperties = { width: '100%', padding: '13px', borderRadius: '12px', backgroundColor: brand, border: 'none', color: white, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }
const btnOffSt: CSSProperties = { ...btnSt, backgroundColor: border, color: muted, cursor: 'not-allowed' }
const errorSt: CSSProperties = { fontSize: '13px', color: error, marginBottom: '12px', fontWeight: 500 }
const linkSt: CSSProperties = { fontSize: '12px', color: brand, textDecoration: 'none', display: 'inline-block', marginTop: '16px' }

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/app/dashboard'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setErr('')
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setErr('Email ou mot de passe incorrect')
        return
      }
      // Vérifie que le compte est bien un admin actif
      const me = await fetch('/api/admin/me')
      if (!me.ok) {
        await supabase.auth.signOut()
        setErr('Ce compte n’est pas autorisé à accéder au back-office.')
        return
      }
      router.push(redirect)
      router.refresh()
    } catch {
      setErr('Erreur réseau, réessayez')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = email.trim() && password && !loading

  return (
    <div style={pageSt}>
      <div style={cardSt}>
        <div style={titleSt}>Administration</div>
        <div style={subSt}>Alex Lopez Provence · Accès réservé</div>
        <form onSubmit={handleSubmit}>
          <label style={labelSt}>Email</label>
          <input
            type="email"
            style={inputSt}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
            disabled={loading}
          />
          <label style={labelSt}>Mot de passe</label>
          <input
            type="password"
            style={inputSt}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
          {err && <div style={errorSt}>{err}</div>}
          <button type="submit" style={canSubmit ? btnSt : btnOffSt} disabled={!canSubmit}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
        <Link href="/admin/mot-de-passe-oublie" style={linkSt}>
          Mot de passe oublié ?
        </Link>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
