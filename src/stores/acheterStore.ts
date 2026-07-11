import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ChatMessage { id: string; from: 'al' | 'user'; text: string; timestamp: string }

export interface AcheterAnswers {
  type_bien?: string; communes?: string; budget_max?: number; surface_min?: number; nb_pieces_min?: number
  criteres?: string[]; apport?: number; accord_bancaire?: string; primo_accedant?: string
  civilite?: 'monsieur' | 'madame'; prenom?: string; nom?: string; telephone?: string; email?: string; rgpd?: boolean
}

export type AcheterQuestionId =
  | 'type_bien' | 'communes' | 'budget_max' | 'surface_min' | 'nb_pieces_min'
  | 'criteres' | 'apport' | 'accord_bancaire' | 'primo_accedant'
  | 'recapitulatif' | 'coordonnees' | 'done'

interface AcheterState {
  messages: ChatMessage[]; currentQuestion: AcheterQuestionId; answers: AcheterAnswers; updatedAt: number
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void
  setAnswer: (key: keyof AcheterAnswers, value: AcheterAnswers[keyof AcheterAnswers]) => void
  setQuestion: (q: AcheterQuestionId) => void
  reset: () => void
}

function now() { return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }

const INIT: ChatMessage[] = [{
  id: '1', from: 'al',
  text: "Bonjour, je suis Alex Lopez.\n\nJe vais vous aider à cadrer votre projet d’achat en Provence Verte & Verdon : type de bien, communes ciblées, budget, critères importants et financement.\n\nL’objectif est simple : clarifier votre recherche avant de visiter. Quel type de bien recherchez-vous ?",
  timestamp: now(),
}]

const initial = { messages: INIT, currentQuestion: 'type_bien' as AcheterQuestionId, answers: {} as AcheterAnswers, updatedAt: 0 }

export const useAcheterStore = create<AcheterState>()(persist((set) => ({
  ...initial,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, { ...msg, id: Date.now().toString() }], updatedAt: Date.now() })),
  setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value }, updatedAt: Date.now() })),
  setQuestion: (q) => set({ currentQuestion: q, updatedAt: Date.now() }),
  reset: () => set({ ...initial, updatedAt: Date.now() }),
}), { name: 'acheter-store' }))
