'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, ExternalLink, KeyRound, Loader2, RefreshCw, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Provider = {
  id: string
  label: string
  category: 'direct' | 'router'
  defaultModel: string
  models: string[]
  configured: boolean
  helpUrl: string
}

type Credential = {
  id: string
  provider_id: string
  label: string
  default_model: string | null
  status: string
  masked_key: string | null
  last_tested_at: string | null
  last_error: string | null
}

export function AiIntegrationsSettings() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [providerId, setProviderId] = useState('openrouter')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [granolaKey, setGranolaKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [syncingGranola, setSyncingGranola] = useState(false)
  const [loading, setLoading] = useState(true)

  const activeProvider = useMemo(() => providers.find((provider) => provider.id === providerId), [providers, providerId])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/providers')
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Chargement impossible')
      setProviders(json.data.providers ?? [])
      setCredentials(json.data.credentials ?? [])
      setProviderId(json.data.defaults?.providerId ?? 'openrouter')
      setModel(json.data.defaults?.model ?? json.data.providers?.[0]?.defaultModel ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement IA impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function selectProvider(id: string) {
    setProviderId(id)
    const provider = providers.find((item) => item.id === id)
    const credential = credentials.find((item) => item.provider_id === id)
    setModel(credential?.default_model ?? provider?.defaultModel ?? '')
  }

  async function saveCredential() {
    setSaving(true)
    try {
      const res = await fetch('/api/ai/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: providerId,
          api_key: apiKey,
          default_model: model,
          test: true,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Enregistrement impossible')
      if (json.data.test?.ok === false) {
        toast.error(`Clé enregistrée, test échoué : ${json.data.test.error}`)
      } else {
        toast.success('Clé IA enregistrée et fournisseur activé')
      }
      setApiKey('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur clé IA')
    } finally {
      setSaving(false)
    }
  }

  async function saveDefaultProvider() {
    try {
      const res = await fetch('/api/ai/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: providerId, model }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Réglage impossible')
      toast.success('Fournisseur par défaut mis à jour')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Réglage impossible')
    }
  }

  async function revokeCredential(id: string) {
    try {
      const res = await fetch(`/api/ai/credentials?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Révocation impossible')
      toast.success('Clé révoquée')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Révocation impossible')
    }
  }

  async function syncGranola() {
    setSyncingGranola(true)
    try {
      const res = await fetch('/api/integrations/granola/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: granolaKey || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Sync Granola impossible')
      setGranolaKey('')
      toast.success(`${json.data.imported} transcript(s), ${json.data.queued} action(s) à valider`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync Granola impossible')
    } finally {
      setSyncingGranola(false)
    }
  }

  if (loading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Chargement IA...</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            Catalogue IA plug-and-play
          </CardTitle>
          <CardDescription>
            Sélectionne le fournisseur, ajoute une clé API serveur, puis Mandat OS route l’assistant via la passerelle commune.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[240px_1fr_1fr_auto] lg:items-end">
            <label className="space-y-1">
              <Label>Fournisseur</Label>
              <Select value={providerId} onValueChange={selectProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.label} · {provider.category === 'router' ? 'routeur' : 'direct'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1">
              <Label>Modèle par défaut</Label>
              <Input value={model} onChange={(event) => setModel(event.target.value)} placeholder={activeProvider?.defaultModel} />
            </label>
            <label className="space-y-1">
              <Label>Clé API</Label>
              <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder="sk-..." autoComplete="off" />
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={saveDefaultProvider}>
                <Save />
                Défaut
              </Button>
              <Button variant="primary" onClick={saveCredential} disabled={saving || !apiKey.trim()}>
                {saving ? <Loader2 className="animate-spin" /> : <KeyRound />}
                Enregistrer
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            {credentials.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Aucune clé IA active. L’assistant utilisera un mode local limité.
              </div>
            ) : credentials.map((credential) => (
              <div key={credential.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{credential.label}</p>
                    <Badge variant="outline" className="rounded-md">{credential.provider_id}</Badge>
                    <Badge variant="outline" className={credential.status === 'active' ? 'rounded-md border-emerald-200 bg-emerald-50 text-emerald-700' : 'rounded-md border-amber-200 bg-amber-50 text-amber-700'}>
                      {credential.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {credential.masked_key} · {credential.default_model ?? 'modèle fournisseur'}
                    {credential.last_error ? ` · ${credential.last_error}` : ''}
                  </p>
                </div>
                <Button variant="destructive" size="xs" onClick={() => void revokeCredential(credential.id)}>
                  <Trash2 />
                  Révoquer
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="size-4 text-primary" />
              Google Workspace
            </CardTitle>
            <CardDescription>Connexion OAuth Gmail, Drive et Agenda avec scopes minimaux.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              Gmail en lecture, brouillons email, Drive metadata, événements Agenda en lecture.
            </div>
            <Button asChild variant="outline">
              <a href="/api/integrations/google/oauth/start">
                <ShieldCheck />
                Connecter Google Workspace
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="size-4 text-primary" />
              Granola
            </CardTitle>
            <CardDescription>Importe les transcripts récents, classe vers un dossier et crée des actions à valider.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="space-y-1">
              <Label>Clé API Granola</Label>
              <Input value={granolaKey} onChange={(event) => setGranolaKey(event.target.value)} type="password" placeholder="grn_..." autoComplete="off" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => void syncGranola()} disabled={syncingGranola}>
                {syncingGranola ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Synchroniser
              </Button>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3 text-emerald-700" />
                Polling sécurisé, pas de webhook requis en V1.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
