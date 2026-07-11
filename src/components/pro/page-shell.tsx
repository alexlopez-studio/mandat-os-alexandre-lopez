import * as React from 'react'

import { cn } from '@/lib/utils'

type PageShellProps = React.ComponentProps<'main'>

function PageShell({ className, ...props }: PageShellProps) {
  return (
    <main
      className={cn(
        'flex flex-1 flex-col gap-5 px-4 py-4 md:gap-6 md:px-6 md:py-6',
        className
      )}
      {...props}
    />
  )
}

type PageSectionProps = React.ComponentProps<'section'>

function PageSection({ className, ...props }: PageSectionProps) {
  return (
    <section
      className={cn('flex flex-col gap-4', className)}
      {...props}
    />
  )
}

export { PageShell, PageSection }
