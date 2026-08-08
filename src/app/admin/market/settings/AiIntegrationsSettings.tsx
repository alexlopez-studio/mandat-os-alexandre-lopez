'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Mic,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type GoogleConnection = {
  account_email: string | null
  scopes: string[] | null
  expires_at: string | null
  status: string
  last_synced_at: string | null
  last_error: string | null
}

type GoogleState = {
  configured: boolean
  connection: GoogleConnection | null
}

const GOOGLE_ERROR_LABELS: Record<string, string> = {
  invalid_state: 'Session OAuth expirée, relancez la connexion',
  token_refused: 'Google a refusé la demande de jeton',
  storage_error: 'Connexion obtenue mais impossible à enregistrer',
  error: 'Connexion Google impossible',
}

/**
 * Codes d'erreur renvoyés par Google sur le callback OAuth.
 * La distinction est essentielle : un refus de l'utilisateur se rejoue d'un
 * clic, un blocage par la politique du domaine impose de passer par
 * l'administrateur Workspace.
 */
const GOOGLE_OAUTH_ERROR_LABELS: Record<string, string> = {
  access_denied: 'Autorisation refusée. Si l’écran affichait « application non validée », passez par « Paramètres avancés » pour continuer.',
  admin_policy_enforced:
    'Votre administrateur Google Workspace bloque cette application. Il doit autoriser son ID client dans la console d’administration.',
  disallowed_useragent: 'Navigateur non autorisé par Google pour ce flux OAuth.',
  org_internal: 'Ce compte n’appartient pas à l’organisation autorisée pour cette application.',
  invalid_scope: 'Un des accès demandés n’est pas autorisé pour ce compte.',
  redirect_uri_mismatch:
    'URI de redirection non déclaré dans Google Cloud Console pour cet ID client.',
}

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

const PROVIDER_METADATA: Record<string, { desc: string; badge: string; iconColor: string }> = {
  deepseek: { desc: 'Ultra rapide, puissant et extrêmement économique pour l’immobilier.', badge: 'Recommandé', iconColor: 'text-sky-600' },
  openrouter: { desc: 'Passerelle universelle donnant accès à +100 modèles IA.', badge: 'Multi-modèles', iconColor: 'text-indigo-600' },
  openai: { desc: 'Modèles officiels ChatGPT (GPT-4o et GPT-4o-mini).', badge: 'Standard', iconColor: 'text-emerald-600' },
  anthropic: { desc: 'Excellence rédactionnelle avec Claude 3.5 Sonnet.', badge: 'Rédaction', iconColor: 'text-amber-600' },
  groq: { desc: 'Vitesse de réponse instantanée avec Llama 3.', badge: 'Haute vitesse', iconColor: 'text-orange-600' },
}

