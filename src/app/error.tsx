'use client' // Error components must be Client Components

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Unhandled App Error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="flex max-w-md flex-col items-center space-y-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Oups ! Une erreur est survenue.</h1>
          <p className="text-muted-foreground">
            Désolé, nous avons rencontré un problème inattendu. Notre équipe a été notifiée.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button onClick={() => reset()} variant="outline" className="w-full">
            Réessayer
          </Button>
          <Button asChild className="w-full">
            <Link href="/app/dashboard">Retour à l'accueil</Link>
          </Button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 w-full rounded-md bg-muted p-4 text-left overflow-auto max-h-[300px]">
            <p className="text-sm font-medium text-destructive mb-2">{error.message}</p>
            <pre className="text-xs text-muted-foreground">{error.stack}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
