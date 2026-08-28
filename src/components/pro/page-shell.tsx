import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Largeurs de page autorisees (voir `docs/DESIGN.md` §2).
 * - default : pages de contenu standard
 * - wide    : tableaux, kanban, dashboards
 * - narrow  : formulaires, reglages, lecture
 */
const widthClasses = {
  default: 'max-w-5xl',
  wide: 'max-w-7xl',
  narrow: 'max-w-2xl',
} as const

type PageWidth = keyof typeof widthClasses

type PageLayoutProps = React.ComponentProps<'main'> & {
  width?: PageWidth
}

/**
 * Enveloppe TOUTE page. Seul composant autorise a porter la largeur,
 * le padding horizontal et l'espacement vertical entre sections.
 */
function PageLayout({ width = 'default', className, ...props }: PageLayoutProps) {
  return (
    <main
      className={cn(
        'flex w-full flex-1 flex-col gap-8 px-4 py-6 md:px-8',
        widthClasses[width],
        'mx-auto',
        className
      )}
      {...props}
    />
  )
}

/**
 * @deprecated Utiliser `PageLayout`. Conserve pour les pages non encore migrees.
 */
const PageShell = PageLayout

type PageSectionProps = React.ComponentProps<'section'>

/**
 * Regroupement logique sans en-tete. Pour une section titree, utiliser `Section`.
 */
function PageSection({ className, ...props }: PageSectionProps) {
  return <section className={cn('flex flex-col gap-6', className)} {...props} />
}

export { PageLayout, PageSection, PageShell, widthClasses }
export type { PageWidth }
