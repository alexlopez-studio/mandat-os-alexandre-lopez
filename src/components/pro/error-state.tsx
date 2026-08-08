import * as React from 'react'
import { AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ErrorStateProps = React.ComponentProps<'div'> & {
  title?: string
  description?: string
  /** Action de reprise. Une erreur doit toujours proposer une sortie. */
  onRetry?: () => void
  retryLabel?: string
  action?: React.ReactNode
}

/**
 * Etat d'erreur. Meme forme sur toutes les pages (voir `docs/DESIGN.md` §3).
 */
function ErrorState({
  title = 'Impossible de charger ces données',
  description = 'Une erreur est survenue. Réessayez dans un instant.',
  onRetry,
  retryLabel = 'Réessayer',
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/35 px-6 py-8 text-center',
        className
      )}
      {...props}
    >
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-card text-destructive ring-1 ring-border">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <div className="max-w-md space-y-2">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ?? (onRetry ? (
        <div className="mt-4">
          <Button variant="outline" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null)}
    </div>
  )
}

export { ErrorState }
