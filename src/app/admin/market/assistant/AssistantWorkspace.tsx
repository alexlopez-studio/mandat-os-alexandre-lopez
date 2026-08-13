'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  FolderOpen,
  Home,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PageHeader, PageLayout, PageSection } from '@/components/pro'
import { formatProjectLabel } from '@/lib/project-stages'
import { cn } from '@/lib/utils'

type ProjectRow = {
  id: string
  kind: 'vente' | 'achat'
  title?: string
  display_title?: string
  /** Reference prononcable "AA-NNN", figee a la creation. */
  reference?: string | null
  stage?: string | null
  property_city?: string | null
  communes?: string[] | null
  next_action?: string | null
  contacts?: Array<{ name: string; role?: string }>
}

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ThreadItem = {
  id: string
  title: string
  dossier_id: string | null
  created_at: string
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Bonjour Alexandre. Sélectionnez un projet de vente ou d’achat dans le volet de droite pour que j’analyse ses données et documents, puis posez-moi vos questions.',
}

export function AssistantWorkspace() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [projectId, setProjectId] = useState<string>('none')
  const [projectKindFilter, setProjectKindFilter] = useState<'all' | 'vente' | 'achat'>('all')
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projects, projectId]
  )

  const filteredProjects = useMemo(() => {
    if (projectKindFilter === 'all') return projects
    return projects.filter((p) => p.kind === projectKindFilter)
  }, [projects, projectKindFilter])

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/threads')
      if (!res.ok) return
      const json = await res.json()
      setThreads(json.data ?? [])
    } catch (err) {
      console.error('Erreur chargement de l\'historique', err)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projectsRes] = await Promise.all([
        fetch('/api/market/projects?active=all'),
        loadThreads(),
      ])
      const projectsJson = await projectsRes.json()
      setProjects(projectsJson.projects ?? [])
    } catch (err) {
      console.error(err)
      toast.error('Chargement des projets impossible')
    } finally {
      setLoading(false)
    }
  }, [loadThreads])

  useEffect(() => {
    void load()
  }, [load])

  const newConversation = () => {
    setThreadId(null)
    setMessages([INITIAL_MESSAGE])
    setInput('')
    toast.info('Nouvelle conversation démarrée')
  }

  const selectThread = async (id: string) => {
    if (loadingThreadId || threadId === id) return
    setLoadingThreadId(id)
    try {
      const res = await fetch(`/api/ai/threads/${id}`)
      if (!res.ok) throw new Error('Impossible de charger la conversation')
      const json = await res.json()
      setThreadId(id)
      setMessages(json.data.messages.length > 0 ? json.data.messages : [INITIAL_MESSAGE])
      if (json.data.thread.dossier_id) {
        setProjectId(json.data.thread.dossier_id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur chargement')
    } finally {
      setLoadingThreadId(null)
    }
  }

  const deleteThread = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/ai/threads/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur lors de la suppression')
      toast.success('Conversation supprimée')
      if (threadId === id) {
        newConversation()
      }
      await loadThreads()
    } catch {
      toast.error('Impossible de supprimer la conversation')
    }
  }

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
          dossier_id: projectId === 'none' ? null : projectId,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Réponse impossible')
      setThreadId(json.data.thread_id)
      setMessages((current) => [...current, { role: 'assistant', content: json.data.answer }])
      await loadThreads()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur assistant'
      toast.error(message)
      setMessages((current) => [...current, { role: 'assistant', content: `Erreur : ${message}` }])
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <PageLayout width="wide">
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground font-medium">
          <Loader2 className="animate-spin size-5 text-primary" /> Chargement de l'assistant IA...
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Assistant IA"
        title="Copilote Mandat OS"
        description="Un assistant privé connecté à vos projets de vente et d'achat pour répondre à vos questions et analyser vos dossiers."
      />

      <PageSection>
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Chat Area */}
          <div className="space-y-6 lg:col-span-8">
            <div className="rounded-2xl border bg-card p-6 shadow-xs flex flex-col h-[720px]">
              
              {/* Toolbar header */}
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Conversation</h2>
                    <p className="text-xs text-muted-foreground font-medium">
                      {selectedProject ? `Contexte actif : ${formatProjectLabel(selectedProject.reference, selectedProject.display_title || selectedProject.title)}` : 'Aucun projet sélectionné (conversation générale)'}
                    </p>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={newConversation} className="rounded-full font-semibold text-xs">
                  <Plus className="mr-1.5 size-3.5" /> Nouvelle conversation
                </Button>
              </div>

              {selectedProject ? (
                <div className="rounded-xl border bg-muted/40 p-3 text-xs mb-4 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-bold uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full border-none shadow-none",
                        selectedProject.kind === 'vente'
                          ? "bg-sky-100 text-sky-700"
                          : "bg-emerald-100 text-emerald-700"
                      )}
                    >
                      PROJET {selectedProject.kind === 'achat' ? 'ACHAT' : 'VENTE'}
                    </Badge>
                    <span className="font-bold text-foreground">{formatProjectLabel(selectedProject.reference, selectedProject.display_title || selectedProject.title)}</span>
                    {selectedProject.stage && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-none rounded-full text-[10px] font-bold">
                        {selectedProject.stage}
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setProjectId('none')} className="h-6 text-[10px] text-muted-foreground hover:text-foreground">
                    Détacher
                  </Button>
                </div>
              ) : null}

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {messages.map((message, index) => {
                  const isUser = message.role === 'user'
                  return (
                    <div key={`${message.role}-${index}`} className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}>
                      {!isUser && (
                        <Avatar className="size-8 shrink-0 mt-0.5">
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs"><Bot className="size-4" /></AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs",
                        isUser 
                          ? "bg-primary text-primary-foreground font-medium rounded-tr-xs" 
                          : "border bg-card text-foreground font-medium rounded-tl-xs"
                      )}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {isUser && (
                        <Avatar className="size-8 shrink-0 mt-0.5">
                          <AvatarFallback className="bg-muted text-muted-foreground font-bold text-xs"><User className="size-4" /></AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  )
                })}
                {sending ? (
                  <div className="flex w-full gap-3 justify-start">
                    <Avatar className="size-8 shrink-0 mt-0.5">
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs"><Bot className="size-4" /></AvatarFallback>
                    </Avatar>
                    <div className="max-w-[80%] rounded-2xl rounded-tl-xs px-4 py-3 text-sm border bg-card text-muted-foreground shadow-xs flex items-center gap-2.5 font-medium">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>L’assistant prépare une réponse...</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Chat Input */}
              <div className="mt-4 flex items-center gap-2 border-t pt-4">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={selectedProject ? `Poser une question sur le projet ${formatProjectLabel(selectedProject.reference, selectedProject.display_title || selectedProject.title)}...` : "Posez une question à l'assistant..."}
                  className="min-h-11 max-h-24 rounded-xl bg-background border-border focus-visible:ring-primary/20 resize-none px-3.5 py-2.5 text-sm outline-none"
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault()
                      void sendMessage()
                    }
                  }}
                />
                <Button 
                  onClick={() => void sendMessage()} 
                  disabled={sending || !input.trim()}
                  className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 text-xs shadow-xs shrink-0"
                >
                  {sending ? <Loader2 className="animate-spin size-4" /> : <Send className="size-4" />}
                  <span className="ml-1.5 hidden sm:inline">Envoyer</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column / Sidebar */}
          <div className="space-y-6 lg:col-span-4">
            {/* Sélection du Projet */}
            <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4 flex flex-col h-[380px]">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-4 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">PROJET RATTACHÉ</h2>
                </div>
                {projectId !== 'none' && (
                  <Button variant="ghost" size="sm" onClick={() => setProjectId('none')} className="h-6 text-[10px] text-muted-foreground hover:text-foreground">
                    Détacher
                  </Button>
                )}
              </div>

              {/* Filter Chips: Tout, Ventes, Achats */}
              <div className="flex items-center gap-1 rounded-full bg-secondary/50 p-1">
                <Button
                  variant={projectKindFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setProjectKindFilter('all')}
                  className="h-7 flex-1 rounded-full text-xs font-bold"
                >
                  <Layers className="mr-1 size-3" /> Tout
                </Button>
                <Button
                  variant={projectKindFilter === 'vente' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setProjectKindFilter('vente')}
                  className="h-7 flex-1 rounded-full text-xs font-bold"
                >
                  <Home className="mr-1 size-3" /> Ventes
                </Button>
                <Button
                  variant={projectKindFilter === 'achat' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setProjectKindFilter('achat')}
                  className="h-7 flex-1 rounded-full text-xs font-bold"
                >
                  <Search className="mr-1 size-3" /> Achats
                </Button>
              </div>

              {/* Select Dropdown to choose a project */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Choisir un projet</span>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-10 text-xs rounded-xl w-full font-medium">
                    <SelectValue placeholder="Sélectionner un projet..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs font-medium">Aucun projet (conversation générale)</SelectItem>
                    {filteredProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs font-medium">
                        [{p.kind === 'achat' ? 'ACHAT' : 'VENTE'}] {formatProjectLabel(p.reference, p.display_title || p.title)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Active Project details & Quick prompt button */}
              <div className="flex-1 overflow-y-auto space-y-3 pt-1">
                {selectedProject ? (
                  <div className="rounded-xl border bg-muted/40 p-3.5 space-y-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-bold uppercase text-[10px] tracking-wider px-2.5 py-0.5 rounded-full border-none shadow-none",
                            selectedProject.kind === 'vente'
                              ? "bg-sky-100 text-sky-700"
                              : "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          PROJET {selectedProject.kind === 'achat' ? 'ACHAT' : 'VENTE'}
                        </Badge>
                        {selectedProject.stage && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary border-none rounded-full px-2 py-0.5 text-[10px] font-bold">
                            {selectedProject.stage}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-bold text-xs text-foreground pt-1 truncate">{formatProjectLabel(selectedProject.reference, selectedProject.display_title || selectedProject.title)}</h3>
                    </div>

                    <Button
                      onClick={() => {
                        const title = formatProjectLabel(selectedProject.reference, selectedProject.display_title || selectedProject.title)
                        setInput(`Fais-moi une analyse complète du projet ${selectedProject.kind === 'achat' ? 'd’achat' : 'de vente'} "${title}" (prochaines étapes et recommandations).`)
                      }}
                      className="w-full h-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-bold shadow-xs"
                    >
                      <Sparkles className="mr-1.5 size-3" /> Interroger l’IA sur ce projet
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
                    <FolderOpen className="size-5 text-muted-foreground/60" />
                    <span>Sélectionnez un projet de vente ou d'achat ci-dessus.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Historique des Conversations */}
            <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-3 flex flex-col h-[320px]">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">HISTORIQUE DES ÉCHANGES</h2>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold">
                  {threads.length}
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {threads.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Aucune conversation enregistrée.
                  </div>
                ) : (
                  threads.map((t) => {
                    const isActive = t.id === threadId
                    return (
                      <div
                        key={t.id}
                        onClick={() => selectThread(t.id)}
                        className={cn(
                          "rounded-xl border p-3 cursor-pointer transition-colors flex items-center justify-between gap-2 group",
                          isActive
                            ? "border-primary bg-primary/5 shadow-xs"
                            : "bg-muted/40 hover:bg-muted/70 border-border/60"
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className={cn("text-xs font-bold truncate", isActive ? "text-primary" : "text-foreground")}>
                            {t.title || 'Conversation IA'}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => deleteThread(t.id, e)}
                          className="size-7 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </PageSection>
    </PageLayout>
  )
}
