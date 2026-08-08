'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled Global Error:', error)
  }, [error])

  return (
    <html lang="fr">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
          <div className="flex max-w-md flex-col items-center space-y-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Erreur Critique</h1>
              <p className="text-muted-foreground">
                Désolé, une erreur critique est survenue et l'application ne peut pas s'afficher correctement.
              </p>
            </div>
            <Button onClick={() => reset()} className="w-full">
              Rafraîchir l'application
            </Button>
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 w-full rounded-md bg-muted p-4 text-left overflow-auto max-h-[300px]">
                <p className="text-sm font-medium text-destructive mb-2">{error.message}</p>
                <pre className="text-xs text-muted-foreground">{error.stack}</pre>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
