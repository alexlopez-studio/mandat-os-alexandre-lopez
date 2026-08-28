'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  Building2,
  CheckCircle2,
  Clock,
  FolderOpen,
  HelpCircle,
  Home,
  Layers,
  Loader2,
  Mic,
  MicOff,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type ProjectItem = {
  id: string
  kind: 'vente' | 'achat'
  title?: string
  display_title?: string
  reference?: string | null
  stage?: string | null
  property_city?: string | null
  communes?: string[] | null
  next_action?: string | null
  contacts?: Array<{ name: string; role?: string }>
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
}

export type ThreadItem = {
  id: string
  title: string
  dossier_id: string | null
  created_at: string
}

interface CopilotePanelProps {
  embedded?: boolean
  initialProjectId?: string
  className?: string
}

const CAPABILITIES = [
  {
    icon: '📁',
    title: 'Croisement de dossiers',
    desc: 'Recherche dans vos mandats, estimations, contacts et critères acquéreurs.',
  },
  {
    icon: '📅',
    title: 'Agenda & Rendez-vous',
    desc: 'Consulte votre emploi du temps et prépare vos visites ou points clients.',
  },
  {
    icon: '✉️',
    title: 'Mails & Rédaction',
    desc: 'Rédige des emails de relance personnalisés, comptes-rendus ou synthèses.',
  },
  {
    icon: '📊',
    title: 'Analyses de marché',
    desc: 'Compare les prix DVF, les biens vendus sur votre secteur et calcule les décotes.',
  },
]