export function AiIntegrationsSettings({ mode = 'all' }: { mode?: 'ia' | 'integrations' | 'all' }) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [defaultProviderId, setDefaultProviderId] = useState('openrouter')
  const [defaultModel, setDefaultModel] = useState('')
  const [loading, setLoading] = useState(true)

  // Dialog State
  const [activeModalProvider, setActiveModalProvider] = useState<Provider | null>(null)
  const [modalApiKey, setModalApiKey] = useState('')
  const [modalModel, setModalModel] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [savingCredential, setSavingCredential] = useState(false)

  // Granola State
  const [granolaKey, setGranolaKey] = useState('')
  const [syncingGranola, setSyncingGranola] = useState(false)

  // Google State
  const [google, setGoogle] = useState<GoogleState>({ configured: false, connection: null })
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)
  // Un toast disparaît ; le motif de refus doit rester lisible sur la carte,
  // c'est lui qui dit s'il faut passer par l'administrateur du domaine.
  const [googleOauthError, setGoogleOauthError] = useState<string | null>(null)
  const [testingGoogle, setTestingGoogle] = useState(false)
  const [scanningEmails, setScanningEmails] = useState(false)

  async function handleScanEmails() {
    setScanningEmails(true)
    try {
      const res = await fetch('/api/cron/scan-emails', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors du scan')

      if (data.createdCount > 0) {
        toast.success(`${data.createdCount} nouveau(x) projet(s) acquéreur(s) créé(s) depuis vos e-mails !`)
      } else {
        toast.info(`Scan e-mails terminé : aucun nouvel acquéreur à importer (${data.totalFound || 0} e-mail(s) vérifié(s)).`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Impossible de scanner la boîte Gmail')
    } finally {
      setScanningEmails(false)
    }
  }

  async function testGoogle() {
    setTestingGoogle(true)
    try {
      const res = await fetch('/api/integrations/google/test')
      const json = await res.json()
      const checks: Array<{ label: string; ok: boolean; detail: string | null }> = json.checks ?? []

      if (json.success) {
        toast.success(`Google opérationnel : ${checks.map((c) => c.label).join(', ')}`)
      } else if (checks.length > 0) {
        const failed = checks.filter((c) => !c.ok)
        toast.error(
          `Échec : ${failed.map((c) => `${c.label} (${c.detail ?? 'erreur'})`).join(' · ')}`,
          { duration: 12000 },
        )
      } else {
        toast.error(json.error ?? 'Test Google impossible')
      }
      await loadGoogle()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test Google impossible')
    } finally {
      setTestingGoogle(false)
    }
  }

  async function loadGoogle() {
    try {
      const res = await fetch('/api/integrations/google')
      const json = await res.json()
      if (res.ok && json.success) {
        setGoogle({ configured: Boolean(json.configured), connection: json.connection ?? null })
      }
    } catch (err) {
      console.error('[AiIntegrationsSettings] Google:', err)
    }
  }

  async function disconnectGoogle() {
    if (!window.confirm('Déconnecter le compte Google ? L’autorisation sera révoquée chez Google.')) return
    setDisconnectingGoogle(true)
    try {
      const res = await fetch('/api/integrations/google', { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Déconnexion impossible')
      toast.success('Compte Google déconnecté')
      await loadGoogle()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Déconnexion impossible')
    } finally {
      setDisconnectingGoogle(false)
    }
  }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/providers')
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Chargement impossible')
      setProviders(json.data.providers ?? [])
      setCredentials(json.data.credentials ?? [])
      setDefaultProviderId(json.data.defaults?.providerId ?? 'openrouter')
      setDefaultModel(json.data.defaults?.model ?? json.data.providers?.[0]?.defaultModel ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement IA impossible')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void loadGoogle()
  }, [])

  // Retour du flux OAuth : `?google=…` porte le résultat, on l'annonce puis on
  // nettoie l'URL pour ne pas rejouer le toast à chaque rendu.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const status = params.get('google')
    if (!status) return

    if (status === 'connected') {
      toast.success('Compte Google connecté')
    } else if (status === 'missing_config') {
      toast.error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants')
    } else if (status === 'oauth_error') {
      const code = params.get('code') ?? ''
      const label = GOOGLE_OAUTH_ERROR_LABELS[code]
      // Le code brut est conservé quand il est inconnu : il est indispensable
      // pour diagnostiquer côté Google Cloud.
      toast.error(label ?? `Google a refusé la connexion (${code || 'motif inconnu'})`, {
        duration: 12000,
      })
      setGoogleOauthError(label ? `${label} (${code})` : code || 'motif inconnu')
    } else {
      toast.error(GOOGLE_ERROR_LABELS[status] ?? 'Connexion Google impossible')
    }

    params.delete('google')
    params.delete('code')
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
    window.history.replaceState({}, '', next)
    void loadGoogle()
  }, [])

  const credentialsMap = useMemo(() => {
    const map = new Map<string, Credential>()
    for (const c of credentials) {
      map.set(c.provider_id, c)
    }
    return map
  }, [credentials])

  const configuredProviders = useMemo(() => {
    return providers.filter((p) => credentialsMap.has(p.id))
  }, [providers, credentialsMap])

  const unconfiguredProviders = useMemo(() => {
    return providers.filter((p) => !credentialsMap.has(p.id))
  }, [providers, credentialsMap])

  function openConfigureModal(provider: Provider) {
    const cred = credentialsMap.get(provider.id)
    setActiveModalProvider(provider)
    setModalApiKey('')
    setModalModel(cred?.default_model || provider.defaultModel || '')
    setShowApiKey(false)
  }

  async function saveCredential() {
    if (!activeModalProvider || !modalApiKey.trim()) return
    setSavingCredential(true)
    try {
      const res = await fetch('/api/ai/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: activeModalProvider.id,
          api_key: modalApiKey.trim(),
          default_model: modalModel,
          test: true,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Enregistrement impossible')
      
      if (json.data.test?.ok === false) {
        toast.error(`Clé enregistrée mais le test a échoué : ${json.data.test.error}`)
      } else {
        toast.success(`Connexion à ${activeModalProvider.label} réussie !`)
      }
      setActiveModalProvider(null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur enregistrement clé')
    } finally {
      setSavingCredential(false)
    }
  }

  async function setAsDefaultProvider(pId: string, modelChoice?: string) {
    const p = providers.find((item) => item.id === pId)
    const cred = credentialsMap.get(pId)
    const targetModel = modelChoice || cred?.default_model || p?.defaultModel || ''

    try {
      const res = await fetch('/api/ai/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: pId, model: targetModel }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Réglage impossible')
      toast.success(`${p?.label || 'Fournisseur'} défini comme moteur IA principal`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Réglage impossible')
    }
  }

  async function revokeCredential(credId: string, providerName: string) {
    if (!confirm(`Voulez-vous révoquer la clé API pour ${providerName} ?`)) return
    try {
      const res = await fetch(`/api/ai/credentials?id=${encodeURIComponent(credId)}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Révocation impossible')
      toast.success(`Clé ${providerName} révoquée`)
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
    return (
      <div className="rounded-2xl border bg-card p-8 shadow-xs flex items-center justify-center h-48 text-xs text-muted-foreground font-medium">
        <Loader2 className="animate-spin size-5 mr-2 text-primary" /> Chargement des services...
      </div>
    )
  }

  const showIaSection = mode === 'ia' || mode === 'all'
  const showIntegrationsSection = mode === 'integrations' || mode === 'all'

  return (
    <div className="space-y-6">
      {showIaSection && (
        <>
          {/* Active AI Banner Card */}
          <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">Moteur IA Actif du Copilote</h2>
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  Ce moteur IA répond à vos questions et prépare vos actions dans l'Assistant IA ainsi que sur le Copilote Telegram.
                </p>
              </div>

              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-xs self-start sm:self-auto">
                Moteur actuel : {providers.find(p => p.id === defaultProviderId)?.label || defaultProviderId} ({defaultModel})
              </Badge>
            </div>
          </div>

          {/* Services AI Grid (Configured Only) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Fournisseurs IA configurés ({configuredProviders.length})
              </h3>

              {/* Add New Provider Dropdown Button */}
              {unconfiguredProviders.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4 shadow-xs">
                      <Plus className="mr-1.5 size-4" /> Ajouter un fournisseur IA
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5 shadow-md">
                    {unconfiguredProviders.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => openConfigureModal(p)}
                        className="rounded-lg text-xs font-bold py-2 cursor-pointer"
                      >
                        + Configurer {p.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {configuredProviders.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card p-8 text-center space-y-3 flex flex-col items-center justify-center">
                <Bot className="size-8 text-muted-foreground/50" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">Aucun fournisseur IA configuré</h4>
                  <p className="text-xs text-muted-foreground font-medium">
                    Ajoutez votre premier fournisseur (DeepSeek, OpenAI, OpenRouter...) pour activer l'IA.
                  </p>
                </div>
                {unconfiguredProviders.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="h-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 shadow-xs">
                        <Plus className="mr-1.5 size-4" /> Configurer un fournisseur IA
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-56 rounded-xl p-1.5 shadow-md">
                      {unconfiguredProviders.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => openConfigureModal(p)}
                          className="rounded-lg text-xs font-bold py-2 cursor-pointer"
                        >
                          + Configurer {p.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {configuredProviders.map((p) => {
                  const cred = credentialsMap.get(p.id)
                  const isConfigured = Boolean(cred && cred.status === 'active')
                  const isError = Boolean(cred && cred.status === 'error')
                  const isDefault = defaultProviderId === p.id
                  const meta = PROVIDER_METADATA[p.id] || { desc: 'Modèle de traitement d’IA.', badge: 'IA', iconColor: 'text-primary' }

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all hover:border-primary/40 hover:shadow-sm",
                        isDefault && "border-primary/50 ring-1 ring-primary/20"
                      )}
                    >
                      <div className="space-y-3">
                        {/* Top Row: Icon + Name + Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("size-10 rounded-full bg-muted/60 flex items-center justify-center font-bold shadow-xs", meta.iconColor)}>
                              <Bot className="size-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-foreground">{p.label}</h4>
                                <Badge variant="secondary" className="text-[10px] font-bold rounded-full px-2 py-0">
                                  {meta.badge}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground font-medium mt-0.5 line-clamp-2">
                                {meta.desc}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Status Indicator */}
                        <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground font-medium">Statut :</span>
                            {isConfigured ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                <CheckCircle2 className="size-3.5" /> Connecté ({cred?.masked_key})
                              </span>
                            ) : isError ? (
                              <span className="inline-flex items-center gap-1 text-destructive font-bold">
                                Clé invalide
                              </span>
                            ) : (
                              <span className="text-muted-foreground italic">Non configuré</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-0.5">
                            <span className="text-muted-foreground font-medium">Modèle :</span>
                            <span className="font-bold text-foreground truncate max-w-[180px]">{cred?.default_model || p.defaultModel}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openConfigureModal(p)}
                            className="h-8 rounded-full text-xs font-semibold"
                          >
                            <KeyRound className="size-3.5 mr-1" /> Modifier
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cred && revokeCredential(cred.id, p.label)}
                            className="h-8 rounded-full text-xs text-destructive hover:text-destructive p-2"
                            title="Révoquer la clé"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>

                        {isDefault ? (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-bold rounded-full text-[10px]">
                            Moteur actif
                          </Badge>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setAsDefaultProvider(p.id)}
                            className="h-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-3 shadow-xs"
                          >
                            Activer comme moteur principal
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {showIntegrationsSection && (
        <div className="space-y-5">
          <div className="border-b pb-3 space-y-1">
            <h2 className="text-base font-bold text-foreground">Intégrations & Connecteurs Externes</h2>
            <p className="text-xs text-muted-foreground font-medium">
              Connecteurs externes pour synchroniser votre messagerie, vos comptes rendus et Telegram.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Telegram Bot Card */}
            <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between space-y-6 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 flex items-center justify-center font-bold shadow-xs">
                    <Send className="size-5" />
                  </div>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-bold rounded-full text-[10px] px-2.5 py-0.5">
                    Connecté
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-base text-foreground">Telegram Copilote</h4>
                  <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">
                    Assistant mobile vocal & textuel connecté directement à votre CRM Mandat OS.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t">
                <Button variant="outline" className="w-full h-9 rounded-full font-bold text-xs border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50 px-3">
                  <CheckCircle2 className="size-3.5 mr-1.5 shrink-0 text-emerald-600" />
                  <span className="truncate">Bot Telegram actif</span>
                </Button>
              </div>
            </div>

            {/* Google Workspace Card */}
            <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between space-y-6 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 flex items-center justify-center font-bold shadow-xs">
                    <ShieldCheck className="size-5" />
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-bold rounded-full text-[10px] px-2.5 py-0.5',
                      google.connection
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {google.connection ? 'Connecté' : 'Non connecté'}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-base text-foreground">Google Workspace</h4>
                  <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">
                    {google.connection?.account_email
                      ? google.connection.account_email
                      : 'Connexion sécurisée à Gmail, Agenda et Drive.'}
                  </p>
                  {!google.configured && (
                    <p className="text-xs text-amber-700 font-medium mt-2 leading-relaxed">
                      Identifiants OAuth absents : renseignez GOOGLE_CLIENT_ID et
                      GOOGLE_CLIENT_SECRET dans l’environnement.
                    </p>
                  )}
                  {google.connection?.last_error && (
                    <p className="text-xs text-destructive font-medium mt-2 leading-relaxed">
                      {google.connection.last_error}
                    </p>
                  )}
                  {googleOauthError && !google.connection && (
                    <p className="text-xs text-destructive font-medium mt-2 leading-relaxed">
                      {googleOauthError}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t">
                {google.connection ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={testGoogle}
                        disabled={testingGoogle}
                        className="flex-1 h-9 rounded-full font-bold text-xs px-3"
                      >
                        {testingGoogle ? (
                          <Loader2 className="size-3.5 mr-1.5 shrink-0 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3.5 mr-1.5 shrink-0" />
                        )}
                        <span className="truncate">Tester</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={disconnectGoogle}
                        disabled={disconnectingGoogle}
                        className="flex-1 h-9 rounded-full font-bold text-xs px-3 text-destructive hover:text-destructive"
                      >
                        {disconnectingGoogle ? (
                          <Loader2 className="size-3.5 mr-1.5 shrink-0 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5 mr-1.5 shrink-0" />
                        )}
                        <span className="truncate">Déconnecter</span>
                      </Button>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleScanEmails}
                      disabled={scanningEmails}
                      className="w-full h-9 rounded-full font-bold text-xs px-3"
                    >
                      {scanningEmails ? (
                        <Loader2 className="size-3.5 mr-1.5 shrink-0 animate-spin" />
                      ) : (
                        <Mail className="size-3.5 mr-1.5 shrink-0 text-primary" />
                      )}
                      <span className="truncate">Scanner les e-mails acquéreurs</span>
                    </Button>
                  </div>
                ) : google.configured ? (
                  <Button
                    asChild
                    className="w-full h-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-xs px-3"
                  >
                    <a href="/api/integrations/google/oauth/start" className="inline-flex items-center justify-center min-w-0">
                      <ShieldCheck className="size-3.5 mr-1.5 shrink-0" />
                      <span className="truncate">Connecter Google</span>
                    </a>
                  </Button>
                ) : (
                  // Sans identifiants OAuth le flux échoue : on rend un vrai
                  // bouton désactivé, un <a> ignorerait l'attribut `disabled`.
                  <Button
                    disabled
                    className="w-full h-9 rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-xs px-3"
                  >
                    <ShieldCheck className="size-3.5 mr-1.5 shrink-0" />
                    <span className="truncate">Connecter Google</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Granola Card */}
            <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col justify-between space-y-6 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 flex items-center justify-center font-bold shadow-xs">
                    <Mic className="size-5" />
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-bold rounded-full text-[10px] px-2.5 py-0.5",
                      granolaKey.trim()
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {granolaKey.trim() ? "Connecté" : "Non connecté"}
                  </Badge>
                </div>

                <div>
                  <h4 className="font-bold text-base text-foreground">Granola</h4>
                  <p className="text-xs text-muted-foreground font-medium mt-1 leading-relaxed">
                    Importation automatique des transcripts d'appels et résumés de réunion.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clé API Granola</Label>
                  <Input
                    value={granolaKey}
                    onChange={(event) => setGranolaKey(event.target.value)}
                    type="password"
                    placeholder="grn_..."
                    autoComplete="off"
                    className="h-9 rounded-xl bg-background text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t">
                <Button
                  onClick={() => void syncGranola()}
                  disabled={syncingGranola || !granolaKey.trim()}
                  className={cn(
                    "w-full h-9 rounded-full font-bold text-xs transition-all px-3",
                    granolaKey.trim()
                      ? "border border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-50"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                  )}
                >
                  {syncingGranola ? <Loader2 className="animate-spin size-3.5 mr-1.5 shrink-0" /> : <RefreshCw className="size-3.5 mr-1.5 shrink-0" />}
                  <span className="truncate">{granolaKey.trim() ? "Synchroniser" : "Connecter Granola"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Configuration Modal */}
      {activeModalProvider && (
        <Dialog open={Boolean(activeModalProvider)} onOpenChange={() => setActiveModalProvider(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-6 border bg-card">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                Configurer {activeModalProvider.label}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Saisissez votre clé API pour activer ce fournisseur d'intelligence artificielle.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Help Link */}
              <div className="rounded-xl bg-muted/40 p-3 text-xs flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Vous n'avez pas de clé ?</span>
                <a
                  href={activeModalProvider.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  Obtenir une clé {activeModalProvider.label} <ExternalLink className="size-3" />
                </a>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clé API Secret</Label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={modalApiKey}
                    onChange={(e) => setModalApiKey(e.target.value)}
                    placeholder={`Saisir la clé API ${activeModalProvider.label}...`}
                    className="h-10 rounded-xl pr-10 bg-background text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Model Choice */}
              {activeModalProvider.models.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modèle Recommandé</Label>
                  <Select value={modalModel} onValueChange={setModalModel}>
                    <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                      <SelectValue placeholder="Choisir un modèle..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeModalProvider.models.map((m) => (
                        <SelectItem key={m} value={m} className="text-xs font-medium">
                          {m} {m === activeModalProvider.defaultModel ? '(Recommandé)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveModalProvider(null)} className="rounded-full">
                Annuler
              </Button>
              <Button
                onClick={() => void saveCredential()}
                disabled={savingCredential || !modalApiKey.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold px-5"
              >
                {savingCredential && <Loader2 className="mr-2 size-4 animate-spin" />}
                Enregistrer & Tester
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
