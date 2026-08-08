import * as React from 'react'

import { StatusPill } from '@/components/pro/status-pill'
import { cn } from '@/lib/utils'
import { CONTACT_TYPE_META, type ContactType } from '@/lib/contact-types'

type ContactTypePillsProps = React.ComponentProps<'div'> & {
  types: ContactType[]
  /** Texte affiche quand le contact n'a aucune typologie. */
  emptyLabel?: string
  withIcon?: boolean
}

function ContactTypePills({
  types,
  emptyLabel = '—',
  withIcon = true,
  className,
  ...props
}: ContactTypePillsProps) {
  if (types.length === 0) {
    return (
      <span className="text-xs text-muted-foreground" aria-label="Aucune typologie">
        {emptyLabel}
      </span>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} {...props}>
      {types.map((type) => {
        const meta = CONTACT_TYPE_META[type]
        const Icon = meta.icon
        return (
          <StatusPill key={type} tone={meta.tone} className="gap-1">
            {withIcon ? <Icon className="size-3" aria-hidden="true" /> : null}
            {meta.label}
          </StatusPill>
        )
      })}
    </div>
  )
}

export { ContactTypePills }
