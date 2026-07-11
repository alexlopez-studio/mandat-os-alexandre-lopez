'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type Provider = {
  id: string
  label: string
  defaultModel: string
  configured: boolean
}

type Dossier = {
  id: string
  title: string
  status: string
  client_type: string
  client_profile?: {
    email?: string
    first_name?: string
    last_name?: string
  }
  stats?: {
    documents_missing?: number
    documents_validated?: number
  }
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type AiAction = {
  id: string
  title: string
  description: string | null
  action_type: string
  status: 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed'
  risk_level: 'low' | 'medium' | 'high'
  created_at: string
  dossier_id: string | null
}

export function AssistantWorkspace() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [providerId, setProviderId] = useState<string>('openrouter')
  const [model, setModel] = useState('')
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [dossierId, setDossierId] = useState<string>('none')
  const [actions, setActions] = useState<AiAction[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Bonjour Alexandre. Sélectionne un dossier si besoin, puis demande-moi de préparer une réponse, un compte rendu, une relance ou une synthèse. Je proposerai les actions, tu gardes la main.',
    },
  ])
  const [input, setInput] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const activeProvider = useMemo(() => providers.find((provider) => provider.id === providerId), [providers, providerId])
  const selectedDossier = useMemo(() => dossiers.find((dossier) => dossier.id === dossierId), [dossiers, dossierId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [providerRes, dossiersRes, actionsRes] = await Promise.all([
        fetch('/api/ai/providers'),
        fetch('/api/market/clients?page_size=50&client_type=seller'),
        fetch('/api/ai/actions?status=proposed'),
      ])
      const providerJson = await providerRes.json()
      const dossiersJson = await dossiersRes.json()
      const actionsJson = await actionsRes.json()

      const providerData = providerJson.data
      setProviders(providerData?.providers ?? [])
      setProviderId(providerData?.defaults?.providerId ?? 'openrouter')
      setModel(providerData?.defaults?.model ?? '')
      setDossiers(dossiersJson.data ?? [])
      setActions(actionsJson.data ?? [])
    } catch (err) {
      console.error(err)
      toast.error('Chargement assistant impossible')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function sendMessage() {
    const message = input.trim()
    if (!message || sending) return
    setInput('')
    setSending(true)
    setMessages((current) => [...current, { role: 'user', content: message }])
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          thread_id: threadId,
          dossier_id: dossierId === 'none' ? null : dossierId,
          provider_id: providerId,
          model,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Réponse impossible')
      setThreadId(json.data.thread_id)
      setMessages((current) => [...current, { role: 'assistant', content: json.data.answer }])
      if ((json.data.proposed_actions ?? []).length > 0) {
        toast.success(`${json.data.proposed_actions.length} action(s) proposée(s)`)
        await refreshActions()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur assistant'
      toast.error(message)
      setMessages((current) => [...current, { role: 'assistant', content: `Erreur : ${message}` }])
    } finally {
      setSending(false)
    }
  }

  async function refreshActions() {
    const res = await fetch('/api/ai/actions?status=proposed')
    const json = await res.json()
    setActions(json.data ?? [])
  }

  async function actOnAction(actionId: string, decision: 'approve' | 'reject' | 'execute') {
    setBusyAction(`${actionId}:${decision}`)
    try {
      const res = await fetch('/api/ai/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: actionId, decision }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Action impossible')
      toast.success(decision === 'reject' ? 'Action rejetée' : decision === 'execute' ? 'Action exécutée' : 'Action approuvée')
      await refreshActions()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action impossible')
    } finally {
      setBusyAction(null)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Chargement assistant IA...</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Assistant IA</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Copilote Mandat OS</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Un assistant privé connecté aux dossiers. Il prépare, propose et attend ta validation avant toute action.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="h-9 rounded-md border-emerald-200 bg-emerald-50 px-3 text-emerald-700">
            <ShieldCheck className="mr-1 size-4" /> Validation humaine
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-5 text-primary" />
                  Conversation
                </CardTitle>
                <CardDescription>Contexte dossier, réponses métier et propositions d’actions.</CardDescription>
              </div>
              <div className="grid gap-2 md:grid-cols-3 lg:min-w-[620px]">
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Fournisseur IA" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.label}{provider.configured ? '' : ' · non configuré'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dossierId} onValueChange={setDossierId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Dossier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans dossier</SelectItem>
                    {dossiers.map((dossier) => (
                      <SelectItem key={dossier.id} value={dossier.id}>
                        {dossier.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  placeholder={activeProvider?.defaultModel ?? 'Modèle'}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDossier ? (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{selectedDossier.title}</span>
                    <Badge variant="outline" className="rounded-md">{selectedDossier.status}</Badge>
                    {selectedDossier.stats?.documents_missing ? (
                      <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">
                        {selectedDossier.stats.documents_missing} pièce(s) à suivre
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[selectedDossier.client_profile?.first_name, selectedDossier.client_profile?.last_name].filter(Boolean).join(' ') || selectedDossier.client_profile?.email || 'Client non renseigné'}
                  </p>
                </div>
              ) : null}

              <div className="h-[520px] space-y-3 overflow-y-auto rounded-lg border bg-background p-4">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border bg-muted/35 text-foreground'
                    }`}>
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}
                {sending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> L’assistant prépare une réponse...
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ex : Prépare une relance pour les documents manquants, ou résume ce transcript Granola..."
                  className="min-h-24"
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void sendMessage()
                  }}
                />
                <Button variant="primary" className="h-full min-h-24" onClick={() => void sendMessage()} disabled={sending || !input.trim()}>
                  {sending ? <Loader2 className="animate-spin" /> : <Send />}
                  Envoyer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" />
                File de validation
              </CardTitle>
              <CardDescription>Rien ne part sans validation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {actions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                  Aucune action en attente.
                </div>
              ) : actions.map((action) => (
                <div key={action.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{action.title}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{action.description ?? action.action_type}</p>
                    </div>
                    <RiskBadge risk={action.risk_level} />
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock3 className="size-3" /> {new Date(action.created_at).toLocaleString('fr-FR')}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="xs" variant="outline" onClick={() => void actOnAction(action.id, 'approve')} disabled={busyAction === `${action.id}:approve`}>
                      {busyAction === `${action.id}:approve` ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                      Approuver
                    </Button>
                    <Button size="xs" variant="primary" onClick={() => void actOnAction(action.id, 'execute')} disabled={busyAction === `${action.id}:execute`}>
                      {busyAction === `${action.id}:execute` ? <Loader2 className="animate-spin" /> : <Play />}
                      Exécuter
                    </Button>
                    <Button size="xs" variant="destructive" onClick={() => void actOnAction(action.id, 'reject')} disabled={busyAction === `${action.id}:reject`}>
                      {busyAction === `${action.id}:reject` ? <Loader2 className="animate-spin" /> : <X />}
                      Rejeter
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileCheck2 className="size-4 text-primary" />
                Capacités V1
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm text-muted-foreground">
              <p>• Choix fournisseur IA et modèle.</p>
              <p>• Contexte dossier client et documents.</p>
              <p>• Actions internes en validation.</p>
              <p>• Granola classé vers dossier ou revue.</p>
              <p>• Google Workspace prêt via OAuth.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function RiskBadge({ risk }: { risk: AiAction['risk_level'] }) {
  if (risk === 'high') {
    return <Badge variant="outline" className="rounded-md border-red-200 bg-red-50 text-red-700"><CircleAlert className="mr-1 size-3" /> Haut</Badge>
  }
  if (risk === 'low') {
    return <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">Bas</Badge>
  }
  return <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">Moyen</Badge>
}
