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
  User,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

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
    return <div className="p-6 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin size-4" /> Chargement assistant IA...</div>
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 -m-8 p-8 text-slate-900 font-sans">
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-6">
        
        {/* Header Espace Client Style */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-[#00A0E2] uppercase tracking-wider">Assistant IA</span>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Copilote Mandat OS</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Un assistant privé connecté aux dossiers. Il prépare, propose et attend ta validation avant toute action.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-4 py-2.5 rounded-full border border-emerald-100">
              <ShieldCheck className="mr-1 size-4" /> Validation humaine
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} className="rounded-full h-auto py-2.5 bg-white">
              <RefreshCw className="mr-2 size-3.5" />
              Actualiser
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* Main Chat Area */}
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col h-[700px]">
              
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-5 mb-5">
                <div className="flex items-center gap-3">
                  <div className="bg-[#00A0E2]/10 p-2.5 rounded-2xl">
                    <Bot className="size-5 text-[#00A0E2]" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Conversation</h2>
                    <p className="text-xs text-slate-500">Contexte, réponses et actions.</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 lg:min-w-[400px]">
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger className="h-9 text-xs rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Fournisseur IA" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id} className="text-xs">
                          {provider.label}{provider.configured ? '' : ' (non configuré)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={dossierId} onValueChange={setDossierId}>
                    <SelectTrigger className="h-9 text-xs rounded-xl bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Dossier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Sans dossier</SelectItem>
                      {dossiers.map((dossier) => (
                        <SelectItem key={dossier.id} value={dossier.id} className="text-xs">
                          {dossier.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedDossier ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm mb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{selectedDossier.title}</span>
                    <Badge variant="outline" className="rounded-md bg-white">{selectedDossier.status}</Badge>
                    {selectedDossier.stats?.documents_missing ? (
                      <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">
                        {selectedDossier.stats.documents_missing} pièce(s) à suivre
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {[selectedDossier.client_profile?.first_name, selectedDossier.client_profile?.last_name].filter(Boolean).join(' ') || selectedDossier.client_profile?.email || 'Client non renseigné'}
                  </p>
                </div>
              ) : null}

              {/* Chat Messages Shadcn Style */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
                {messages.map((message, index) => {
                  const isUser = message.role === 'user'
                  return (
                    <div key={`${message.role}-${index}`} className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}>
                      {!isUser && (
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5 shadow-sm">
                          <AvatarFallback className="bg-[#00A0E2]/10 text-[#00A0E2]"><Bot className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn(
                        "max-w-[75%] rounded-2xl px-5 py-3 text-sm leading-6 shadow-sm",
                        isUser 
                          ? "bg-slate-900 text-white rounded-tr-sm" 
                          : "border border-slate-100 bg-white text-slate-700 rounded-tl-sm"
                      )}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {isUser && (
                        <Avatar className="h-8 w-8 shrink-0 mt-0.5 shadow-sm">
                          <AvatarFallback className="bg-slate-100 text-slate-600"><User className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )
                })}
                {sending ? (
                  <div className="flex w-full gap-3 justify-start">
                    <Avatar className="h-8 w-8 shrink-0 mt-0.5 shadow-sm">
                      <AvatarFallback className="bg-[#00A0E2]/10 text-[#00A0E2]"><Bot className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-5 py-3 text-sm leading-6 border border-slate-100 bg-white text-slate-700 shadow-sm flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-[#00A0E2]" />
                      <span className="text-slate-500 font-medium">L’assistant prépare une réponse...</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Chat Input */}
              <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] border-t border-slate-100 pt-5">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ex : Prépare une relance pour les documents manquants..."
                  className="min-h-16 rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-[#00A0E2]/20 focus-visible:border-[#00A0E2] resize-none px-4 py-3 text-sm shadow-inner"
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void sendMessage()
                  }}
                />
                <Button 
                  onClick={() => void sendMessage()} 
                  disabled={sending || !input.trim()}
                  className="h-full min-h-16 rounded-2xl bg-[#00A0E2] hover:bg-[#008AC5] text-white shadow-md transition-all active:scale-95 px-6"
                >
                  {sending ? <Loader2 className="animate-spin size-5" /> : <Send className="size-5" />}
                  <span className="ml-2 font-bold">Envoyer</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <aside className="flex flex-col gap-6">
            <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-6 overflow-hidden flex flex-col h-[520px]">
              <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
                <div className="bg-emerald-50 p-2.5 rounded-2xl">
                  <Sparkles className="size-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">File de validation</h2>
                  <p className="text-xs text-slate-500">Rien ne part sans validation.</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                {actions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center flex flex-col items-center gap-2">
                    <CheckCircle2 className="size-8 text-slate-300" />
                    <span className="text-sm font-medium text-slate-500">Aucune action en attente.</span>
                  </div>
                ) : actions.map((action) => (
                  <div key={action.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{action.title}</p>
                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{action.description ?? action.action_type}</p>
                      </div>
                      <RiskBadge risk={action.risk_level} />
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                      <Clock3 className="size-3.5" /> {new Date(action.created_at).toLocaleString('fr-FR')}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg flex-1 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => void actOnAction(action.id, 'approve')} disabled={busyAction === `${action.id}:approve`}>
                        {busyAction === `${action.id}:approve` ? <Loader2 className="animate-spin size-3 mr-1.5" /> : <CheckCircle2 className="size-3 mr-1.5" />}
                        Approuver
                      </Button>
                      <Button size="sm" className="h-8 text-xs rounded-lg flex-1 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => void actOnAction(action.id, 'execute')} disabled={busyAction === `${action.id}:execute`}>
                        {busyAction === `${action.id}:execute` ? <Loader2 className="animate-spin size-3 mr-1.5" /> : <Play className="size-3 mr-1.5 fill-current" />}
                        Exécuter
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => void actOnAction(action.id, 'reject')} disabled={busyAction === `${action.id}:reject`}>
                        {busyAction === `${action.id}:reject` ? <Loader2 className="animate-spin size-3 mr-1.5" /> : <X className="size-3 mr-1.5" />}
                        Rejeter
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-slate-50 p-2 rounded-xl">
                  <FileCheck2 className="size-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Capacités actuelles</h2>
              </div>
              <ul className="grid gap-2.5 text-xs text-slate-500 font-medium">
                <li className="flex items-start gap-2"><div className="mt-1 size-1.5 rounded-full bg-[#00A0E2]" /> Choix fournisseur IA et modèle</li>
                <li className="flex items-start gap-2"><div className="mt-1 size-1.5 rounded-full bg-[#00A0E2]" /> Contexte dossier client et documents</li>
                <li className="flex items-start gap-2"><div className="mt-1 size-1.5 rounded-full bg-[#00A0E2]" /> Actions internes en validation</li>
                <li className="flex items-start gap-2"><div className="mt-1 size-1.5 rounded-full bg-slate-300" /> Granola classé vers dossier ou revue</li>
                <li className="flex items-start gap-2"><div className="mt-1 size-1.5 rounded-full bg-slate-300" /> Google Workspace prêt via OAuth</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function RiskBadge({ risk }: { risk: AiAction['risk_level'] }) {
  if (risk === 'high') {
    return <Badge variant="outline" className="rounded-md border-red-200 bg-red-50 text-red-700 shadow-none"><CircleAlert className="mr-1 size-3" /> Haut</Badge>
  }
  if (risk === 'low') {
    return <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700 shadow-none">Bas</Badge>
  }
  return <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700 shadow-none">Moyen</Badge>
}
