import type { Metadata } from 'next'
import { RuleWizard } from '@/components/admin/RuleWizard'

export const metadata: Metadata = {
  title: 'Nouvelle règle — Mandat OS',
}

export default function NewRulePage() {
  return <RuleWizard />
}