export function CopilotePanel({
  embedded = false,
  initialProjectId = 'none',
  className,
}: CopilotePanelProps) {
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [projectId, setProjectId] = useState<string>(initialProjectId)
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [proposedActions, setProposedActions] = useState<any[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Load Projects & Threads
  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/threads')
      if (!res.ok) return
      const json = await res.json()
      setThreads(json.data ?? [])
    } catch {
      // silent
    }
  }, [])

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/market/projects?active=all')
      if (!res.ok) return
      const json = await res.json()
      setProjects(json.projects ?? [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    void loadProjects()
    void loadThreads()
  }, [loadProjects, loadThreads])

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'fr-FR'

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
          setIsListening(false)
        }

        recognition.onerror = () => setIsListening(false)
        recognition.onend = () => setIsListening(false)

        recognitionRef.current = recognition
      }
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.info('La reconnaissance vocale n’est pas disponible sur votre navigateur.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setIsListening(true)
        toast.info('Écoute en cours… parlez maintenant.')
      } catch {
        setIsListening(false)
      }
    }
  }

  const selectThread = async (id: string) => {
    if (loadingThreadId || threadId === id) return
    setLoadingThreadId(id)
    try {
      const res = await fetch(`/api/ai/threads/${id}`)
      if (!res.ok) throw new Error('Impossible de charger la conversation')
      const json = await res.json()
      setThreadId(id)
      setMessages(json.data.messages.length > 0 ? json.data.messages : [])
      if (json.data.thread.dossier_id) {
        setProjectId(json.data.thread.dossier_id)
      }
      setHistoryOpen(false)
      toast.success(`Session chargée : ${json.data.thread.title}`)
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
        handleNewThread()
      }
      await loadThreads()
    } catch {
      toast.error('Impossible de supprimer la conversation')
    }
  }

  const sendMessage = async (overrideMessage?: string) => {
    const textToSend = (overrideMessage || input).trim()
    if (!textToSend || loading) return

    const userMessage: ChatMessage = { role: 'user', content: textToSend }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          thread_id: threadId,
          dossier_id: projectId === 'none' ? null : projectId,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Erreur assistant IA')
      }

      if (json.data?.thread_id) {
        setThreadId(json.data.thread_id)
        void loadThreads()
      }

      const assistantContent = json.data?.answer || "Je n'ai pas pu formuler de réponse."
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
      }

      if (json.data?.proposed_actions?.length) {
        setProposedActions(json.data.proposed_actions)
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Erreur assistant'
      toast.error(errMessage)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Désolé, une erreur est survenue : ${errMessage}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleNewThread = () => {
    setMessages([])
    setThreadId(null)
    setProposedActions([])
    setInput('')
    toast.success('Nouvelle conversation démarrée')
  }

  // Quick prompt suggestions
  const quickSuggestions = useMemo(() => {
    if (selectedProject) {
      return [
        `Résumer le dossier ${selectedProject.reference || selectedProject.display_title || ''}`,
        'Quelles sont les prochaines étapes ?',
        'Rédiger un email de suivi',
        'Comparer les prix de ce secteur',
      ]
    }
    return [
      'Quels sont mes rendez-vous du jour ?',
      'Quelles sont les opportunités à relancer ?',
      'Rédiger un email de prospection',
      'Faire le point sur les mandats en cours',
    ]
  }, [selectedProject])

  const salesProjects = useMemo(() => projects.filter((p) => p.kind === 'vente'), [projects])
  const buyerProjects = useMemo(() => projects.filter((p) => p.kind === 'achat'), [projects])

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-3xl border border-border/80 bg-card p-6 shadow-sm h-160 max-h-160 overflow-hidden',
        className
      )}
    >
      {/* Header with Project Selector */}
      <div className="space-y-4 border-b border-border/60 pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mini 3D glowing orb icon */}
            <div className="relative size-6 rounded-full bg-gradient-to-br from-indigo-400 via-purple-500 to-blue-600 ring-2 ring-primary/20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-primary-foreground/30 to-transparent" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Copilote</span>
              <span className="inline-block size-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
              <span className="text-xs text-muted-foreground font-medium">actif</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCapabilitiesOpen(true)}
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              title="Capacités"
            >
              <HelpCircle className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHistoryOpen(true)}
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              title="Historique des discussions"
            >
              <Clock className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewThread}
              className="size-8 rounded-full text-muted-foreground hover:text-foreground"
              title="Nouvelle conversation"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        </div>

        {/* Project Selection Dropdown */}
        <div className="flex items-center gap-2">
          <Select value={projectId} onValueChange={(val) => setProjectId(val)}>
            <SelectTrigger className="h-8 w-full rounded-xl bg-background/90 text-xs font-semibold text-foreground border-border">
              <div className="flex items-center gap-2 truncate">
                <FolderOpen className="size-3.5 text-primary shrink-0" />
                <SelectValue placeholder="Sélectionner un projet..." />
              </div>
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none" className="text-xs font-semibold">
                ✨ Mode global (Tous les dossiers)
              </SelectItem>

              {salesProjects.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Projets de vente ({salesProjects.length})
                  </SelectLabel>
                  {salesProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      🏠 {p.reference ? `${p.reference} · ` : ''}{p.display_title || p.title || p.property_city || 'Vente'}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}

              {buyerProjects.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Projets d'achat ({buyerProjects.length})
                  </SelectLabel>
                  {buyerProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      🔍 {p.reference ? `${p.reference} · ` : ''}{p.display_title || p.title || (p.communes?.join(', ') || 'Achat')}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          {selectedProject && (
            <Badge variant="outline" className="text-xs font-bold shrink-0 capitalize">
              {selectedProject.kind === 'vente' ? 'Vente' : 'Achat'}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Conversation Stream or Empty State with strict scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto py-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center space-y-4 px-4">
            {/* Large 3D glowing sphere */}
            <div className="relative my-2">
              <div className="size-24 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-400 p-0.5 shadow-sm ring-4 ring-indigo-500/10 animate-pulse">
                <div className="size-full rounded-full bg-gradient-to-br from-indigo-400 via-purple-600 to-blue-700 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute top-2 left-4 size-8 rounded-full bg-primary-foreground/40 blur-xs" />
                  <div className="absolute bottom-2 right-4 size-6 rounded-full bg-indigo-950/40 blur-xs" />
                </div>
              </div>
            </div>

            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-bold text-foreground">
                {selectedProject
                  ? `Analyse du projet ${selectedProject.reference || selectedProject.display_title || ''}`
                  : 'Comment puis-je vous aider ?'}
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {selectedProject
                  ? `Je suis branché sur ce dossier (${selectedProject.kind === 'vente' ? 'Vente' : 'Achat'} · ${selectedProject.property_city || selectedProject.communes?.join(', ') || 'Secteur'}). Posez-moi vos questions.`
                  : "Posez n'importe quelle question — je croise vos dossiers, votre agenda et vos mails pour répondre."}
              </p>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-md">
              {quickSuggestions.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void sendMessage(sug)}
                  className="rounded-full border border-border bg-background px-4 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/40 transition-colors shadow-xs"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-2">
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-2',
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  <div
                    className={cn(
                      'size-8 rounded-full flex items-center justify-center text-xs shrink-0',
                      isUser
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-primary-foreground shadow-sm'
                    )}
                  >
                    {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
                  </div>

                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2 text-xs leading-relaxed max-w-md',
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-tr-xs'
                        : 'bg-muted/70 text-foreground border border-border/70 rounded-tl-xs whitespace-pre-wrap'
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              )
            })}

            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs pl-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span>
                  {selectedProject
                    ? `Copilote analyse le dossier ${selectedProject.reference || selectedProject.display_title || ''}…`
                    : 'Copilote réfléchit et croise vos données…'}
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="space-y-2 pt-2">
        <div className="relative flex items-center rounded-2xl border border-border bg-background p-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'Écoute en cours…'
                : selectedProject
                  ? `Question sur ${selectedProject.reference || selectedProject.display_title || 'ce dossier'}...`
                  : 'Demandez-moi quelque chose...'
            }
            className="flex-1 resize-none bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none max-h-24 py-2"
          />

          <div className="flex items-center gap-2 shrink-0">
            {/* Speech Dictation Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleListening}
              className={cn(
                'size-8 rounded-full transition-colors',
                isListening
                  ? 'bg-red-500 text-primary-foreground animate-pulse'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
              )}
              title={isListening ? 'Arrêter l’enregistrement' : 'Dicter au micro'}
            >
              {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </Button>

            {/* Send Button */}
            <Button
              type="button"
              size="icon"
              disabled={!input.trim() || loading}
              onClick={() => void sendMessage()}
              className="size-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Entrée pour envoyer • Maj+Entrée pour un saut de ligne • Micro pour dicter
        </p>
      </div>

      {/* Modal Capacités */}
      <Dialog open={capabilitiesOpen} onOpenChange={setCapabilitiesOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Capacités du Copilote
            </DialogTitle>
            <DialogDescription>
              Votre assistant analyse en continu vos dossiers Mandat OS, votre agenda et vos correspondances.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {CAPABILITIES.map((cap, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-background p-4 space-y-2 shadow-sm"
              >
                <div className="text-xl">{cap.icon}</div>
                <h4 className="text-xs font-bold text-foreground">{cap.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Historique */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Historique des discussions</DialogTitle>
            <DialogDescription>
              Retrouvez vos précédentes sessions de travail avec le Copilote.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4 max-h-80 overflow-y-auto">
            {threads.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Aucune session précédente enregistrée.
              </p>
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  onClick={() => void selectThread(t.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-border p-4 text-left hover:bg-muted/50 transition-colors text-xs cursor-pointer group"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold text-foreground truncate block">{t.title}</span>
                    <span className="text-muted-foreground text-xs block mt-0.5">
                      {new Date(t.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => void deleteThread(t.id, e)}
                    className="size-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
