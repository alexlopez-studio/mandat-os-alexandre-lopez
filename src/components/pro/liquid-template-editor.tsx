'use client'

import React, { useRef } from 'react'
import { Sparkles, ChevronDown, Smartphone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LIQUID_VARIABLES, renderLiquidTemplate } from '@/lib/rdv-templates'

interface LiquidTemplateEditorProps {
  value: string
  onChange: (newValue: string) => void
  label?: string
  rows?: number
  clientData?: {
    first_name?: string
    last_name?: string
    date?: string
    time?: string
    type?: string
    address?: string
    agent_name?: string
  }
}

export function LiquidTemplateEditor({
  value,
  onChange,
  label = 'Message SMS',
  rows = 5,
  clientData,
}: LiquidTemplateEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Insert a Liquid tag at current cursor position in the single text area
  const handleInsertTag = (tag: string) => {
    if (!tag) return
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(value + ' ' + tag)
      return
    }

    const start = textarea.selectionStart ?? value.length
    const end = textarea.selectionEnd ?? value.length
    const textBefore = value.substring(0, start)
    const textAfter = value.substring(end)

    const padBefore = textBefore.length > 0 && !textBefore.endsWith(' ') ? ' ' : ''
    const padAfter = textAfter.length > 0 && !textAfter.startsWith(' ') ? ' ' : ''

    const newText = textBefore + padBefore + tag + padAfter + textAfter
    onChange(newText)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + padBefore.length + tag.length + padAfter.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 50)
  }

  const samplePreview = renderLiquidTemplate(value, {
    client: {
      first_name: clientData?.first_name || 'Jean',
      last_name: clientData?.last_name || 'Dupont',
    },
    rdv: {
      date: clientData?.date || '15 mars 2026',
      time: clientData?.time || '14h30',
      type: clientData?.type || 'Rendez-vous',
    },
    property: { address: clientData?.address || '12 rue des Vignes' },
    agent: { name: clientData?.agent_name || 'Alexandre Lopez' },
  })

  return (
    <div className="space-y-3">
      {/* Top Bar with Title on Left and Liquid Variables Dropdown Button on Top-Right */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>

        {/* Liquid Syntax Dropdown Button in Top-Right */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl font-bold text-xs gap-1.5 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer shadow-2xs"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>Variables Liquid</span>
              <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 sm:w-80 rounded-xl p-1.5 shadow-xl border-border bg-card">
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between px-2 py-1.5">
              <span>Insérer une variable Liquid</span>
              <Badge variant="outline" className="text-[9px] border-primary/30 text-primary bg-primary/5">
                Insertion au curseur
              </Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {LIQUID_VARIABLES.map((v) => (
              <DropdownMenuItem
                key={v.tag}
                onClick={() => handleInsertTag(v.tag)}
                className="cursor-pointer rounded-lg p-2.5 flex items-center justify-between transition-colors focus:bg-primary/10"
              >
                <code className="font-mono font-bold text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20">
                  {v.tag}
                </code>
                <span className="text-xs font-medium text-muted-foreground">{v.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Single Directly Editable Text Area */}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="rounded-xl bg-card border-input font-mono text-xs sm:text-sm min-h-[140px] p-3.5 leading-relaxed focus-visible:ring-primary shadow-xs"
        placeholder="Rédigez votre modèle de message SMS..."
      />

      {/* Live Final SMS Preview */}
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
            <Smartphone className="size-3.5 text-sky-600 dark:text-sky-400" />
            <span>SMS Final Reçu par le client (Exemple)</span>
          </span>

          <Badge variant="outline" className="text-[10px] border-sky-500/30 bg-sky-500/10 text-sky-700">
            Aperçu en direct
          </Badge>
        </div>
        <p className="text-xs font-medium text-foreground italic leading-relaxed">
          "{samplePreview}"
        </p>
      </div>
    </div>
  )
}
