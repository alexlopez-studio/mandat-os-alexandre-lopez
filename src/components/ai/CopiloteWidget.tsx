'use client'

import { useState } from 'react'
import {
  Sparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopilotePanel } from '@/components/dashboard/CopilotePanel'

export function CopiloteWidget() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Chat Window */}
      {open && (
        <div className="mb-4 w-96 max-w-full h-144 shadow-sm rounded-3xl overflow-hidden border border-border/80 bg-card transition-all duration-300 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4">
          <div className="relative h-full flex flex-col">
            {/* Top Close / Minimize Bar */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                title="Réduire"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Embedded Copilote Panel */}
            <CopilotePanel embedded={false} className="border-0 shadow-none h-full rounded-none" />
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-4 rounded-full bg-card/90 p-2 pr-4 border border-border/80 shadow-sm backdrop-blur transition-all duration-300 hover:scale-105"
          aria-label="Ouvrir le Copilote"
        >
          {/* Glowing 3D Sphere Orb */}
          <div className="relative size-10 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-400 p-0.5 shadow-sm ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all">
            <div className="size-full rounded-full bg-gradient-to-br from-indigo-400 via-purple-600 to-blue-700 flex items-center justify-center relative overflow-hidden">
              <Sparkles className="size-4 text-primary-foreground drop-shadow-xs" />
              <div className="absolute top-1 left-2 size-3 rounded-full bg-primary-foreground/40 blur-xs" />
            </div>
            {/* Active green dot */}
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>

          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
              Copilote
            </span>
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
              Disponible
            </span>
          </div>
        </button>
      )}
    </div>
  )
}
