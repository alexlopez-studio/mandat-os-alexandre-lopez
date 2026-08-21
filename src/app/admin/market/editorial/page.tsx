import type { Metadata } from 'next'

import { EditorialWorkspace } from './EditorialWorkspace'

export const metadata: Metadata = {
  title: 'Calendrier éditorial — Mandat OS',
}

export default function EditorialPage() {
  return <EditorialWorkspace />
}
