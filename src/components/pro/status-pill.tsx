import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusPillProps = React.ComponentProps<typeof Badge> & {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger'
}

const toneClasses = {
  neutral: 'border-border bg-muted text-muted-foreground',
  brand: 'border-primary/20 bg-accent text-primary',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
}

function StatusPill({
  tone = 'neutral',
  className,
  ...props
}: StatusPillProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-6 rounded-full px-2.5 text-xs font-bold',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  )
}

export { StatusPill }
