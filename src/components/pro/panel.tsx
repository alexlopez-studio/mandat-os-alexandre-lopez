import * as React from 'react'

import { SectionHeader } from '@/components/pro/section'
import { cn } from '@/lib/utils'

type PanelProps = React.ComponentProps<'section'> & {
  title: string
  description?: string
  actions?: React.ReactNode
}

/**
 * Carte autonome : en-tete + contenu, sur fond `card` et bordure.
 *
 * `Section` regroupe sans dessiner de cadre ; il manquait la carte elle-meme,
 * que chaque panneau improvisait dans son coin (`rounded-xl border bg-card p-6`,
 * or `rounded-xl` est reserve aux boutons — voir `docs/DESIGN.md` §2).
 */
function Panel({ title, description, actions, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn('flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm', className)}
      {...props}
    >
      <SectionHeader title={title} description={description} actions={actions} />
      {children}
    </section>
  )
}

export { Panel }
