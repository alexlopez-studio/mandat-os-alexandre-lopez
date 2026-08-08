import * as React from 'react'

import { cn } from '@/lib/utils'

type SectionHeaderProps = React.ComponentProps<'div'> & {
  title: string
  description?: string
  actions?: React.ReactNode
}

/**
 * Titre de section. Seul endroit autorise pour un `text-lg font-bold`
 * (voir `docs/DESIGN.md` §2, echelle typographique).
 */
function SectionHeader({
  title,
  description,
  actions,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', className)}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-lg font-bold leading-tight text-foreground">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

type SectionProps = React.ComponentProps<'section'> & {
  title?: string
  description?: string
  actions?: React.ReactNode
}

/**
 * Regroupement logique dans une page : en-tete optionnel + contenu.
 */
function Section({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn('flex flex-col gap-4', className)} {...props}>
      {title ? <SectionHeader title={title} description={description} actions={actions} /> : null}
      {children}
    </section>
  )
}

export { Section, SectionHeader }
