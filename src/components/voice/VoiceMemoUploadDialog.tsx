'use client'

import { useState, useRef } from 'react'
import {
  Mic,
  Square,
  UploadCloud,
  FileAudio,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { StatusPill } from '@/components/pro'
import type { GranolaProcessedResult } from '@/lib/ai/voice-memo-types'

interface VoiceMemoUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactId?: string | null
  projectId?: string | null
  onProcessed?: (result: GranolaProcessedResult) => void
}

type Step = 'input' | 'uploading' | 'processing' | 'success'

export function VoiceMemoUploadDialog({
  open,
  onOpenChange,
  contactId,
  projectId,
  onProcessed,
}: VoiceMemoUploadDialogProps) {
  const [step, setStep] = useState<Step>('input')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [photos, setPhotos] = useState<File[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [processedResult, setProcessedResult] = useState<GranolaProcessedResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const resetState = () => {
    setStep('input')
    setAudioFile(null)
    setPhotos([])
    setIsRecording(false)
    setRecordingSeconds(0)
    setProcessedResult(null)
    setErrorMsg(null)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (isRecording) stopRecording()
      resetState()
    }
    onOpenChange(nextOpen)
  }

  // Enregistrement micro direct
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/m4a' })
        const file = new File([audioBlob], `debrief-${Date.now()}.m4a`, { type: 'audio/m4a' })
        setAudioFile(file)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1)
      }, 1000)
    } catch {
      toast.error("Impossible d'accéder au microphone")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setAudioFile(file)
  }

  const handlePhotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files)
      setPhotos((prev) => [...prev, ...newPhotos])
    }
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!audioFile) {
      toast.error('Veuillez enregistrer ou sélectionner un fichier audio')
      return
    }

    setStep('processing')
    setErrorMsg(null)

    try {
      const formData = new FormData()
      formData.append('audio', audioFile)
      if (contactId) formData.append('contact_id', contactId)
      if (projectId) formData.append('project_id', projectId)
      formData.append('source', 'web')

      photos.forEach((photo) => {
        formData.append('photos', photo)
      })

      const res = await fetch('/api/ai/voice-memo', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Erreur lors du traitement de la note')
      }

      setProcessedResult(json.data)
      setStep('success')
      toast.success('Compte-rendu généré avec succès !')
      if (onProcessed) onProcessed(json.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue'
      setErrorMsg(msg)
      setStep('input')
      toast.error(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Compte-rendu Vocal & Réunion</DialogTitle>
              <DialogDescription>
                Dictez ou déposez votre enregistrement. L&apos;IA génère la synthèse structurée, extrait les tâches et analyse vos photos de documents.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'input' && (
          <div className="flex flex-col gap-6 py-2">
            {/* Zone Enregistrement ou Dépôt Audio */}
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. Enregistrement ou Fichier Audio (.m4a, .mp3, .wav)
              </Label>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Bouton Dictaphone */}
                {!isRecording ? (
                  <Button
                    type="button"
                    variant={audioFile ? 'outline' : 'default'}
                    className="w-full sm:w-auto flex items-center gap-2"
                    onClick={startRecording}
                  >
                    <Mic className="h-4 w-4" />
                    Enregistrer au micro
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full sm:w-auto flex items-center gap-2 animate-pulse"
                    onClick={stopRecording}
                  >
                    <Square className="h-4 w-4" />
                    Arrêter ({formatSeconds(recordingSeconds)})
                  </Button>
                )}

                <span className="text-xs text-muted-foreground">ou</span>

                {/* Import de fichier */}
                <label className="w-full sm:w-auto flex-1 cursor-pointer">
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card p-4 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
                    <UploadCloud className="h-4 w-4 text-muted-foreground" />
                    <span>{audioFile ? audioFile.name : 'Choisir un fichier audio (iPhone / Dictaphone)'}</span>
                  </div>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {audioFile && !isRecording && (
                <div className="flex items-center justify-between rounded-lg bg-card border border-border p-4">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <FileAudio className="h-4 w-4 text-primary" />
                    <span className="truncate max-w-xs">{audioFile.name}</span>
                    <span className="text-muted-foreground">({Math.round(audioFile.size / 1024)} KB)</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => setAudioFile(null)}
                  >
                    Supprimer
                  </Button>
                </div>
              )}
            </div>

            {/* Zone Photos / Documents papiers (OCR) */}
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  2. Photos & Documents papiers (Optionnel)
                </Label>
                <span className="text-xs text-muted-foreground">Taxe foncière, DPE, travaux, façade</span>
              </div>

              <label className="cursor-pointer">
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card p-4 text-center hover:bg-muted/50 transition-colors">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">
                    Cliquez pour ajouter des photos ou documents de la visite
                  </span>
                  <span className="text-xs text-muted-foreground">
                    L&apos;IA lit et extrait automatiquement les montants, dates et surfaces (OCR)
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handlePhotosChange}
                />
              </label>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {photos.map((photo, i) => (
                    <div
                      key={i}
                      className="group relative flex items-center justify-between rounded-lg border border-border bg-card p-2 text-xs"
                    >
                      <span className="truncate max-w-xs font-medium">{photo.name}</span>
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="flex flex-col gap-2">
              <div className="text-base font-semibold">Analyse multimodale en cours...</div>
              <div className="text-xs text-muted-foreground max-w-sm">
                Transcription de la voix, lecture OCR des photos, rapprochement des fiches CRM et extraction des prochaines actions.
              </div>
            </div>
          </div>
        )}

        {step === 'success' && processedResult && (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Compte-rendu structuré généré et enregistré dans votre base CRM.</span>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{processedResult.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{processedResult.structured_summary.context}</p>
                </div>
                <StatusPill
                  tone={
                    processedResult.lead_temperature === 'hot'
                      ? 'danger'
                      : processedResult.lead_temperature === 'warm'
                      ? 'warning'
                      : 'neutral'
                  }
                >
                  {processedResult.lead_temperature === 'hot'
                    ? '🔥 Chaud'
                    : processedResult.lead_temperature === 'warm'
                    ? '⚖️ Tiède'
                    : '❄️ Froid'}
                </StatusPill>
              </div>

              {processedResult.action_items.length > 0 && (
                <div className="border-t border-border pt-4 mt-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                    Tâches extraites ({processedResult.action_items.length}) :
                  </span>
                  <ul className="flex flex-col gap-2 text-xs text-foreground">
                    {processedResult.action_items.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{item.title}</span>
                        {item.due_date && (
                          <span className="text-xs text-muted-foreground">({item.due_date})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-end gap-2">
          {step === 'input' && (
            <>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Annuler
              </Button>
              <Button
                type="button"
                disabled={!audioFile || isRecording}
                onClick={handleSubmit}
                className="flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Générer la note Granola
              </Button>
            </>
          )}

          {step === 'success' && (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
