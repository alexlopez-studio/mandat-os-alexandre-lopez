import * as React from 'react'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type SearchInputProps = Omit<React.ComponentProps<typeof Input>, 'type'> & {
  /** Libelle accessible du champ. Obligatoire : le placeholder n'en tient pas lieu. */
  label: string
}

/**
 * Champ de recherche des barres d'outils. Porte l'icone et son decalage,
 * pour qu'aucune page n'ait a le refaire (voir `docs/DESIGN.md` §3).
 */
function SearchInput({ label, className, ...props }: SearchInputProps) {
  return (
    <div className="relative w-full sm:w-72">
      <Search
        className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input type="search" aria-label={label} className={cn('pl-8', className)} {...props} />
    </div>
  )
}

export { SearchInput }
