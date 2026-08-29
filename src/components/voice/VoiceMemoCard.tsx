'use client'

import { useState } from 'react'
import {
  FileText,
  Volume2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react'
import Image from 'next/image'

import { StatusPill } from '@/components/pro'
import { Button } from '@/components/ui/button'
import type { VoiceMemoRecord, VoicePhotoAttachment } from '@/lib/ai/voice-memo-types'

interface VoiceMemoCardProps {
  memo: VoiceMemoRecord
  onTaskToggle?: (memoId: string, taskIndex: number, completed: boolean) => void
}

export function VoiceMemoCard({ memo, onTaskToggle }: VoiceMemoCardProps) {
  const [showTranscript, setShowTranscript] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<VoicePhotoAttachment | null>(null)
  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({})

  const { structured_summary, action_items = [], photos = [] } = memo

  const handleToggleTask = (index: number) => {
    const nextState = !completedTasks[index]
    setCompletedTasks((prev) => ({ ...prev, [index]: nextState }))
    if (onTaskToggle) onTaskToggle(memo.id, index, nextState)
  }

  const tempTone: 'danger' | 'warning' | 'neutral' =
    memo.lead_temperature === 'hot'
      ? 'danger'
      : memo.lead_temperature === 'warm'
      ? 'warning'
      : 'neutral'

  const tempLabel =
    memo.lead_temperature === 'hot'
      ? '🔥 Chaud'
      : memo.lead_temperature === 'warm'
      ? '⚖️ Tiède'
      : '❄️ Froid'

  const formattedDate = new Date(memo.created_at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-border/80">
      {/* En-tête de la note Granola */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-foreground leading-snug">{memo.title}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formattedDate}
              </span>
              <span>•</span>
              <span className="capitalize">{memo.source.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <StatusPill tone={tempTone}>{tempLabel}</StatusPill>
        </div>
      </div>

      {/* Lecteur Audio si disponible */}
      {memo.audio_url && (
        <div className="flex items-center gap-4 rounded-lg bg-muted/40 p-4 border border-border">
          <Volume2 className="h-4 w-4 text-primary shrink-0" />
          <audio controls src={memo.audio_url} className="w-full h-8" preload="none" />
        </div>
      )}

      {/* Synthèse : Contexte & Situation */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {structured_summary.context}
        </p>

        {structured_summary.client_situation && (
          <div className="rounded-lg bg-muted/30 p-4 text-xs text-foreground leading-relaxed border border-border/50">
            <strong className="text-muted-foreground block mb-1">Projet & Situation :</strong>
            {structured_summary.client_situation}
          </div>
        )}
      </div>

      {/* Points Clés */}
      {structured_summary.key_points && structured_summary.key_points.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            💡 Points clés abordés :
          </span>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground">
            {structured_summary.key_points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-muted/20 p-2 border border-border/40">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Objections & Vigilance */}
      {structured_summary.objections_and_vigilance && structured_summary.objections_and_vigilance.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Points de vigilance & Objections</span>
          </div>
          <ul className="flex flex-col gap-1 text-xs text-foreground/90 pl-4 list-disc">
            {structured_summary.objections_and_vigilance.map((ob, i) => (
              <li key={i}>{ob}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items / Tâches générées */}
      {action_items.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-card border border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Prochaines actions ({action_items.length})
            </span>
          </div>

          <div className="flex flex-col gap-2 mt-1">
            {action_items.map((item, idx) => {
              const isDone = completedTasks[idx] ?? Boolean(item.completed)
              return (
                <div
                  key={idx}
                  onClick={() => handleToggleTask(idx)}
                  className={`flex items-center justify-between rounded-lg p-2 text-xs border transition-colors cursor-pointer ${
                    isDone
                      ? 'bg-muted/30 text-muted-foreground line-through border-transparent'
                      : 'bg-card text-foreground border-border/80 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium">{item.title}</span>
                  </div>
                  {item.due_date && (
                    <span className="text-xs text-muted-foreground rounded bg-muted px-2 py-0.5">
                      Échéance : {item.due_date}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Galerie Photos & Documents OCR */}
      {photos.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Documents & Photos jointes ({photos.length})
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {photos.map((photo, i) => (
              <div
                key={i}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative flex flex-col rounded-lg border border-border bg-muted/20 overflow-hidden cursor-pointer hover:border-primary transition-colors"
              >
                {photo.url ? (
                  <div className="relative aspect-video w-full bg-muted">
                    <Image
                      src={photo.url}
                      alt={photo.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-muted">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="p-2 text-xs">
                  <div className="font-medium text-foreground truncate">{photo.name}</div>
                  {photo.document_type && (
                    <span className="text-xs text-primary capitalize">
                      {photo.document_type.replace('_', ' ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal d'aperçu d'une photo / OCR */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="flex max-h-full max-w-2xl flex-col rounded-xl bg-card p-6 shadow-sm border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
              <h4 className="text-sm font-semibold">{selectedPhoto.name}</h4>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPhoto(null)}>
                Fermer
              </Button>
            </div>

            {selectedPhoto.url && (
              <div className="relative aspect-video w-full rounded-lg overflow-hidden mb-4">
                <Image src={selectedPhoto.url} alt={selectedPhoto.name} fill className="object-contain" />
              </div>
            )}

            {selectedPhoto.ocr_extracted_text && (
              <div className="rounded-lg bg-muted p-4 text-xs text-foreground">
                <strong className="block mb-1 text-muted-foreground">Extraction OCR / Données lues :</strong>
                <p className="whitespace-pre-wrap">{selectedPhoto.ocr_extracted_text}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section Transcription brute (Collapsible) */}
      {memo.transcript && (
        <div className="border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground h-8 px-2"
            onClick={() => setShowTranscript(!showTranscript)}
          >
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Transcription brute ({memo.transcript.length} caractères)
            </span>
            {showTranscript ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          {showTranscript && (
            <div className="mt-2 rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto border border-border">
              {memo.transcript}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
