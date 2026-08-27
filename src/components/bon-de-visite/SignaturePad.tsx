'use client'

import * as React from 'react'
import { EraserIcon, Undo2Icon, Maximize2Icon, Minimize2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SignaturePadProps = {
  value?: string | null
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}

type Point = { x: number; y: number }

export function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [hasSignature, setHasSignature] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const strokesRef = React.useRef<Point[][]>([])
  const currentStrokeRef = React.useRef<Point[]>([])

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Fond blanc pur pour contraste maximal
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Ligne guide de signature
    ctx.strokeStyle = '#CBD5E1'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.moveTo(24, canvas.height - 40)
    ctx.lineTo(canvas.width - 24, canvas.height - 40)
    ctx.stroke()
    ctx.setLineDash([])

    // Mention d'aide si vide
    if (strokesRef.current.length === 0 && currentStrokeRef.current.length === 0) {
      ctx.fillStyle = '#94A3B8'
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        'Signez ici avec votre doigt ou stylet',
        canvas.width / 2,
        canvas.height / 2
      )
      ctx.font = 'italic 12px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(
        '« Lu et approuvé »',
        canvas.width / 2,
        canvas.height / 2 + 24
      )
      return
    }

    // Dessin des traits fluides
    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const allStrokes = [...strokesRef.current]
    if (currentStrokeRef.current.length > 0) {
      allStrokes.push(currentStrokeRef.current)
    }

    for (const stroke of allStrokes) {
      if (stroke.length === 0) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y)
      }
      ctx.stroke()
    }
  }, [])

  const resizeCanvas = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
    }

    redraw()
  }, [redraw])

  React.useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas, isFullscreen])

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDrawing(true)
    const point = getCanvasPoint(e)
    currentStrokeRef.current = [point]
    redraw()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return
    const point = getCanvasPoint(e)
    currentStrokeRef.current.push(point)
    redraw()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return
    setIsDrawing(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current])
      currentStrokeRef.current = []
      setHasSignature(true)
      redraw()

      const canvas = canvasRef.current
      if (canvas) {
        onChange(canvas.toDataURL('image/png'))
      }
    }
  }

  const handleClear = () => {
    if (disabled) return
    strokesRef.current = []
    currentStrokeRef.current = []
    setHasSignature(false)
    redraw()
    onChange(null)
  }

  const handleUndo = () => {
    if (disabled || strokesRef.current.length === 0) return
    strokesRef.current.pop()
    const empty = strokesRef.current.length === 0
    setHasSignature(!empty)
    redraw()

    const canvas = canvasRef.current
    if (canvas) {
      onChange(empty ? null : canvas.toDataURL('image/png'))
    }
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-2 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-background/95 p-4 sm:p-6 backdrop-blur-md justify-between'
          : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">
          {isFullscreen ? 'Signature en plein écran (tournez votre téléphone si souhaité)' : 'Cadre de signature'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          {isFullscreen ? (
            <>
              <Minimize2Icon className="size-3.5 mr-1" />
              Réduire
            </>
          ) : (
            <>
              <Maximize2Icon className="size-3.5 mr-1" />
              Agrandir plein écran
            </>
          )}
        </Button>
      </div>

      <div
        className={`relative overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-white shadow-sm transition-all ${
          isFullscreen ? 'flex-1 min-h-[50vh] my-2' : 'h-64 sm:h-72 w-full'
        }`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="h-full w-full touch-none select-none bg-white cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={disabled || !hasSignature}
            className="text-xs font-semibold"
          >
            <EraserIcon className="size-3.5 mr-1" />
            Effacer
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={disabled || !hasSignature}
            className="text-xs font-semibold"
          >
            <Undo2Icon className="size-3.5 mr-1" />
            Annuler trait
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">
            {hasSignature ? (
              <span className="text-emerald-600 font-semibold">✓ Signature prête</span>
            ) : (
              <span className="text-muted-foreground">En attente de signature</span>
            )}
          </span>
          {isFullscreen && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => setIsFullscreen(false)}
              className="text-xs font-bold"
            >
              Terminer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
