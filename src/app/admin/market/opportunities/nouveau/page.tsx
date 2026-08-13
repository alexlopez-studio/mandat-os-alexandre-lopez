'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function NewOpportunityRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams?.toString() ? `?${searchParams.toString()}` : ''
    router.replace(`/admin/market/projects/nouveau${query}`)
  }, [router, searchParams])

  return (
    <div className="flex h-40 items-center justify-center text-sm font-medium text-muted-foreground">
      Redirection vers le nouveau projet...
    </div>
  )
}
