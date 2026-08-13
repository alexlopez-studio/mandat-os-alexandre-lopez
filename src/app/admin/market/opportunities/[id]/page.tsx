'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function OpportunityDetailRedirect() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  useEffect(() => {
    if (id) {
      router.replace(`/admin/market/projects/${id}`)
    }
  }, [id, router])

  return (
    <div className="flex h-40 items-center justify-center text-sm font-medium text-muted-foreground">
      Redirection vers le projet...
    </div>
  )
}
