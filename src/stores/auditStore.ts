import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ChatMessage { id: string; from: 'al' | 'user'; text: string; timestamp: string }

export interface AuditAnswers {
  adresse?: string; lat?: number; lng?: number; type_bien?: string; surface?: number
  etat_toiture?: string; etat_facade?: string; etat_menuiseries?: string; etat_plomberie?: string; etat_electricite?: string
  humidite?: string; isolation?: string[]; type_chauffage?: string; dpe?: string
  qualite?: string; objectif?: string
  civilite?: 'monsieur' | 'madame'; prenom?: string; nom?: string; telephone?: string; email?: string; rgpd?: boolean
}

export type AuditQuestionId =
  | 'adresse' | 'type_bien' | 'surface'
  | 'etat_toiture' | 'etat_facade' | 'etat_menuiseries' | 'etat_plomberie' | 'etat_electricite'
  | 'humidite' | 'isolation' | 'chauffage' | 'dpe'
  | 'qualite' | 'objectif'
  | 'recapitulatif' | 'coordonnees' | 'done'

interface AuditState {
  messages: ChatMessage[]; currentQuestion: AuditQuestionId; answers: AuditAnswers; updatedAt: number
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void
  setAnswer: (key: keyof AuditAnswers, value: AuditAnswers[keyof AuditAnswers]) => void
  setQuestion: (q: AuditQuestionId) => void
  reset: () => void
}

function now() { return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }

const INIT: ChatMessage[] = [{
  id: '1', from: 'al',
  text: "Bonjour, je suis Alex Lopez.\n\nJe vais vous aider à faire un point rapide sur un bien : état général, énergie, humidité, isolation, chauffage et objectif du projet.\n\nCe bilan ne remplace pas un diagnostic professionnel, mais il permet d’identifier les premiers points de vigilance. Commençons par l’adresse du bien.",
  timestamp: now(),
}]

const initial = { messages: INIT, currentQuestion: 'adresse' as AuditQuestionId, answers: {} as AuditAnswers, updatedAt: 0 }

export const useAuditStore = create<AuditState>()(persist((set) => ({
  ...initial,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, { ...msg, id: Date.now().toString() }], updatedAt: Date.now() })),
  setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value }, updatedAt: Date.now() })),
  setQuestion: (q) => set({ currentQuestion: q, updatedAt: Date.now() }),
  reset: () => set({ ...initial, updatedAt: Date.now() }),
}), { name: 'audit-store' }))
