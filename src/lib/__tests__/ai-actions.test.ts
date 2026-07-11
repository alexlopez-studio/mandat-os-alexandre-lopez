import { describe, expect, it } from 'vitest'
import { suggestActionsFromMessage } from '@/lib/ai/actions'

describe('suggestActionsFromMessage', () => {
  it('creates safe validation actions from assistant output', () => {
    const actions = suggestActionsFromMessage({
      message: 'Peux-tu résumer le transcript Granola et préparer une relance email pour les documents ?',
      assistantContent: 'Voici un compte rendu et un brouillon de relance.',
      dossierId: 'dossier-1',
      threadId: 'thread-1',
    })

    expect(actions.map((action) => action.action_type)).toEqual([
      'create_dossier_event',
      'draft_email',
      'review_documents',
    ])
    expect(actions.every((action) => action.dossier_id === 'dossier-1')).toBe(true)
  })

  it('does not create dossier updates when no dossier is selected', () => {
    const actions = suggestActionsFromMessage({
      message: 'Prépare une réponse email',
      assistantContent: 'Brouillon préparé.',
    })

    expect(actions).toHaveLength(1)
    expect(actions[0].action_type).toBe('draft_email')
  })
})
