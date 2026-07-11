import type { Metadata } from 'next'
import { RulesList } from './RulesList'

export const metadata: Metadata = {
  title: 'Règles — Mandat OS',
}

export default function RulesPage() {
  return <RulesList />
}