import * as React from 'react'

import { cn } from '@/lib/utils'

type ChipGroupProps = React.ComponentProps<'fieldset'> & {
  label: string
  hint?: string
}

/**
 * Rangee de `ToggleChip` sous un intitule, avec une aide facultative.
 *
 * `fieldset` / `legend` plutot qu'un `div` : un groupe de pastilles est une
 * question a choix multiple, et le lecteur d'ecran doit l'annoncer comme tel.
 */
function ChipGroup({ label, hint, className, children, ...props }: ChipGroupProps) {
  return (
    <fieldset className={cn('flex flex-col gap-2', className)} {...props}>
      <legend className="text-sm font-bold text-foreground">{label}</legend>
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

export { ChipGroup }
